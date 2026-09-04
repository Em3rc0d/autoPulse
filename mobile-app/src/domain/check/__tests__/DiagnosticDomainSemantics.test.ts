import {
  createDiagnosticReport,
  diagnosticTroubleCodeFamily,
  DiagnosticConcern,
  DiagnosticCoverage,
  DiagnosticScan,
  DiagnosticTroubleCode,
  hasCompleteDtcCoverage,
} from '..';

const stored: DiagnosticTroubleCode = {
  observationId: 'dtc-stored', code: 'P0301', family: 'POWERTRAIN', namespace: 'GENERIC',
  status: 'STORED', sourceEndpointId: 'ecu-1', evidenceIds: ['e-stored'], observedAt: 10,
};
const pending: DiagnosticTroubleCode = {
  ...stored, observationId: 'dtc-pending', status: 'PENDING', evidenceIds: ['e-pending'],
};

const scan: DiagnosticScan = {
  scanId: 'scan-1', state: 'COMPLETE', startedAt: 1, endedAt: 20, protocol: 'UNKNOWN',
  endpointAttribution: 'PARTIAL', endpoints: [], troubleCodes: [stored, pending], readiness: [],
  freezeFrames: [], monitorResults: [], evidenceFacts: [], evidenceRelations: [], limitations: [],
};

const coverage: DiagnosticCoverage = {
  discoveredEndpointIds: ['ecu-1'], scannedEndpointIds: ['ecu-1'], availableEvidenceFamilies: ['DTC'],
  services: [
    { endpointId: 'ecu-1', service: '03', outcome: 'COMPLETE' },
    { endpointId: 'ecu-1', service: '07', outcome: 'COMPLETE' },
    { endpointId: 'ecu-1', service: '0A', outcome: 'UNSUPPORTED' },
  ], limitations: ['Permanent DTC service was unsupported'],
};

describe('Check domain semantics', () => {
  it('groups the same code across statuses without losing observations', () => {
    const concern: DiagnosticConcern = {
      concernId: 'concern-1', category: 'COMBUSTION',
      dtcObservationIds: [stored.observationId, pending.observationId],
      supportingEvidenceIds: ['e-stored', 'e-pending'], contradictingEvidenceIds: [], unavailableEvidenceIds: [],
      eventConfidence: 'CONFIRMED_BY_ECU', conditionConfidence: 'MODERATE', causeGroups: [], limitations: [],
    };
    expect(new Set(concern.dtcObservationIds)).toEqual(new Set(['dtc-stored', 'dtc-pending']));
    expect(scan.troubleCodes.map(item => item.status)).toEqual(['STORED', 'PENDING']);
  });

  it('retains unattributed DTC evidence and unknown endpoint semantics', () => {
    expect({ ...stored, sourceEndpointId: null }.sourceEndpointId).toBeNull();
    expect(scan.protocol).toBe('UNKNOWN');
  });

  it('does not count unsupported service coverage as complete', () => {
    expect(hasCompleteDtcCoverage(coverage, ['03', '07'])).toBe(true);
    expect(hasCompleteDtcCoverage(coverage, ['03', '07', '0A'])).toBe(false);
  });

  it('keeps readiness incompletion separate from failure semantics', () => {
    const monitor = {
      monitorId: 'catalyst', supported: true as const, completion: 'INCOMPLETE' as const,
      readinessState: 'NOT_READY' as const,
    };
    expect(monitor.readinessState).toBe('NOT_READY');
    expect(monitor).not.toHaveProperty('failed');
  });

  it('keeps P/B/C/U family decoding deterministic', () => {
    expect(diagnosticTroubleCodeFamily('P0301')).toBe('POWERTRAIN');
    expect(diagnosticTroubleCodeFamily('B0001')).toBe('BODY');
    expect(diagnosticTroubleCodeFamily('C0035')).toBe('CHASSIS');
    expect(diagnosticTroubleCodeFamily('U0100')).toBe('NETWORK');
  });

  it('seals a deeply immutable terminal report with all version axes', () => {
    const inputScan = { ...scan, limitations: ['coverage bounded'] };
    const report = createDiagnosticReport({
      reportId: 'report-1', scan: inputScan, coverage, concerns: [], evidenceHash: 'sha256:test', sealedAt: 21,
      versions: {
        scanSchemaVersion: '1', diagnosticEngineVersion: 'mk3', decoderCatalogVersion: '1',
        dtcKnowledgeVersion: '1', correlationRulesVersion: '1',
      },
    });
    inputScan.limitations.push('late mutation');
    expect(report.scan.limitations).toEqual(['coverage bounded']);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.scan.limitations)).toBe(true);
  });

  it('refuses to seal an active scan or an unversioned report', () => {
    expect(() => createDiagnosticReport({
      reportId: 'report-active', scan: { ...scan, state: 'SCANNING_DTC' }, coverage,
      evidenceHash: 'hash', sealedAt: 20,
      versions: {
        scanSchemaVersion: '1', diagnosticEngineVersion: 'mk3', decoderCatalogVersion: '1',
        dtcKnowledgeVersion: '1', correlationRulesVersion: '1',
      },
    })).toThrow('non-terminal');

    expect(() => createDiagnosticReport({
      reportId: 'report-unversioned', scan, coverage, evidenceHash: 'hash', sealedAt: 20,
      versions: {
        scanSchemaVersion: '1', diagnosticEngineVersion: '', decoderCatalogVersion: '1',
        dtcKnowledgeVersion: '1', correlationRulesVersion: '1',
      },
    })).toThrow('diagnosticEngineVersion');
  });
});
