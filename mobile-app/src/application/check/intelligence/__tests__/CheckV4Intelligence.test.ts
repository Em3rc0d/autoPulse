import { CHECK_V4_PID_WALLET, MODE01_REFERENCE_PID_HEX } from '../PidWallet';
import { buildDiagnosticEvidencePlanV2 } from '../DiagnosticEvidencePlannerV2';
import { decodePid0101Readiness } from '../ReadinessDecoder';
import { decodePromotedMode01Observation, type DecodedPidObservation } from '../Mode01ValueDecoder';
import { buildDiagnosticConcerns } from '../DiagnosticConcernEngine';
import { resolveDtcKnowledge } from '../DtcKnowledgeWallet';
import type { Mode01DirectObservationResult } from '../../parsers/Mode01DirectObservationParser';
import type { DtcServiceParseResult } from '../../parsers/DtcServiceParser';

function observed(pid: string, dataBytes: readonly number[], sourceEndpointId: string | null = null): Mode01DirectObservationResult {
  return {
    requestPid: pid,
    sourceEndpointId,
    protocol: 'ISO_14230_KWP',
    outcome: 'OBSERVED_DIRECTLY',
    dataBytes,
    rawPayload: [Number.parseInt(pid, 16), ...dataBytes],
    provenance: 'test',
    observedAt: 1,
  };
}

function dtc(
  code: string,
  status: 'STORED' | 'PENDING' | 'PERMANENT',
  sourceEndpointId: string | null,
): DtcServiceParseResult {
  const requestService = status === 'STORED' ? '03' : status === 'PENDING' ? '07' : '0A';
  const expectedResponseService = status === 'STORED' ? '43' : status === 'PENDING' ? '47' : '4A';
  return {
    requestService,
    expectedResponseService,
    observedResponseService: expectedResponseService,
    status,
    outcome: 'SUCCESS_WITH_CODES',
    sourceEndpointId,
    protocol: 'ISO_14230_KWP',
    codes: [{ code, family: 'POWERTRAIN', rawPairs: [[0x03, 0x01]], occurrenceCount: 1 }],
    rawPayload: [0x03, 0x01],
    provenance: 'test',
    observedAt: 1,
  };
}

function decoded(pid: string, dataBytes: readonly number[], sourceEndpointId: string | null): DecodedPidObservation {
  const value = decodePromotedMode01Observation(observed(pid, dataBytes, sourceEndpointId));
  if (!value) throw new Error(`Fixture PID ${pid} did not decode`);
  return value;
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
    expect(plan.requests.length).toBeGreaterThan(5);
    expect(plan.requests.length).toBeLessThanOrEqual(18);
    expect(plan.requests.every(item => item.reason === 'BOUNDED_FALLBACK')).toBe(true);
    expect(plan.requests.length).toBeLessThan(CHECK_V4_PID_WALLET.length);
  });

  test('collects a useful adaptive baseline even when no DTC is reported', () => {
    const plan = buildDiagnosticEvidencePlanV2({
      dtcCodes: [],
      advertisedPids: [],
      capabilityInconclusive: true,
      alreadyObservedPids: ['05', '0C', '0D'],
    });

    expect(plan.version).toBe('check-evidence-planner/v3');
    expect(plan.alreadyObservedPidCount).toBe(3);
    expect(plan.requests.map(item => item.pid)).toEqual(expect.arrayContaining([
      '01', '04', '0B', '0F', '10', '11', '42', '1F', '2F', '33',
    ]));
    expect(plan.requests.map(item => item.pid)).not.toEqual(expect.arrayContaining(['05', '0C', '0D']));
    expect(plan.requests.length).toBeLessThanOrEqual(18);
  });

  test('never probes a PID explicitly absent from a valid known capability range', () => {
    const plan = buildDiagnosticEvidencePlanV2({
      dtcCodes: [],
      advertisedPids: ['0101', '0105', '0120'],
      capabilityInconclusive: true,
      knownUnsupportedPids: ['04', '06', '07', '0B', '0C', '0D', '0E', '0F', '10', '11', '14', '15'],
    });

    expect(plan.requests.map(item => item.pid)).not.toContain('04');
    expect(plan.requests.map(item => item.pid)).not.toContain('0C');
    expect(plan.requests.map(item => item.pid)).toContain('01');
    expect(plan.requests.map(item => item.pid)).toContain('05');
    expect(plan.requests.some(item => Number.parseInt(item.pid, 16) > 0x20)).toBe(true);
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
    expect(decodePromotedMode01Observation(observed('10', [0x01, 0xF4]))?.signals[0].value).toBe(5);
    expect(decodePromotedMode01Observation(observed('2F', [0x80]))?.signals[0].value).toBeCloseTo(50.2, 1);
    expect(decodePromotedMode01Observation(observed('42', [0x36, 0xB0]))?.signals[0].value).toBe(14);
    expect(decodePromotedMode01Observation(observed('5C', [0x78]))?.signals[0].value).toBe(80);
    expect(decodePromotedMode01Observation(observed('63', [0x01, 0x90]))?.signals[0].value).toBe(400);
  });

  test('groups stored+pending P0301 on the same source into one ECU-confirmed concern and does not assert cause', () => {
    const concerns = buildDiagnosticConcerns([
      dtc('P0301', 'STORED', null),
      dtc('P0301', 'PENDING', null),
    ], []);
    expect(concerns).toHaveLength(1);
    expect(concerns[0].statuses).toEqual(expect.arrayContaining(['STORED','PENDING']));
    expect(concerns[0].sourceEndpointId).toBeNull();
    expect(concerns[0].eventConfidence).toBe('CONFIRMED_BY_ECU');
    expect(concerns[0].causeConfidence).toBe('INSUFFICIENT');
  });

  test('keeps the same DTC from two attributed ECUs as separate concerns', () => {
    const concerns = buildDiagnosticConcerns([
      dtc('P0301', 'STORED', 'ecu-a'),
      dtc('P0301', 'PENDING', 'ecu-b'),
    ], []);

    expect(concerns).toHaveLength(2);
    expect(concerns.map(item => item.sourceEndpointId).sort()).toEqual(['ecu-a', 'ecu-b']);
    expect(new Set(concerns.map(item => item.concernId)).size).toBe(2);
  });

  test('never attaches PID evidence from another endpoint to a concern', () => {
    const rpmA = decoded('0C', [0x10, 0xB0], 'ecu-a');
    const rpmB = decoded('0C', [0x11, 0x00], 'ecu-b');
    const concern = buildDiagnosticConcerns([
      dtc('P0301', 'STORED', 'ecu-a'),
    ], [rpmA, rpmB])[0];

    expect(concern.relatedEvidence).toEqual([rpmA]);
  });

  test('does not contextualize P0420 with P0301 reported by a different ECU', () => {
    const concerns = buildDiagnosticConcerns([
      dtc('P0301', 'STORED', 'ecu-a'),
      dtc('P0420', 'PENDING', 'ecu-b'),
    ], []);
    const catalyst = concerns.find(item => item.code === 'P0420');
    expect(catalyst?.limitations.some(item => item.includes('P0301'))).toBe(false);
  });

  test('contextualizes P0420 with same-source P0301 without asserting causality', () => {
    const concerns = buildDiagnosticConcerns([
      dtc('P0301', 'STORED', 'ecu-a'),
      dtc('P0420', 'PENDING', 'ecu-a'),
    ], []);
    const catalyst = concerns.find(item => item.code === 'P0420');
    expect(catalyst?.limitations.some(item => item.includes('same source'))).toBe(true);
    expect(catalyst?.causeConfidence).toBe('INSUFFICIENT');
  });

  test('retains syntactically valid unknown DTCs rather than rejecting them', () => {
    const unknown = resolveDtcKnowledge('U0123');
    expect(unknown?.code).toBe('U0123');
    expect(unknown?.canonicalMeaning).toBeUndefined();
  });
});
