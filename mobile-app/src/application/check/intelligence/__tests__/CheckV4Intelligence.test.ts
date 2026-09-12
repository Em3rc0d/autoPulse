import { CHECK_V4_PID_WALLET, MODE01_REFERENCE_PID_HEX } from '../PidWallet';
import { buildDiagnosticEvidencePlanV2 } from '../DiagnosticEvidencePlannerV2';
import { decodePid0101Readiness } from '../ReadinessDecoder';
import { decodePromotedMode01Observation } from '../Mode01ValueDecoder';
import { buildDiagnosticConcerns } from '../DiagnosticConcernEngine';
import { resolveDtcKnowledge } from '../DtcKnowledgeWallet';
import type { Mode01DirectObservationResult } from '../../parsers/Mode01DirectObservationParser';
import type { DtcServiceParseResult } from '../../parsers/DtcServiceParser';

function observed(pid: string, dataBytes: readonly number[]): Mode01DirectObservationResult {
  return {
    requestPid: pid,
    sourceEndpointId: null,
    protocol: 'ISO_14230_KWP',
    outcome: 'OBSERVED_DIRECTLY',
    dataBytes,
    rawPayload: [Number.parseInt(pid, 16), ...dataBytes],
    provenance: 'test',
    observedAt: 1,
  };
}

describe('CHECK v4 diagnostic intelligence', () => {
  test('keeps the 114-PID quarry wallet as knowledge rather than execution', () => {
    expect(MODE01_REFERENCE_PID_HEX).toHaveLength(114);
    expect(CHECK_V4_PID_WALLET).toHaveLength(114);
    expect(CHECK_V4_PID_WALLET.filter(item => item.executableInCheckV4).length).toBeLessThan(114);
  });

  test('selects only concern-relevant PIDs from Duster advertised capability evidence', () => {
    const plan = buildDiagnosticEvidencePlanV2({
      dtcCodes: ['P0301', 'P0420'],
      advertisedPids: ['0101','0104','0105','0106','0107','010B','010C','010D','010E','010F','0111','0113','0114','0115','011C'],
      capabilityInconclusive: false,
    });
    expect(plan.requests.length).toBeGreaterThan(1);
    expect(plan.requests.length).toBeLessThanOrEqual(12);
    expect(plan.requests.map(item => item.pid)).toContain('01');
    expect(plan.requests.map(item => item.pid)).toContain('06');
    expect(plan.requests.map(item => item.pid)).toContain('14');
    expect(plan.requests.every(item => item.advertised)).toBe(true);
  });

  test('uses bounded fallback and never turns the 114 wallet into a sweep', () => {
    const plan = buildDiagnosticEvidencePlanV2({
      dtcCodes: ['P0301'],
      advertisedPids: [],
      capabilityInconclusive: true,
    });
    expect(plan.requests.length).toBeLessThanOrEqual(12);
    expect(plan.requests.every(item => item.reason === 'BOUNDED_FALLBACK')).toBe(true);
  });

  test('decodes PID 0101 readiness without treating NOT_READY as failure', () => {
    const readiness = decodePid0101Readiness(observed('01', [0x81, 0x71, 0x65, 0x01]));
    expect(readiness?.milOn).toBe(true);
    expect(readiness?.confirmedDtcCount).toBe(1);
    expect(readiness?.monitors.some(item => item.state === 'NOT_READY')).toBe(true);
    expect(readiness?.monitors.every(item => ['READY','NOT_READY','NOT_SUPPORTED'].includes(item.state))).toBe(true);
  });

  test('decodes promoted PID values deterministically', () => {
    expect(decodePromotedMode01Observation(observed('05', [0x44]))?.signals[0].value).toBe(28);
    expect(decodePromotedMode01Observation(observed('0C', [0x10, 0xB0]))?.signals[0].value).toBe(1068);
  });

  test('groups stored+pending P0301 into one ECU-confirmed concern and does not assert cause', () => {
    const base = (status: 'STORED' | 'PENDING', service: '03' | '07'): DtcServiceParseResult => ({
      requestService: service,
      expectedResponseService: service === '03' ? '43' : '47',
      observedResponseService: service === '03' ? '43' : '47',
      status,
      outcome: 'SUCCESS_WITH_CODES',
      sourceEndpointId: null,
      protocol: 'ISO_14230_KWP',
      codes: [{ code: 'P0301', family: 'POWERTRAIN', rawPairs: [[0x03, 0x01]], occurrenceCount: 1 }],
      rawPayload: [0x03, 0x01],
      provenance: 'test',
      observedAt: 1,
    });
    const concerns = buildDiagnosticConcerns([base('STORED','03'), base('PENDING','07')], []);
    expect(concerns).toHaveLength(1);
    expect(concerns[0].statuses).toEqual(expect.arrayContaining(['STORED','PENDING']));
    expect(concerns[0].eventConfidence).toBe('CONFIRMED_BY_ECU');
    expect(concerns[0].causeConfidence).toBe('INSUFFICIENT');
  });

  test('retains syntactically valid unknown DTCs rather than rejecting them', () => {
    const unknown = resolveDtcKnowledge('U0123');
    expect(unknown?.code).toBe('U0123');
    expect(unknown?.canonicalMeaning).toBeUndefined();
  });
});
