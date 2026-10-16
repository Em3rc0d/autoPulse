import type { DiagnosticScanTerminalState } from '../../../domain/check/DiagnosticScanState';
import type { DtcServiceParseResult } from '../parsers/DtcServiceParser';
import type { Mode01DirectObservationResult } from '../parsers/Mode01DirectObservationParser';
import type { CheckCapabilityAssessment } from './CheckPhysicalPilot';

export type CheckPresentationTone = 'POSITIVE' | 'ATTENTION' | 'NEUTRAL';

export interface CheckPresentationCopy {
  readonly label: string;
  readonly detail: string;
  readonly tone: CheckPresentationTone;
}

export function presentCheckScanState(state: DiagnosticScanTerminalState): CheckPresentationCopy {
  switch (state) {
    case 'COMPLETE':
      return {
        label: 'Standard scan complete',
        detail: 'The planned standard diagnostic requests completed within this pilot scope.',
        tone: 'POSITIVE',
      };
    case 'LIMITED':
      return {
        label: 'Partial diagnostic coverage',
        detail: 'Useful ECU evidence was acquired, but at least one planned service was unavailable or inconclusive.',
        tone: 'ATTENTION',
      };
    case 'CANCELLED':
      return {
        label: 'Check cancelled',
        detail: 'The scan stopped without issuing additional planned requests.',
        tone: 'NEUTRAL',
      };
    case 'DISCONNECTED':
      return {
        label: 'Adapter disconnected',
        detail: 'The scan stopped because the diagnostic connection was lost.',
        tone: 'ATTENTION',
      };
    case 'FAILED':
      return {
        label: 'Check stopped safely',
        detail: 'The diagnostic gate stopped the scan instead of accepting incomplete or unsafe evidence.',
        tone: 'ATTENTION',
      };
  }
}

export function presentDtcResult(result: DtcServiceParseResult): CheckPresentationCopy {
  const noun = result.status === 'STORED'
    ? 'stored'
    : result.status === 'PENDING'
      ? 'pending'
      : 'permanent';

  switch (result.outcome) {
    case 'SUCCESS_ZERO_CODES':
      return {
        label: 'No codes reported',
        detail: `No ${noun} DTCs were reported by this scanned response.`,
        tone: 'POSITIVE',
      };
    case 'SUCCESS_WITH_CODES':
      return {
        label: `${result.codes.length} code${result.codes.length === 1 ? '' : 's'} reported`,
        detail: `The ECU response contained ${noun} diagnostic trouble code evidence.`,
        tone: 'ATTENTION',
      };
    case 'NO_DATA':
      return {
        label: 'No data returned',
        detail: `A ${noun} DTC list was not established from this request.`,
        tone: 'NEUTRAL',
      };
    case 'NEGATIVE_RESPONSE':
      return {
        label: 'Service unavailable',
        detail: `The ECU returned a negative diagnostic response for ${noun} DTCs.`,
        tone: 'NEUTRAL',
      };
    case 'UNSUPPORTED':
      return {
        label: 'Not supported here',
        detail: `This ${noun} DTC service was not established as supported on the observed path.`,
        tone: 'NEUTRAL',
      };
    case 'TIMEOUT':
      return {
        label: 'No response in time',
        detail: `The ${noun} DTC request did not complete within the bounded timeout.`,
        tone: 'ATTENTION',
      };
    case 'RESPONSE_PENDING':
      return {
        label: 'Response not completed',
        detail: 'The ECU requested additional wait time, but passive continuation is not yet physically promoted.',
        tone: 'ATTENTION',
      };
    case 'PARTIAL':
      return {
        label: 'Partial response',
        detail: `The ${noun} DTC response was incomplete and is not treated as a complete diagnostic list.`,
        tone: 'ATTENTION',
      };
    case 'INVALID_RESPONSE':
      return {
        label: 'Response rejected',
        detail: `The ${noun} DTC response failed validation and was not accepted as diagnostic evidence.`,
        tone: 'ATTENTION',
      };
    case 'DISCONNECTED':
      return {
        label: 'Connection lost',
        detail: `The connection ended before the ${noun} DTC request could establish a result.`,
        tone: 'ATTENTION',
      };
    case 'FAILED':
      return {
        label: 'Request unavailable',
        detail: `The ${noun} DTC request did not establish a usable result.`,
        tone: 'ATTENTION',
      };
  }
}

export function presentCapabilityAssessment(assessment: CheckCapabilityAssessment): CheckPresentationCopy {
  switch (assessment.state) {
    case 'ADVERTISED': {
      const advertising = assessment.observations.filter(item => item.outcome === 'VALID' && item.advertisedPids.length > 0);
      const single = assessment.validObservationCount === 1 ? advertising[0] : undefined;
      return {
        label: single
          ? `${single.advertisedPids.length} standard PID${single.advertisedPids.length === 1 ? '' : 's'} advertised`
          : `${assessment.validObservationCount} capability responses retained`,
        detail: assessment.unattributed
          ? 'Capability responses remain separate, but at least one responder could not be attributed with the current header-off pilot.'
          : 'Capability maps are preserved per observed responder; AutoPulse does not create a vehicle-global PID union.',
        tone: 'POSITIVE',
      };
    }
    case 'EMPTY_BITMAP':
      return {
        label: 'Capability map inconclusive',
        detail: 'The observed 0100 response set contained valid empty support bitmap evidence. AutoPulse does not convert that into a claim that individual PIDs are unsupported.',
        tone: 'ATTENTION',
      };
    case 'NOT_ESTABLISHED':
      return {
        label: 'Capability map unavailable',
        detail: 'A valid Mode 01 capability bitmap was not established in this scan.',
        tone: 'NEUTRAL',
      };
  }
}

export function presentDirectMode01Observation(result: Mode01DirectObservationResult): CheckPresentationCopy {
  const pid = `01${result.requestPid}`;
  switch (result.outcome) {
    case 'OBSERVED_DIRECTLY':
      return {
        label: 'Observed directly',
        detail: `${pid} returned usable current-data bytes. This is direct observation, not ECU-advertised support.`,
        tone: 'POSITIVE',
      };
    case 'NO_DATA':
      return { label: 'No data returned', detail: `${pid} did not return usable data in this bounded request.`, tone: 'NEUTRAL' };
    case 'NEGATIVE_RESPONSE':
    case 'UNSUPPORTED':
      return { label: 'Not established here', detail: `${pid} was not established by this direct observation. AutoPulse does not infer broader PID support from this.`, tone: 'NEUTRAL' };
    case 'TIMEOUT':
      return { label: 'No response in time', detail: `${pid} did not complete within the bounded timeout.`, tone: 'ATTENTION' };
    case 'RESPONSE_PENDING':
      return { label: 'Response not completed', detail: `${pid} requested additional wait time; no automatic resend was issued.`, tone: 'ATTENTION' };
    case 'PARTIAL':
    case 'INVALID_RESPONSE':
      return { label: 'Response not accepted', detail: `${pid} did not produce validated direct-observation evidence.`, tone: 'ATTENTION' };
    case 'DISCONNECTED':
      return { label: 'Connection lost', detail: `${pid} could not complete because the diagnostic connection ended.`, tone: 'ATTENTION' };
    case 'FAILED':
      return { label: 'Request unavailable', detail: `${pid} did not establish usable direct-observation evidence.`, tone: 'ATTENTION' };
  }
}

export function technicalDtcOutcome(result: DtcServiceParseResult): string {
  const nrc = result.negativeResponseCode ? ` · NRC ${result.negativeResponseCode}` : '';
  return `${result.outcome}${nrc}`;
}
