import { Device, BleManager } from 'react-native-ble-plx';
import {
  AdapterCompatibilityGrade,
  ProbeResult,
  ProbeVerdict,
  ProfileMatchType,
} from '../../../domain/telemetry/probe/ProbeResult';
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
        compatibilityGrade: this.classifyCompatibility(verdict, matchType),
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

      for (const comb of combinations) {
        if (this.cancellationSignal.cancelled) break;
        testedCombinationCount++;

        let res = await ProbeHandshake.execute(this.device, comb, 'ATI\r', 2000, this.cancellationSignal);
        if (res.disconnectObserved) {
          return buildResult(ProbeVerdict.PROBE_FAILED, 'HANDSHAKE', 'Device disconnected unexpectedly');
        }

        if (!this.isValidResponse(res.sanitizedResponse)) {
          res = await ProbeHandshake.execute(this.device, comb, 'AT@1\r', 2000, this.cancellationSignal);
          if (res.disconnectObserved) return buildResult(ProbeVerdict.PROBE_FAILED, 'HANDSHAKE', 'Device disconnected unexpectedly');
        }

        if (!this.isValidResponse(res.sanitizedResponse) && !usedAtz && res.writeAccepted) {
          usedAtz = true;
          await ProbeHandshake.execute(this.device, comb, 'ATZ\r', 3000, this.cancellationSignal);
          res = await ProbeHandshake.execute(this.device, comb, 'ATI\r', 3000, this.cancellationSignal);
          if (res.disconnectObserved) return buildResult(ProbeVerdict.PROBE_FAILED, 'HANDSHAKE', 'Device disconnected unexpectedly after reset');
        }

        if (this.isValidResponse(res.sanitizedResponse)) {
          successfulHandshake = { cmd: 'ATI/AT@1', comb, res };
          break;
        }
      }

      if (this.cancellationSignal.cancelled) {
        await this.device.cancelConnection();
        return buildResult(ProbeVerdict.CANCELLED, 'TESTING_CHANNEL', 'User cancelled');
      }

      if (successfulHandshake) {
        // A profile match is provenance, not authority. A working generic adapter is still supported.
        const verdict = matchType === 'NO_PROFILE_MATCH'
          ? ProbeVerdict.SUPPORTED
          : ProbeVerdict.SUPPORTED_WITH_PROFILE;
        return buildResult(verdict, 'FINISHED', undefined, successfulHandshake, true);
      }

      await this.device.cancelConnection();
      return buildResult(ProbeVerdict.UNKNOWN, 'FINISHED', 'GATT usable but no valid AT protocol response');

    } catch (e: any) {
      if (this.device) {
        try { await this.device.cancelConnection(); } catch (ignore) {}
      }
      return buildResult(ProbeVerdict.PROBE_FAILED, 'EXECUTION', e.message);
    }
  }

  private classifyCompatibility(verdict: ProbeVerdict, matchType: ProfileMatchType): AdapterCompatibilityGrade {
    if (verdict === ProbeVerdict.SUPPORTED_WITH_PROFILE) {
      return matchType === 'EXACT_PROFILE_MATCH'
        ? AdapterCompatibilityGrade.CERTIFIED
        : AdapterCompatibilityGrade.COMPATIBLE;
    }

    if (verdict === ProbeVerdict.SUPPORTED) {
      return AdapterCompatibilityGrade.COMPATIBLE;
    }

    if (
      verdict === ProbeVerdict.INCOMPATIBLE_TRANSPORT ||
      verdict === ProbeVerdict.INCOMPATIBLE_PROTOCOL ||
      verdict === ProbeVerdict.PROBE_FAILED
    ) {
      return AdapterCompatibilityGrade.UNSUPPORTED;
    }

    return AdapterCompatibilityGrade.UNKNOWN;
  }

  private isValidResponse(response: string | null | undefined): boolean {
    if (!response) return false;
    const alphaNum = response.replace(/[^a-zA-Z0-9]/g, '');
    return alphaNum.length >= 3;
  }
}
