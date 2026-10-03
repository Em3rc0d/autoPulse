import {
  createDiagnosticReport,
  diagnosticTroubleCodeFamily,
  DiagnosticConcern,
  DiagnosticCoverage,
  DiagnosticFreezeFrame,
  DiagnosticMonitorResult,
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
  endpointAttribution: 'ATTRIBUTED',
  endpoints: [{
    endpointId: 'ecu-1', protocol: 'UNKNOWN', role: 'UNKNOWN', roleConfidence: 'INSUFFICIENT',
    identityEvidence: [], supportedServices: [], supportedPids: [], scanStatus: 'COMPLETE',
  }],
  troubleCodes: [stored, pending], readiness: [], freezeFrames: [], monitorResults: [],
  evidenceFacts: [
    {
      evidenceId: 'e-stored', sourceType: 'DTC', sourceEndpointId: 'ecu-1', observedAt: 10,
      value: 'P0301', quality: 'CONFIRMED_BY_ECU', provenance: 'fixture:stored',
    },
    {
      evidenceId: 'e-pending', sourceType: 'DTC', sourceEndpointId: 'ecu-1', observedAt: 10,
      value: 'P0301', quality: 'CONFIRMED_BY_ECU', provenance: 'fixture:pending',
    },
  ],
  evidenceRelations: [], limitations: [],
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

  it('does not count unsupported or discovered-but-unscanned coverage as complete', () => {
    expect(hasCompleteDtcCoverage(coverage, ['03', '07'])).toBe(true);
    expect(hasCompleteDtcCoverage(coverage, ['03', '07', '0A'])).toBe(false);

    const partiallyScanned: DiagnosticCoverage = {
      ...coverage,
      discoveredEndpointIds: ['ecu-1', 'ecu-2'],
      scannedEndpointIds: ['ecu-1'],
    };
    expect(hasCompleteDtcCoverage(partiallyScanned, ['03', '07'])).toBe(false);
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

  it('keeps DTC human meaning coupled to provenance', () => {
    const described: DiagnosticTroubleCode = {
      ...stored,
      canonicalMeaning: 'Cylinder 1 misfire detected',
      meaningProvenance: { sourceId: 'verified-dtc-catalog', sourceVersion: '1' },
    };
    expect(described.canonicalMeaning).toBe('Cylinder 1 misfire detected');
    expect(described.meaningProvenance.sourceId).toBe('verified-dtc-catalog');
  });

  it('preserves raw Mode 06 evidence independently from decoded meaning', () => {
    const result: DiagnosticMonitorResult = {
      monitorResultId: 'm06-1', sourceEndpointId: 'ecu-1', monitorId: 'MID-01',
      rawValue: [0x12, 0x34], outcome: 'UNKNOWN', provenance: 'fixture:mode06-raw',
      evidenceIds: ['e-stored'], observedAt: 12,
    };
    expect(result.rawValue).toEqual([0x12, 0x34]);
    expect(result.meaning).toBeUndefined();
  });

  it('preserves sub-signal identity for compound freeze-frame PIDs', () => {
    const frame: DiagnosticFreezeFrame = {
      freezeFrameId: 'ff-1', frameNumber: 0, state: 'FRAME_OBSERVED', sourceEndpointId: 'ecu-1',
      capturedAt: 'ECU_EVENT_TIME_UNKNOWN', observedAt: 13, evidenceIds: ['e-stored'],
      values: [
        { pid: '14', signalId: 'OxySensor1_Volt', value: 0.72, unit: 'V' },
        { pid: '14', signalId: 'OxySensor1_STFT', value: 3.1, unit: '%' },
      ],
    };
    expect(frame.values.map(value => value.signalId)).toEqual(['OxySensor1_Volt', 'OxySensor1_STFT']);
  });

  it('seals a deeply immutable terminal report with all version axes', () => {
    const inputScan = { ...scan, limitations: ['coverage bounded'] };
    const report = createDiagnosticReport({
      reportId: 'report-1', scan: inputScan, coverage, concerns: [], evidenceHash: 'a'.repeat(64), sealedAt: 21,
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
      evidenceHash: 'a'.repeat(64), sealedAt: 20,
      versions: {
        scanSchemaVersion: '1', diagnosticEngineVersion: 'mk3', decoderCatalogVersion: '1',
        dtcKnowledgeVersion: '1', correlationRulesVersion: '1',
      },
    })).toThrow('non-terminal');

    expect(() => createDiagnosticReport({
      reportId: 'report-unversioned', scan, coverage, evidenceHash: 'b'.repeat(64), sealedAt: 20,
      versions: {
        scanSchemaVersion: '1', diagnosticEngineVersion: '', decoderCatalogVersion: '1',
        dtcKnowledgeVersion: '1', correlationRulesVersion: '1',
      },
    })).toThrow('diagnosticEngineVersion');
  });
});
