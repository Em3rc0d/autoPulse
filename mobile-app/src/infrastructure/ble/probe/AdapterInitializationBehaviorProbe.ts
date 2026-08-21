import type { Device } from 'react-native-ble-plx';
import type { CandidateCombination } from './CharacteristicCandidateSelector';
import { ProbeHandshake } from './ProbeHandshake';
import {
  AdapterInitializationCheck,
  AdapterInitializationCheckOutcome,
  PROBED_ADAPTER_BEHAVIORS,
} from '../../../domain/telemetry/probe/AdapterInitializationBehavior';

export interface AdapterInitializationBehaviorProbeResult {
  checks: AdapterInitializationCheck[];
  disconnectObserved: boolean;
}

/**
 * Safely probes adapter-only AT behavior after a trustworthy channel has been
 * established. These checks do not interrogate vehicle PIDs or infer vehicle
 * support; that remains R5 territory.
 */
export class AdapterInitializationBehaviorProbe {
  static async execute(
    device: Device,
    combination: CandidateCombination,
    cancellationSignal: { cancelled: boolean },
  ): Promise<AdapterInitializationBehaviorProbeResult> {
    const checks: AdapterInitializationCheck[] = [];

    for (const spec of PROBED_ADAPTER_BEHAVIORS) {
      if (cancellationSignal.cancelled) break;

      const result = await ProbeHandshake.execute(
        device,
        combination,
        spec.command,
        2000,
        cancellationSignal,
      );

      const outcome = this.classifyOutcome(result);
      checks.push({
        behavior: spec.key,
        requirement: spec.requirement,
        command: spec.command.trim(),
        outcome,
        response: result.sanitizedResponse,
        latencyMs: result.latencyMs,
        timedOut: result.timedOut,
        promptDetected: result.promptDetected,
      });

      if (result.disconnectObserved) {
        return { checks, disconnectObserved: true };
      }
    }

    return { checks, disconnectObserved: false };
  }

  private static classifyOutcome(result: {
    writeAccepted: boolean;
    responseReceived: boolean;
    sanitizedResponse: string | null;
    disconnectObserved: boolean;
  }): AdapterInitializationCheckOutcome {
    if (result.disconnectObserved) return 'DISCONNECTED';
    if (!result.writeAccepted) return 'WRITE_FAILED';
    if (!result.responseReceived) return 'NO_RESPONSE';

    const response = (result.sanitizedResponse || '').trim().toUpperCase();
    if (response === 'OK' || response.startsWith('OK ')) return 'ACKNOWLEDGED';
    if (response === '?' || response.includes('ERROR')) return 'REJECTED';
    return 'UNRECOGNIZED_RESPONSE';
  }
}
