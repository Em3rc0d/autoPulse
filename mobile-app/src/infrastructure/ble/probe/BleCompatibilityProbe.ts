import { Device, BleManager } from 'react-native-ble-plx';
import { ProbeResult, ProbeVerdict, ProfileMatchType } from '../../../domain/telemetry/probe/ProbeResult';
import { GattInspector, GattInventory } from './GattInspector';
import { CharacteristicCandidateSelector, CandidateCombination } from './CharacteristicCandidateSelector';
import { AdapterProfileMatcher } from './AdapterProfileMatcher';
import { ProbeHandshake, HandshakeResult } from './ProbeHandshake';

export type ProbeProgressCallback = (stage: string) => void;

export class BleCompatibilityProbe {
  private cancellationSignal = { cancelled: false };
  private manager: BleManager;
  private deviceId: string;
  private onProgress: ProbeProgressCallback;
  private startedAt: number = 0;
  private device: Device | null = null;

  constructor(manager: BleManager, deviceId: string, onProgress: ProbeProgressCallback) {
    this.manager = manager;
    this.deviceId = deviceId;
    this.onProgress = onProgress;
  }

  cancel() {
    this.cancellationSignal.cancelled = true;
  }

  async run(): Promise<{ result: ProbeResult, device?: Device, handshakeComb?: CandidateCombination }> {
    this.startedAt = Date.now();
    let inventory: GattInventory | null = null;
    let matchType: ProfileMatchType = 'NO_PROFILE_MATCH';
    let testedCombinationCount = 0;

    const buildResult = (
      verdict: ProbeVerdict,
      stage: string,
      reason?: string,
      handshake?: {
        cmd: string, comb: CandidateCombination, res: HandshakeResult
      },
      connectionRetained = false
    ): { result: ProbeResult, device?: Device, handshakeComb?: CandidateCombination } => ({
      result: {
        verdict,
        probeStage: stage,
        failureReason: reason,
        profileMatch: matchType,
        connectionRetained,
        testedCombinationCount,
        startedAt: this.startedAt,
        finishedAt: Date.now(),
        deviceId: this.deviceId,
        deviceName: this.device?.name || this.device?.localName || null,
        rssi: this.device?.rssi || null,
        commandUsed: handshake?.cmd,
        writeCharacteristicUUID: handshake?.comb.writeCharacteristic.uuid,
        receiveCharacteristicUUID: handshake?.comb.receiveCharacteristic.uuid,
        bytesWritten: handshake?.res.writeAccepted ? handshake.cmd.length : 0,
        sanitizedResponse: handshake?.res.sanitizedResponse || undefined,
        latencyMs: handshake?.res.latencyMs,
        echoDetected: handshake?.res.echoDetected,
        promptDetected: handshake?.res.promptDetected,
      },
      device: connectionRetained && this.device ? this.device : undefined,
      handshakeComb: connectionRetained && handshake ? handshake.comb : undefined,
    });

    try {
      this.onProgress('CONNECTING');

      // Connect
      this.device = await this.manager.connectToDevice(this.deviceId, { timeout: 10000 });
      if (this.cancellationSignal.cancelled) return buildResult(ProbeVerdict.CANCELLED, 'CONNECTING', 'User cancelled');

      this.onProgress('DISCOVERING_SERVICES');
      await this.device.discoverAllServicesAndCharacteristics();
      if (this.cancellationSignal.cancelled) return buildResult(ProbeVerdict.CANCELLED, 'DISCOVERING_SERVICES', 'User cancelled');

      this.onProgress('INSPECTING_GATT');
      inventory = await GattInspector.inspect(this.device);

      const matchRes = AdapterProfileMatcher.match(inventory);
      matchType = matchRes.matchType;

      const combinations = CharacteristicCandidateSelector.selectCombinations(inventory);

      if (combinations.length === 0) {
        await this.device.cancelConnection();
        return buildResult(ProbeVerdict.INCOMPATIBLE_TRANSPORT, 'CANDIDATE_SELECTION', 'No viable write/receive combinations found');
      }

      this.onProgress('TESTING_CHANNEL');

      let successfulHandshake: { cmd: string, comb: CandidateCombination, res: HandshakeResult } | null = null;
      let usedAtz = false;

      // Iterating combinations
      for (const comb of combinations) {
        if (this.cancellationSignal.cancelled) break;
        testedCombinationCount++;

        // Try ATI
        let res = await ProbeHandshake.execute(this.device, comb, 'ATI\r', 2000, this.cancellationSignal);
        if (res.disconnectObserved) {
          return buildResult(ProbeVerdict.PROBE_FAILED, 'HANDSHAKE', 'Device disconnected unexpectedly');
        }

        // If no valid text response, try AT@1
        if (!this.isValidResponse(res.sanitizedResponse)) {
          res = await ProbeHandshake.execute(this.device, comb, 'AT@1\r', 2000, this.cancellationSignal);
          if (res.disconnectObserved) return buildResult(ProbeVerdict.PROBE_FAILED, 'HANDSHAKE', 'Device disconnected unexpectedly');
        }

        // If still no valid response, try ATZ fallback (only once per device session)
        if (!this.isValidResponse(res.sanitizedResponse) && !usedAtz && res.writeAccepted) {
           usedAtz = true;
           await ProbeHandshake.execute(this.device, comb, 'ATZ\r', 3000, this.cancellationSignal);
           // After reset, try ATI again with longer timeout
           res = await ProbeHandshake.execute(this.device, comb, 'ATI\r', 3000, this.cancellationSignal);
           if (res.disconnectObserved) return buildResult(ProbeVerdict.PROBE_FAILED, 'HANDSHAKE', 'Device disconnected unexpectedly after reset');
        }

        if (this.isValidResponse(res.sanitizedResponse)) {
          successfulHandshake = { cmd: 'ATI/AT@1', comb, res };
          break; // Found a working combo!
        }
      }

      if (this.cancellationSignal.cancelled) {
        await this.device.cancelConnection();
        return buildResult(ProbeVerdict.CANCELLED, 'TESTING_CHANNEL', 'User cancelled');
      }

      if (successfulHandshake) {
        const isSupported = matchType !== 'NO_PROFILE_MATCH';
        const verdict = isSupported ? ProbeVerdict.SUPPORTED : ProbeVerdict.SUPPORTED_WITH_PROFILE;
        // Retain connection for supported, let UI decide when to kill or proceed
        return buildResult(verdict, 'FINISHED', undefined, successfulHandshake, true);
      }

      // If we got here, none of the combinations yielded a recognizable valid response.
      // But did we at least get SOME bytes back?
      // Check if we received anything at all on any combination to decide between UNKNOWN and INCOMPATIBLE_PROTOCOL
      await this.device.cancelConnection();
      return buildResult(ProbeVerdict.UNKNOWN, 'FINISHED', 'GATT usable but no valid AT protocol response');

    } catch (e: any) {
      if (this.device) {
        try { await this.device.cancelConnection(); } catch (ignore) {}
      }
      return buildResult(ProbeVerdict.PROBE_FAILED, 'EXECUTION', e.message);
    }
  }

  private isValidResponse(response: string | null | undefined): boolean {
    if (!response) return false;
    // An AT command response typically has some readable text (e.g. ELM327 v1.5, OBDII, etc.)
    // For our probe, we just want to ensure it's not empty, not just "OK", and not garbage.
    const alphaNum = response.replace(/[^a-zA-Z0-9]/g, '');
    return alphaNum.length >= 3;
  }
}
