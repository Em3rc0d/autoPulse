import { capabilityPlanningScopeFromBase } from '../CheckPhysicalPilotV4';
import type { CheckCapabilityAssessment } from '../CheckPhysicalPilot';

function base(capabilityAssessment: CheckCapabilityAssessment) {
  return { capabilityAssessment };
}

const observation = (
  observationIndex: number,
  advertisedPids: readonly string[],
  sourceEndpointId: string | null = null,
  outcome: 'VALID' | 'NO_DATA' = 'VALID',
) => Object.freeze({
  observationIndex,
  sourceEndpointId,
  outcome,
  command: '0100',
  advertisedPids: Object.freeze([...advertisedPids]),
});

describe('CHECK v4.1 capability planning scope', () => {
  it('uses one response without changing its response-scoped advertised set', () => {
    const assessment: CheckCapabilityAssessment = Object.freeze({
      state: 'ADVERTISED',
      observations: Object.freeze([observation(0, ['0101', '0105'], null)]),
      validObservationCount: 1,
      invalidObservationCount: 0,
      unattributed: true,
      detail: 'fixture',
    });

    expect(capabilityPlanningScopeFromBase(base(assessment))).toEqual({
      advertisedPids: ['0101', '0105'],
      capabilityInconclusive: false,
      limitation: null,
    });
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
    expect(scoped.capabilityInconclusive).toBe(true);
    expect(scoped.limitation).toBe('v4.1-capability-scope:MULTI_RESPONSE_NO_GLOBAL_PID_UNION');
  });

  it('also refuses a partial multi-response set rather than trusting the sole valid responder globally', () => {
    const assessment: CheckCapabilityAssessment = Object.freeze({
      state: 'ADVERTISED',
      observations: Object.freeze([
        observation(0, ['0101', '0105'], 'ecu-a'),
        observation(1, [], 'ecu-b', 'NO_DATA'),
      ]),
      validObservationCount: 1,
      invalidObservationCount: 1,
      unattributed: false,
      detail: 'fixture',
    });

    const scoped = capabilityPlanningScopeFromBase(base(assessment));
    expect(scoped.advertisedPids).toEqual([]);
    expect(scoped.capabilityInconclusive).toBe(true);
  });
});
