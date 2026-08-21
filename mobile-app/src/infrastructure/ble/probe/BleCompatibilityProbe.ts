import { Device, BleManager } from 'react-native-ble-plx';
import { ProbeResult, ProbeVerdict, ProfileMatchType } from '../../../domain/telemetry/probe/ProbeResult';
import {
  AdapterCompatibilityAssessment,
  AdapterCompatibilityClassifier,
} from '../../../domain/telemetry/probe/AdapterCompatibilityAssessment';
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
      connectionRetained = false,
      assessment?: AdapterCompatibilityAssessment,
    ): { result: ProbeResult, device?: Device, handshakeComb?: CandidateCombination } => ({
      result: {
        verdict,
        probeStage: stage,
        failureReason: reason,
        profileMatch: matchType,
        compatibilityGrade: assessment?.grade,
        compatibilityReasons: assessment?.reasons,
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
      if (this.cancellationSignal.cancelled) {
        return buildResult(ProbeVerdict.CANCELLED, 'CONNECTING', 'User cancelled');
      }

      this.onProgress('DISCOVERING_SERVICES');
      await this.device.discoverAllServicesAndCharacteristics();
      if (this.cancellationSignal.cancelled) {
        return buildResult(ProbeVerdict.CANCELLED, 'DISCOVERING_SERVICES', 'User cancelled');
      }

      this.onProgress('INSPECTING_GATT');
      inventory = await GattInspector.inspect(this.device);

      const matchRes = AdapterProfileMatcher.match(inventory);
      matchType = matchRes.matchType;

      const combinations = CharacteristicCandidateSelector.selectCombinations(inventory);

      if (combinations.length === 0) {
        await this.device.cancelConnection();
        return buildResult(
          ProbeVerdict.INCOMPATIBLE_TRANSPORT,
          'CANDIDATE_SELECTION',
          'No viable write/receive combinations found',
          undefined,
          false,
          { grade: 'UNSUPPORTED', reasons: ['NO_VIABLE_GATT_CHANNEL'] },
        );
      }

      this.onProgress('TESTING_CHANNEL');

      let successfulHandshake: { cmd: string, comb: CandidateCombination, res: HandshakeResult } | null = null;
      let usedAtz = false;

      for (const comb of combinations) {
        if (this.cancellationSignal.cancelled) break;
        testedCombinationCount++;

        let res = await ProbeHandshake.execute(this.device, comb, 'ATI\r', 2000, this.cancellationSignal);
        if (res.disconnectObserved) {
          return buildResult(
            ProbeVerdict.PROBE_FAILED,
            'HANDSHAKE',
            'Device disconnected unexpectedly',
            undefined,
            false,
            { grade: 'UNSUPPORTED', reasons: ['DISCONNECTED_DURING_PROBE'] },
          );
        }

        if (!this.isValidResponse(res.sanitizedResponse)) {
          res = await ProbeHandshake.execute(this.device, comb, 'AT@1\r', 2000, this.cancellationSignal);
          if (res.disconnectObserved) {
            return buildResult(
              ProbeVerdict.PROBE_FAILED,
              'HANDSHAKE',
              'Device disconnected unexpectedly',
              undefined,
              false,
              { grade: 'UNSUPPORTED', reasons: ['DISCONNECTED_DURING_PROBE'] },
            );
          }
        }

        if (!this.isValidResponse(res.sanitizedResponse) && !usedAtz && res.writeAccepted) {
          usedAtz = true;
          await ProbeHandshake.execute(this.device, comb, 'ATZ\r', 3000, this.cancellationSignal);
          res = await ProbeHandshake.execute(this.device, comb, 'ATI\r', 3000, this.cancellationSignal);
          if (res.disconnectObserved) {
            return buildResult(
              ProbeVerdict.PROBE_FAILED,
              'HANDSHAKE',
              'Device disconnected unexpectedly after reset',
              undefined,
              false,
              { grade: 'UNSUPPORTED', reasons: ['DISCONNECTED_DURING_PROBE'] },
            );
          }
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
        const { comb, res } = successfulHandshake;
        const receiveMode = comb.receiveCharacteristic.isNotifiable
          ? 'NOTIFY'
          : comb.receiveCharacteristic.isIndicatable
            ? 'INDICATE'
            : 'READ';
        const writeMode = comb.writeCharacteristic.isWritableWithResponse
          ? 'WITH_RESPONSE'
          : 'WITHOUT_RESPONSE';

        const assessment = AdapterCompatibilityClassifier.classify({
          profileMatch: matchType,
          writeAccepted: res.writeAccepted,
          responseReceived: res.responseReceived,
          protocolResponseValid: this.isValidResponse(res.sanitizedResponse),
          promptDetected: res.promptDetected,
          timedOut: res.timedOut,
          disconnectObserved: res.disconnectObserved,
          latencyMs: res.latencyMs,
          receiveMode,
          writeMode,
        });

        // Legacy verdict remains for existing consumers, but the canonical R4
        // contract is compatibilityGrade. Fix the historical inversion: a
        // profile match means WITH_PROFILE; generic behavior means SUPPORTED.
        const verdict = matchType === 'NO_PROFILE_MATCH'
          ? ProbeVerdict.SUPPORTED
          : ProbeVerdict.SUPPORTED_WITH_PROFILE;

        return buildResult(verdict, 'FINISHED', undefined, successfulHandshake, true, assessment);
      }

      await this.device.cancelConnection();
      return buildResult(
        ProbeVerdict.UNKNOWN,
        'FINISHED',
        'GATT usable but no valid AT protocol response',
        undefined,
        false,
        { grade: 'UNSUPPORTED', reasons: ['NO_VALID_AT_RESPONSE'] },
      );

    } catch (e: any) {
      if (this.device) {
        try { await this.device.cancelConnection(); } catch (ignore) {}
      }
      return buildResult(ProbeVerdict.PROBE_FAILED, 'EXECUTION', e.message);
    }
  }

  private isValidResponse(response: string | null | undefined): boolean {
    if (!response) return false;
    const alphaNum = response.replace(/[^a-zA-Z0-9]/g, '');
    return alphaNum.length >= 3;
  }
}
