import { RealObdController } from './RealObdController';
import { CommandRequest, CommandResult } from './pipeline/types';
import { ObdDecoder } from './pipeline/ObdDecoder';
import {
  getNextCapabilityCommand,
  Mode01CapabilityCommand
} from '../../../domain/acquisition/Mode01CapabilityDiscovery';
import { appendPidEvidence } from '../../../domain/acquisition/SourceEcuEvidence';

export interface CapabilitySnapshot {
  protocol: string | null;
  supportedPids: string[];
  directlyObservedPids: string[];
  advertisedPidsByEcu: Record<string, string[]>;
  directlyObservedPidsByEcu: Record<string, string[]>;
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
      advertisedPidsByEcu: {},
      directlyObservedPidsByEcu: {},
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

      // 4. Discover the vehicle's advertised Mode 01 surface progressively.
      this.onProgress(4);
      let firstCapabilityResult = await this.executeAndRecord(
        snapshot,
        '0100',
        15000,
        'OBD_MODE_01',
        '41'
      );

      if (!this.isSuccessful(firstCapabilityResult)) {
        for (const protocol of ['ATSP6', 'ATSP7', 'ATSP8', 'ATSP9', 'ATSP3', 'ATSP4', 'ATSP5']) {
          await this.executeAndRecord(snapshot, protocol, 3000, 'ELM_AT');
          firstCapabilityResult = await this.executeAndRecord(
            snapshot,
            '0100',
            8000,
            'OBD_MODE_01',
            '41'
          );
          if (this.isSuccessful(firstCapabilityResult)) break;
        }
      }

      if (this.isSuccessful(firstCapabilityResult)) {
        await this.discoverMode01Capabilities(snapshot, firstCapabilityResult);
      } else {
        snapshot.failureReason =
          `${firstCapabilityResult.status}: ${firstCapabilityResult.errors.join(', ')}`;
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

  private isSuccessful(result: CommandResult): boolean {
    return result.status === 'SUCCESS_DECODED' || result.status === 'SUCCESS_RAW';
  }

  private async discoverMode01Capabilities(
    snapshot: CapabilitySnapshot,
    firstResult: CommandResult
  ): Promise<void> {
    let command: Mode01CapabilityCommand = '0100';
    let result = firstResult;

    while (this.isSuccessful(result)) {
      this.extractBitmaps(result, snapshot.supportedPids, snapshot.advertisedPidsByEcu);
      const nextCommand = getNextCapabilityCommand(command, snapshot.supportedPids);
      if (!nextCommand) return;

      command = nextCommand;
      result = await this.executeAndRecord(
        snapshot,
        command,
        5000,
        'OBD_MODE_01',
        '41'
      );
    }
  }

  private extractBitmaps(
    result: CommandResult,
    outPids: string[],
    advertisedPidsByEcu: Record<string, string[]>
  ) {
    let sourceAttributed = false;

    for (const frame of result.obdFrames) {
      const decodedValues = ObdDecoder.decode([frame]);
      for (const decoded of decodedValues) {
        if (decoded.type !== 'BITMAP' || !Array.isArray(decoded.value)) continue;

        sourceAttributed = true;
        this.appendUniquePids(outPids, decoded.value);
        appendPidEvidence(advertisedPidsByEcu, frame.sourceAddress, decoded.value);
      }
    }

    // Headerless adapters can still provide valid bitmap evidence. Preserve it
    // explicitly under UNKNOWN rather than manufacturing ECU address zero.
    if (!sourceAttributed) {
      for (const decoded of result.decodedValues ?? []) {
        if (decoded.type !== 'BITMAP' || !Array.isArray(decoded.value)) continue;
        this.appendUniquePids(outPids, decoded.value);
        appendPidEvidence(advertisedPidsByEcu, null, decoded.value);
      }
    }
  }

  private appendUniquePids(target: string[], pids: readonly string[]) {
    for (const pid of pids) {
      if (!target.includes(pid)) target.push(pid);
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

        const respondingFrames = result.obdFrames.filter(frame =>
          frame.validity === 'VALID' &&
          frame.pid?.toUpperCase() === pid.slice(2).toUpperCase()
        );

        if (respondingFrames.length === 0) {
          appendPidEvidence(snapshot.directlyObservedPidsByEcu, null, [pid]);
        } else {
          for (const frame of respondingFrames) {
            appendPidEvidence(snapshot.directlyObservedPidsByEcu, frame.sourceAddress, [pid]);
          }
        }
      }
    }
  }
}
