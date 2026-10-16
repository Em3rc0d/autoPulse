import type { DtcServiceParseResult } from '../../parsers/DtcServiceParser';
import type { Mode01DirectObservationResult } from '../../parsers/Mode01DirectObservationParser';
import {
  presentCapabilityAssessment,
  presentCheckScanState,
  presentDirectMode01Observation,
  presentDtcResult,
  technicalDtcOutcome,
} from '../CheckPilotPresentation';
import { assessMode01CapabilityEvidence } from '../CheckPhysicalPilot';

function dtc(outcome: DtcServiceParseResult['outcome'], negativeResponseCode?: string): DtcServiceParseResult {
  return {
    requestService: '03',
    expectedResponseService: '43',
    status: 'STORED',
    outcome,
    sourceEndpointId: null,
    protocol: 'ISO_14230_KWP',
    codes: [],
    rawPayload: [],
    negativeResponseCode,
    provenance: 'fixture',
    observedAt: 1,
  };
}

function direct(outcome: Mode01DirectObservationResult['outcome']): Mode01DirectObservationResult {
  return {
    requestPid: '0C',
    sourceEndpointId: null,
    protocol: 'ISO_14230_KWP',
    outcome,
    dataBytes: outcome === 'OBSERVED_DIRECTLY' ? [0x1A, 0xF8] : [],
    rawPayload: outcome === 'OBSERVED_DIRECTLY' ? [0x0C, 0x1A, 0xF8] : [],
    provenance: 'fixture',
    observedAt: 1,
  };
}

describe('Check pilot presentation', () => {
  it('does not expose LIMITED as the primary user-facing label', () => {
    expect(presentCheckScanState('LIMITED')).toEqual(expect.objectContaining({
      label: 'Partial diagnostic coverage',
      tone: 'ATTENTION',
    }));
  });

  it('presents zero DTCs as a scoped ECU response, not whole-vehicle health', () => {
    const copy = presentDtcResult(dtc('SUCCESS_ZERO_CODES'));
    expect(copy.label).toBe('No codes reported');
    expect(copy.detail).toContain('this scanned response');
    expect(copy.detail.toLowerCase()).not.toContain('healthy');
  });

  it('moves negative-response protocol detail behind technical presentation', () => {
    const result = dtc('NEGATIVE_RESPONSE', '11');
    expect(presentDtcResult(result).label).toBe('Service unavailable');
    expect(technicalDtcOutcome(result)).toBe('NEGATIVE_RESPONSE · NRC 11');
  });

  it('labels direct Mode 01 success as direct observation, never advertised support', () => {
    const copy = presentDirectMode01Observation(direct('OBSERVED_DIRECTLY'));
    expect(copy.label).toBe('Observed directly');
    expect(copy.detail).toContain('direct observation');
    expect(copy.detail).toContain('not ECU-advertised support');
  });

  it('does not turn direct NO_DATA into an unsupported-PID claim', () => {
    const copy = presentDirectMode01Observation(direct('NO_DATA'));
    expect(copy.label).toBe('No data returned');
    expect(copy.detail).toContain('did not return usable data');
    expect(copy.detail.toLowerCase()).not.toContain('unsupported');
  });
});

describe('Mode 01 capability assessment', () => {
  it('does not display a valid empty bitmap as vehicle-wide unsupported PIDs', () => {
    const assessment = assessMode01CapabilityEvidence([{
      outcome: 'VALID',
      command: '0100',
      advertisedPids: [],
      continuationCommand: null,
      rawPayload: [0, 0, 0, 0],
      sourceEndpointId: null,
      protocol: 'ISO_14230_KWP',
      provenance: 'fixture',
      observedAt: 1,
    }]);

    expect(assessment.state).toBe('EMPTY_BITMAP');
    const copy = presentCapabilityAssessment(assessment);
    expect(copy.label).toBe('Capability map inconclusive');
    expect(copy.detail).toContain('does not convert');
  });

  it('keeps advertised PID maps separate for different responders', () => {
    const assessment = assessMode01CapabilityEvidence([
      {
        outcome: 'VALID', command: '0100', advertisedPids: ['0105', '010C'], continuationCommand: null,
        rawPayload: [0, 0, 0, 0], sourceEndpointId: 'ecu-a', protocol: 'ISO_15765_CAN', provenance: 'a', observedAt: 1,
      },
      {
        outcome: 'VALID', command: '0100', advertisedPids: ['010C', '010D'], continuationCommand: null,
        rawPayload: [0, 0, 0, 0], sourceEndpointId: 'ecu-b', protocol: 'ISO_15765_CAN', provenance: 'b', observedAt: 1,
      },
    ]);

    expect(assessment.state).toBe('ADVERTISED');
    expect(assessment.observations).toEqual([
      expect.objectContaining({ sourceEndpointId: 'ecu-a', advertisedPids: ['0105', '010C'] }),
      expect.objectContaining({ sourceEndpointId: 'ecu-b', advertisedPids: ['010C', '010D'] }),
    ]);
    expect(assessment.unattributed).toBe(false);
    expect(presentCapabilityAssessment(assessment).detail).toContain('vehicle-global PID union');
  });
});
