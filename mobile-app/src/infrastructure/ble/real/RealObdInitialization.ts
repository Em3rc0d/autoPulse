import { RealObdController } from './RealObdController';
import { CommandRequest, CommandResult } from './pipeline/types';

export interface CapabilitySnapshot {
  protocol: string | null;
  supportedPids: string[];
  directlyObservedPids: string[];
  initializationSuccessful: boolean;
  failureReason?: string;
  adapterIdentity: Record<string, string>;
  rawDiscovery: Array<{
    command: string;
    status: string;
    response: string;
    latencyMs: number;
  }>;
}

export class RealObdInitialization {
  private controller: RealObdController;
  private onProgress: (step: number) => void;

  constructor(controller: RealObdController, onProgress: (step: number) => void) {
    this.controller = controller;
    this.onProgress = onProgress;
  }

  private buildRequest(command: string, timeoutMs: number, family: CommandRequest['family'], expectedService?: string): CommandRequest {
    return {
      id: Math.random().toString(36).substring(7),
      command,
      family,
      expectedService,
      timeoutMs
    };
  }

  private async executeAndRecord(
    snapshot: CapabilitySnapshot,
    command: string,
    timeoutMs: number,
    family: CommandRequest['family'],
    expectedService?: string
  ): Promise<CommandResult> {
    console.log(`[ELM327 DISCOVERY TX] ${command}`);
    const result = await this.controller.executeCommand(this.buildRequest(command, timeoutMs, family, expectedService));
    const response = result.rawResponse?.accumulatedText || '';
    console.log(`[ELM327 DISCOVERY RX] ${command} => ${JSON.stringify(response)} (${result.status})`);
    snapshot.rawDiscovery.push({
      command,
      status: result.status,
      response,
      latencyMs: result.latencyMs
    });
    return result;
  }

  private rememberIdentity(snapshot: CapabilitySnapshot, key: string, result: CommandResult) {
    const text = result.normalizedResponse?.normalizedText || result.rawResponse?.accumulatedText || '';
    if (text && result.status !== 'ELM_ERROR' && result.status !== 'TIMEOUT') {
      snapshot.adapterIdentity[key] = text.replace(/>/g, '').trim();
    }
  }

  async execute(): Promise<CapabilitySnapshot> {
    const snapshot: CapabilitySnapshot = {
      protocol: null,
      supportedPids: [],
      directlyObservedPids: [],
      initializationSuccessful: false,
      adapterIdentity: {},
      rawDiscovery: []
    };

    try {
      // 1. ATZ (Reset) - Long timeout
      this.onProgress(0); // ELM327 identified
      this.rememberIdentity(snapshot, 'resetBanner', await this.executeAndRecord(snapshot, 'ATZ', 5000, 'ELM_AT'));

      // 2. Formatting commands
      this.onProgress(1); // Configuring adapter
      await this.executeAndRecord(snapshot, 'ATE0', 3000, 'ELM_AT');
      await this.executeAndRecord(snapshot, 'ATL0', 3000, 'ELM_AT');
      await this.executeAndRecord(snapshot, 'ATS0', 3000, 'ELM_AT');
      await this.executeAndRecord(snapshot, 'ATH0', 3000, 'ELM_AT');
      await this.executeAndRecord(snapshot, 'ATCAF1', 3000, 'ELM_AT');
      await this.executeAndRecord(snapshot, 'ATAT1', 3000, 'ELM_AT');
      this.rememberIdentity(snapshot, 'adapterVersion', await this.executeAndRecord(snapshot, 'ATI', 3000, 'ELM_AT'));
      this.rememberIdentity(snapshot, 'deviceDescription', await this.executeAndRecord(snapshot, 'AT@1', 3000, 'ELM_AT'));
      this.rememberIdentity(snapshot, 'supplyVoltage', await this.executeAndRecord(snapshot, 'ATRV', 3000, 'ELM_AT'));

      // 3. Detect vehicle protocol
      this.onProgress(3);
      await this.executeAndRecord(snapshot, 'ATSP0', 3000, 'ELM_AT');
      const resProtocolName = await this.executeAndRecord(snapshot, 'ATDP', 5000, 'ELM_AT');
      this.rememberIdentity(snapshot, 'protocolName', resProtocolName);
      const resProtocol = await this.executeAndRecord(snapshot, 'ATDPN', 5000, 'ELM_AT');
      if (resProtocol.status === 'SUCCESS_RAW' || resProtocol.status === 'SUCCESS_DECODED') {
        snapshot.protocol = resProtocol.normalizedResponse?.normalizedText || null;
      }

      // 4. Checking supported signals (0100)
      this.onProgress(4);
      let res0100 = await this.executeAndRecord(snapshot, '0100', 15000, 'OBD_MODE_01', '41');

      if (res0100.status !== 'SUCCESS_DECODED' && res0100.status !== 'SUCCESS_RAW') {
        for (const protocol of ['ATSP6', 'ATSP7', 'ATSP8', 'ATSP9', 'ATSP3', 'ATSP4', 'ATSP5']) {
          await this.executeAndRecord(snapshot, protocol, 3000, 'ELM_AT');
          res0100 = await this.executeAndRecord(snapshot, '0100', 8000, 'OBD_MODE_01', '41');
          if (res0100.status === 'SUCCESS_DECODED' || res0100.status === 'SUCCESS_RAW') {
            break;
          }
        }
      }

      if (res0100.status === 'SUCCESS_DECODED' || res0100.status === 'SUCCESS_RAW') {
        this.extractBitmaps(res0100, snapshot.supportedPids);

        // If 0120 is supported, query it
        if (snapshot.supportedPids.includes('0120')) {
          const res0120 = await this.executeAndRecord(snapshot, '0120', 5000, 'OBD_MODE_01', '41');
          this.extractBitmaps(res0120, snapshot.supportedPids);

          // If 0140 is supported, query it
          if (snapshot.supportedPids.includes('0140')) {
            const res0140 = await this.executeAndRecord(snapshot, '0140', 5000, 'OBD_MODE_01', '41');
            this.extractBitmaps(res0140, snapshot.supportedPids);
          }
          if (snapshot.supportedPids.includes('0160')) {
            const res0160 = await this.executeAndRecord(snapshot, '0160', 5000, 'OBD_MODE_01', '41');
            this.extractBitmaps(res0160, snapshot.supportedPids);
          }
          if (snapshot.supportedPids.includes('0180')) {
            const res0180 = await this.executeAndRecord(snapshot, '0180', 5000, 'OBD_MODE_01', '41');
            this.extractBitmaps(res0180, snapshot.supportedPids);
          }
        }
      } else {
        // If 0100 fails to get data (e.g., UNABLE TO CONNECT), init failed
        snapshot.failureReason = `${res0100.status}: ${res0100.errors.join(', ')}`;
      }

      await this.probeCoreSignals(snapshot);

      await this.executeAndRecord(snapshot, '0900', 5000, 'OBD_MODE_09', '49');
      await this.executeAndRecord(snapshot, '0902', 5000, 'OBD_MODE_09', '49');
      await this.executeAndRecord(snapshot, '0904', 5000, 'OBD_MODE_09', '49');
      await this.executeAndRecord(snapshot, '090A', 5000, 'OBD_MODE_09', '49');
      await this.executeAndRecord(snapshot, '03', 5000, 'OBD_MODE_03', '43');

      snapshot.initializationSuccessful = snapshot.supportedPids.length > 0;
      if (!snapshot.initializationSuccessful) {
        snapshot.failureReason = snapshot.failureReason || 'NO_OBD_SIGNALS_DECODED';
      }
      this.onProgress(5); // Preparing live session

      return snapshot;
    } catch (e: any) {
      snapshot.failureReason = e?.message || 'Unknown exception';
      return snapshot;
    }
  }

  private extractBitmaps(res: CommandResult, outPids: string[]) {
    if (!res.decodedValues) return;
    for (const decoded of res.decodedValues) {
      if (decoded.type === 'BITMAP' && Array.isArray(decoded.value)) {
        for (const pid of decoded.value) {
          if (!outPids.includes(pid)) {
            outPids.push(pid);
          }
        }
      }
    }
  }

  private async probeCoreSignals(snapshot: CapabilitySnapshot) {
    const corePids = ['010C', '010D', '0105', '0142'];

    for (const pid of corePids) {
      const result = await this.executeAndRecord(snapshot, pid, 4000, 'OBD_MODE_01', '41');
      if (result.status === 'SUCCESS_DECODED') {
        if (!snapshot.supportedPids.includes(pid)) {
          snapshot.supportedPids.push(pid);
        }
        if (!snapshot.directlyObservedPids.includes(pid)) {
          snapshot.directlyObservedPids.push(pid);
        }
      }
    }
  }
}
