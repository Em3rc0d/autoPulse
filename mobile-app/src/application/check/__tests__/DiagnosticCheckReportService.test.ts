jest.mock('../../../infrastructure/database/product/uuidv7', () => ({
  ProductIdGenerator: { generate: jest.fn(() => 'check-0001') },
}));

import { buildDiagnosticCheckSnapshot } from '../DiagnosticCheckReport';
import { DiagnosticCheckReportService } from '../DiagnosticCheckReportService';

function pilotResult(): any {
  return {
    pilotVersion: 'check-physical-pilot/v4.1',
    protocol: 'ISO_14230_KWP',
    protocolEvidence: 'AUTO, ISO 14230-4',
    bootstrapStandardObdStatus: 'SUCCESS_DECODED',
    scanCommandCount: 4,
    directObservationCommandCount: 3,
    scan: {
      state: 'COMPLETE',
      usage: { commandsIssued: 4 },
      dtcResults: [{
        requestService: '03',
        expectedResponseService: '43',
        outcome: 'SUCCESS_WITH_CODES',
        status: 'STORED',
        sourceEndpointId: null,
        codes: [{ code: 'P0301' }],
        rawPayload: [3, 1],
      }],
    },
    targetedEvidencePlan: {
      version: 'check-evidence-planner/v2',
      requests: [{ pid: '01' }, { pid: '06' }],
    },
    targetedEvidenceScan: { state: 'COMPLETE', usage: { commandsIssued: 2 } },
    capabilityAssessment: {
      state: 'ADVERTISED',
      observations: [],
      validObservationCount: 1,
      invalidObservationCount: 0,
      unattributed: true,
      detail: 'evidence',
    },
    readiness: {
      milOn: true,
      confirmedDtcCount: 1,
      monitors: [{ id: 'misfire', label: 'Misfire', state: 'READY' }],
    },
    decodedPidEvidence: [{
      pid: '06',
      requestId: '0106',
      name: 'STFT Bank 1',
      sourceEndpointId: null,
      signals: [{ key: 'stft_b1', label: 'STFT Bank 1', value: 1.5, unit: '%' }],
      observedAt: 1000,
      provenance: 'test',
    }],
    concerns: [{
      concernId: 'dtc:P0301:UNATTRIBUTED',
      code: 'P0301',
      sourceEndpointId: null,
      title: 'Cylinder 1 misfire detected',
      statuses: ['STORED'],
      families: ['COMBUSTION'],
      eventConfidence: 'CONFIRMED_BY_ECU',
      causeConfidence: 'INSUFFICIENT',
      relatedEvidence: [],
      possibleSystemGroups: ['Ignition / combustion'],
      limitations: ['Root cause not established'],
      knowledge: { code: 'P0301', family: 'POWERTRAIN', namespace: 'SAE', concernFamilies: ['COMBUSTION'], provenance: 'test' },
    }],
    rawEvidence: [{
      phase: 'SCAN',
      semanticId: 'check.obd.mode03.stored-dtc',
      service: '03',
      sourceEndpointId: null,
      responseKind: 'POSITIVE_RESPONSE',
      rawText: '43 03 01',
      observedResponseBytes: 3,
    }],
    limitations: ['Read-only standard OBD evidence only'],
  };
}

describe('DiagnosticCheckReportService', () => {
  it('builds a direct Check snapshot with diagnostic evidence preserved', () => {
    const snapshot = buildDiagnosticCheckSnapshot({
      checkId: 'check-1',
      workspaceId: 'ws1',
      vehicle: { vehicleId: 'veh1', alias: 'Test vehicle' },
      result: pilotResult(),
      generatedAt: 1234,
    });

    expect(snapshot.schema).toBe('autopulse.diagnostic-check/v1');
    expect(snapshot.execution.targetedCommandsSelected).toBe(2);
    expect(snapshot.execution.targetedCommandsIssued).toBe(2);
    expect(snapshot.dtcResults[0].codes[0].code).toBe('P0301');
    expect(snapshot.readiness?.confirmedDtcCount).toBe(1);
    expect(snapshot.pidEvidence[0].pid).toBe('06');
    expect(snapshot.concerns[0].causeConfidence).toBe('INSUFFICIENT');
    expect(snapshot.rawEvidence[0].rawText).toBe('43 03 01');
  });

  it('persists, reloads and verifies the immutable snapshot', async () => {
    const storage = new Map<string, any>();
    const repository: any = {
      saveImmutable: jest.fn(async (value: any) => {
        storage.set(value.id, value);
        return value;
      }),
      getById: jest.fn(async (_workspaceId: string, id: string) => storage.get(id) ?? null),
    };
    const service = new DiagnosticCheckReportService(repository);

    const created = await service.create({
      workspaceId: 'ws1',
      vehicle: { vehicleId: 'veh1', alias: 'Test vehicle' },
      result: pilotResult(),
    });
    const reopened = await service.load('ws1', created.snapshot.checkId);

    expect(created.sha256).toHaveLength(64);
    expect(reopened?.verified).toBe(true);
    expect(reopened?.sha256).toBe(created.sha256);
    expect(reopened?.snapshot.dtcResults[0].codes[0].code).toBe('P0301');
  });

  it('rejects a tampered persisted snapshot', async () => {
    const storage = new Map<string, any>();
    const repository: any = {
      saveImmutable: jest.fn(async (value: any) => {
        storage.set(value.id, value);
        return value;
      }),
      getById: jest.fn(async (_workspaceId: string, id: string) => storage.get(id) ?? null),
    };
    const service = new DiagnosticCheckReportService(repository);
    const created = await service.create({
      workspaceId: 'ws1',
      vehicle: { vehicleId: 'veh1' },
      result: pilotResult(),
    });
    const stored = storage.get(created.snapshot.checkId);
    stored.snapshotJson = stored.snapshotJson.replace('P0301', 'P9999');

    await expect(service.load('ws1', created.snapshot.checkId))
      .rejects.toThrow('DIAGNOSTIC_CHECK_INTEGRITY_MISMATCH');
  });
});
