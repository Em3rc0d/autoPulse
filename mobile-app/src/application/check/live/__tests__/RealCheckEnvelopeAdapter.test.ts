import type { CommandResult } from '../../../../infrastructure/ble/real/pipeline/types';
import type { PlannedDiagnosticRequest } from '../../planner/DiagnosticScanPlanner';
import { adaptRealCommandResultToReceipt } from '../RealCheckEnvelopeAdapter';
import { diagnosticProtocolFromElmEvidence } from '../CheckPhysicalPilot';

const request: PlannedDiagnosticRequest = {
  planRequestId: 'plan:request:0',
  planId: 'plan',
  ordinal: 0,
  descriptorId: 'check-core-mode03-stored-dtc',
  semanticId: 'check.obd.mode03.stored-dtc',
  required: true,
  registryVersion: 'check-core-descriptors/v1',
  safetyPolicyVersion: 'check-command-safety/v2',
  parserContractId: 'check.dtc-service/v1',
  descriptorProvenance: 'fixture',
  stage: 'DTC_CORE',
  service: '03',
  expectedResponseService: '43',
  supportedProtocols: ['ISO_14230_KWP'],
  targetEndpointId: null,
  evidenceTraceId: 'trace',
  rationaleEvidenceIds: [],
  executionMode: 'SERIAL_ONLY',
};

function result(candidateHexLines: string[], status: CommandResult['status'] = 'SUCCESS_RAW'): CommandResult {
  return {
    request: { id: 'r', command: '03', family: 'OBD_MODE_03', expectedService: '43', timeoutMs: 1000 },
    rawResponse: {
      fragments: [],
      accumulatedText: candidateHexLines.join('\r'),
      completionReason: 'PROMPT_RECEIVED',
      startedAt: 1,
      finishedAt: 4,
      latencyMs: 3,
    },
    normalizedResponse: {
      rawText: candidateHexLines.join('\r'),
      normalizedText: candidateHexLines.join('\n'),
      echoLines: [],
      statusLines: [],
      candidateHexLines,
      unknownLines: [],
      promptDetected: true,
    },
    classifiedLines: [],
    obdFrames: [],
    negativeResponses: [],
    decodedValues: [],
    status,
    errors: [],
    latencyMs: 3,
  };
}

describe('RealCheckEnvelopeAdapter', () => {
  it('preserves a header-off legacy DTC payload for the service-aware parser', () => {
    const receipt = adaptRealCommandResultToReceipt(request, 'ISO_14230_KWP', result(['4301330000']), 100, 'physical-fixture');
    expect(receipt.startedAt).toBe(100);
    expect(receipt.finishedAt).toBe(103);
    expect(receipt.responses).toHaveLength(1);
    const envelope = receipt.responses[0].envelope;
    expect(envelope.kind).toBe('POSITIVE_RESPONSE');
    if (envelope.kind === 'POSITIVE_RESPONSE') {
      expect(envelope.responseService).toBe('43');
      expect(envelope.payload).toEqual([0x01, 0x33, 0x00, 0x00]);
      expect(envelope.sourceEndpointId).toBeNull();
    }
  });

  it('refuses to guess through an unexpected header prefix', () => {
    const receipt = adaptRealCommandResultToReceipt(request, 'ISO_14230_KWP', result(['486B104301330000']), 100, 'physical-fixture');
    expect(receipt.responses[0].envelope.kind).toBe('INVALID_RESPONSE');
  });

  it('keeps NO_DATA distinct from a zero-code positive response', () => {
    const receipt = adaptRealCommandResultToReceipt(request, 'ISO_14230_KWP', result([], 'NO_DATA'), 100, 'physical-fixture');
    expect(receipt.responses[0].envelope.kind).toBe('NO_DATA');
  });

  it('preserves NRC 78 as a negative response for bounded pending semantics', () => {
    const receipt = adaptRealCommandResultToReceipt(request, 'ISO_14230_KWP', result(['7F0378']), 100, 'physical-fixture');
    const envelope = receipt.responses[0].envelope;
    expect(envelope.kind).toBe('NEGATIVE_RESPONSE');
    if (envelope.kind === 'NEGATIVE_RESPONSE') expect(envelope.negativeResponseCode).toBe('78');
  });
});

describe('physical Check protocol evidence', () => {
  it.each([
    ['4', 'ISO_14230_KWP'],
    ['A5', 'ISO_14230_KWP'],
    ['3', 'ISO_9141_2'],
    ['6', 'ISO_15765_CAN'],
    ['SAE J1850 PWM', 'SAE_J1850_PWM'],
    ['ISO 15765-4 CAN', 'ISO_15765_CAN'],
  ] as const)('maps %s to %s', (raw, expected) => {
    expect(diagnosticProtocolFromElmEvidence(raw)).toBe(expected);
  });

  it('fails closed for unresolved automatic evidence', () => {
    expect(diagnosticProtocolFromElmEvidence('A0')).toBe('UNKNOWN');
    expect(diagnosticProtocolFromElmEvidence('AUTO')).toBe('UNKNOWN');
  });
});
