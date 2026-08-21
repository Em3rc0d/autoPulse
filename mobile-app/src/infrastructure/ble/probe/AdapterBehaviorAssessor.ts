import { Device } from 'react-native-ble-plx';
import {
  AdapterBehaviorAssessment,
  AdapterBehaviorCheck,
  AdapterBehaviorRequirement,
} from '../../../domain/telemetry/probe/AdapterBehaviorAssessment';
import { CandidateCombination } from './CharacteristicCandidateSelector';
import { ProbeHandshake } from './ProbeHandshake';

interface BehaviorCommand {
  command: string;
  requirement: AdapterBehaviorRequirement;
}

const BEHAVIOR_COMMANDS: BehaviorCommand[] = [
  { command: 'ATE0\r', requirement: 'PREFERRED' },
  { command: 'ATL0\r', requirement: 'PREFERRED' },
  { command: 'ATCAF1\r', requirement: 'PREFERRED' },
  { command: 'ATSP0\r', requirement: 'PREFERRED' },
  { command: 'ATS0\r', requirement: 'OPTIONAL' },
  { command: 'ATH0\r', requirement: 'OPTIONAL' },
  { command: 'ATAT1\r', requirement: 'OPTIONAL' },
];

export class AdapterBehaviorAssessor {
  static async assess(
    device: Device,
    combination: CandidateCombination,
    cancellationSignal: { cancelled: boolean },
  ): Promise<AdapterBehaviorAssessment> {
    const checks: AdapterBehaviorCheck[] = [];
    let disconnectObserved = false;

    for (const definition of BEHAVIOR_COMMANDS) {
      if (cancellationSignal.cancelled || disconnectObserved) break;

      const result = await ProbeHandshake.execute(
        device,
        combination,
        definition.command,
        2500,
        cancellationSignal,
      );

      const normalized = (result.sanitizedResponse || '').trim().toUpperCase();
      let outcome: AdapterBehaviorCheck['outcome'];

      if (result.disconnectObserved) {
        outcome = 'DISCONNECTED';
        disconnectObserved = true;
      } else if (result.timedOut) {
        outcome = 'TIMEOUT';
      } else if (
        result.writeAccepted &&
        result.responseReceived &&
        result.promptDetected &&
        normalized === 'OK'
      ) {
        outcome = 'PASS';
      } else {
        outcome = 'FAIL';
      }

      checks.push({
        command: definition.command.trim(),
        requirement: definition.requirement,
        outcome,
        sanitizedResponse: result.sanitizedResponse || undefined,
        latencyMs: result.latencyMs,
        promptObserved: result.promptDetected,
      });
    }

    const preferredFailures = checks
      .filter(check => check.requirement === 'PREFERRED' && check.outcome !== 'PASS')
      .map(check => check.command);
    const optionalFailures = checks
      .filter(check => check.requirement === 'OPTIONAL' && check.outcome !== 'PASS')
      .map(check => check.command);

    const allCommandsObserved = checks.length === BEHAVIOR_COMMANDS.length;
    const certificationReady =
      allCommandsObserved &&
      !disconnectObserved &&
      preferredFailures.length === 0 &&
      optionalFailures.length === 0;

    return Object.freeze({
      schemaVersion: '1.0' as const,
      checks: Object.freeze(checks.map(check => Object.freeze(check))) as unknown as AdapterBehaviorCheck[],
      preferredFailures: Object.freeze([...preferredFailures]) as unknown as string[],
      optionalFailures: Object.freeze([...optionalFailures]) as unknown as string[],
      disconnectObserved,
      certificationReady,
    });
  }
}
