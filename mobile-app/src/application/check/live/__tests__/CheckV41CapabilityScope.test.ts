import { capabilityPlanningScopeFromBase } from '../CheckPhysicalPilotV4';
import type { CheckCapabilityAssessment, CheckCapabilityObservation } from '../CheckPhysicalPilot';

function base(capabilityAssessment: CheckCapabilityAssessment) {
  return { capabilityAssessment };
}

const observation = (
  observationIndex: number,
  advertisedPids: readonly string[],
  sourceEndpointId: string | null = null,
  outcome: CheckCapabilityObservation['outcome'] = 'VALID',
): CheckCapabilityObservation => Object.freeze({
  observationIndex,
  sourceEndpointId,
  outcome,
  command: '0100',
  advertisedPids: Object.freeze([...advertisedPids]),
  ...(outcome === 'INVALID' ? { limitation: 'fixture invalid capability response' } : {}),
});

describe('CHECK v5 capability planning scope', () => {
  it('uses one response without changing its response-scoped advertised set', () => {
    const assessment: CheckCapabilityAssessment = Object.freeze({
      state: 'ADVERTISED',
      observations: Object.freeze([observation(0, ['0101', '0105'], null)]),
      validObservationCount: 1,
      invalidObservationCount: 0,
      unattributed: true,
      detail: 'fixture',
    });

    const scoped = capabilityPlanningScopeFromBase(base(assessment));
    expect(scoped).toEqual(expect.objectContaining({
      advertisedPids: ['0101', '0105'],
      capabilityInconclusive: false,
      limitation: null,
    }));
    expect(scoped.knownUnsupportedPids).toContain('02');
    expect(scoped.knownUnsupportedPids).not.toContain('01');
    expect(scoped.knownUnsupportedPids).not.toContain('05');
  });

  it('keeps a single valid empty bitmap inconclusive for bounded direct probing', () => {
    const assessment: CheckCapabilityAssessment = Object.freeze({
      state: 'EMPTY_BITMAP',
      observations: Object.freeze([observation(0, [], null)]),
      validObservationCount: 1,
      invalidObservationCount: 0,
      unattributed: true,
      detail: 'fixture',
    });

    expect(capabilityPlanningScopeFromBase(base(assessment))).toEqual({
      advertisedPids: [],
      knownUnsupportedPids: [],
      capabilityInconclusive: true,
      limitation: null,
    });
  });

  it('never unions advertised PIDs from two responders', () => {
    const assessment: CheckCapabilityAssessment = Object.freeze({
      state: 'ADVERTISED',
      observations: Object.freeze([
        observation(0, ['0101', '0105'], 'ecu-a'),
        observation(1, ['010C', '010D'], 'ecu-b'),
      ]),
      validObservationCount: 2,
      invalidObservationCount: 0,
      unattributed: false,
      detail: 'fixture',
    });

    const scoped = capabilityPlanningScopeFromBase(base(assessment));
    expect(scoped.advertisedPids).toEqual([]);
    expect(scoped.knownUnsupportedPids).toEqual([]);
    expect(scoped.capabilityInconclusive).toBe(true);
    expect(scoped.limitation).toBe('v5-capability-scope:MULTI_RESPONSE_NO_GLOBAL_PID_UNION');
  });

  it('also refuses a partial multi-response set rather than trusting the sole valid responder globally', () => {
    const assessment: CheckCapabilityAssessment = Object.freeze({
      state: 'ADVERTISED',
      observations: Object.freeze([
        observation(0, ['0101', '0105'], 'ecu-a'),
        observation(1, [], 'ecu-b', 'INVALID'),
      ]),
      validObservationCount: 1,
      invalidObservationCount: 1,
      unattributed: false,
      detail: 'fixture',
    });

    const scoped = capabilityPlanningScopeFromBase(base(assessment));
    expect(scoped.advertisedPids).toEqual([]);
    expect(scoped.knownUnsupportedPids).toEqual([]);
    expect(scoped.capabilityInconclusive).toBe(true);
  });

  it('allows bounded probing beyond an advertised continuation without re-probing known-unsupported 01-20 PIDs', () => {
    const assessment: CheckCapabilityAssessment = Object.freeze({
      state: 'ADVERTISED',
      observations: Object.freeze([observation(0, ['0101', '0105', '0120'], null)]),
      validObservationCount: 1,
      invalidObservationCount: 0,
      unattributed: true,
      detail: 'fixture',
    });

    const scoped = capabilityPlanningScopeFromBase(base(assessment));
    expect(scoped.capabilityInconclusive).toBe(true);
    expect(scoped.limitation).toBe('v5-capability-scope:CONTINUATION_ADVERTISED_BUT_NOT_ENDPOINT_TARGETED');
    expect(scoped.knownUnsupportedPids).toContain('04');
    expect(scoped.knownUnsupportedPids).not.toContain('01');
    expect(scoped.knownUnsupportedPids).not.toContain('05');
    expect(scoped.knownUnsupportedPids).not.toContain('20');
  });
});
