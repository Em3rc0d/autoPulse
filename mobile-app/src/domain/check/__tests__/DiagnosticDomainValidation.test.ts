import {
  assertValidDiagnosticConcerns,
  assertValidDiagnosticCoverage,
  assertValidDiagnosticScan,
  createDiagnosticReport,
  DiagnosticConcern,
  DiagnosticCoverage,
  DiagnosticScan,
} from '..';

const versions = {
  scanSchemaVersion: '1',
  diagnosticEngineVersion: 'check-core-test',
  decoderCatalogVersion: '1',
  dtcKnowledgeVersion: '1',
  correlationRulesVersion: '1',
} as const;

function validScan(): DiagnosticScan {
  return {
    scanId: 'scan-valid',
    state: 'COMPLETE',
    startedAt: 100,
    endedAt: 200,
    protocol: 'ISO_14230_KWP',
    endpointAttribution: 'ATTRIBUTED',
    endpoints: [{
      endpointId: 'ecu-1',
      sourceAddress: 'RESPONDER-1',
      protocol: 'ISO_14230_KWP',
      role: 'UNKNOWN',
      roleConfidence: 'INSUFFICIENT',
      identityEvidence: [],
      supportedServices: [{
        service: '03', stage: 'OBSERVED', outcome: 'OBSERVED', observedAt: 110, provenance: 'fixture:service03',
      }],
      supportedPids: [],
      scanStatus: 'COMPLETE',
    }],
    troubleCodes: [{
      observationId: 'dtc-1', code: 'P0133', family: 'POWERTRAIN', namespace: 'GENERIC', status: 'STORED',
      sourceEndpointId: 'ecu-1', evidenceIds: ['e-dtc'], observedAt: 120,
    }],
    readiness: [{
      readinessId: 'ready-1', sourceEndpointId: 'ecu-1', cycle: 'SINCE_DTC_CLEAR', milState: 'OFF', confirmedDtcCount: 1,
      monitors: [{ monitorId: 'misfire', supported: true, completion: 'COMPLETE', readinessState: 'READY' }],
      evidenceIds: ['e-ready'], observedAt: 130,
    }],
    freezeFrames: [{
      freezeFrameId: 'ff-1', frameNumber: 0, state: 'FRAME_OBSERVED', sourceEndpointId: 'ecu-1',
      relatedDtcObservationId: 'dtc-1', capturedAt: 'ECU_EVENT_TIME_UNKNOWN', observedAt: 140,
      values: [{ pid: '0C', signalId: 'EngineRPM', value: 1000, unit: 'rpm' }], evidenceIds: ['e-ff'],
    }],
    monitorResults: [{
      monitorResultId: 'm06-1', sourceEndpointId: 'ecu-1', monitorId: 'MID-01', rawValue: [1, 2],
      testValue: 1, minimumLimit: 0, maximumLimit: 2, unit: 'raw', outcome: 'WITHIN_LIMITS',
      provenance: 'fixture:mode06', evidenceIds: ['e-m06'], observedAt: 150,
    }],
    evidenceFacts: [
      { evidenceId: 'e-dtc', sourceType: 'DTC', sourceEndpointId: 'ecu-1', observedAt: 120, value: 'P0133', quality: 'CONFIRMED_BY_ECU', provenance: 'fixture:dtc' },
      { evidenceId: 'e-ready', sourceType: 'READINESS', sourceEndpointId: 'ecu-1', observedAt: 130, value: 'READY', quality: 'CONFIRMED_BY_ECU', provenance: 'fixture:readiness' },
      { evidenceId: 'e-ff', sourceType: 'FREEZE_FRAME', sourceEndpointId: 'ecu-1', observedAt: 140, value: 1000, unit: 'rpm', quality: 'CONFIRMED_BY_ECU', provenance: 'fixture:freeze-frame' },
      { evidenceId: 'e-m06', sourceType: 'MODE06', sourceEndpointId: 'ecu-1', observedAt: 150, value: 1, unit: 'raw', quality: 'CONFIRMED_BY_ECU', provenance: 'fixture:mode06' },
    ],
    evidenceRelations: [{
      relationId: 'rel-1', fromEvidenceId: 'e-ff', toEvidenceId: 'e-dtc', relation: 'CONTEXTUALIZES',
      ruleId: 'rule-ff-dtc', ruleVersion: '1',
    }],
    limitations: ['Standard OBD scope only'],
  };
}

function validCoverage(): DiagnosticCoverage {
  return {
    discoveredEndpointIds: ['ecu-1'], scannedEndpointIds: ['ecu-1'],
    services: [
      { endpointId: 'ecu-1', service: '03', outcome: 'COMPLETE' },
      { endpointId: 'ecu-1', service: '07', outcome: 'COMPLETE' },
    ],
    availableEvidenceFamilies: ['DTC', 'READINESS', 'FREEZE_FRAME', 'MODE06'],
    limitations: ['Enhanced modules not evaluated'],
  };
}

function validConcern(): DiagnosticConcern {
  return {
    concernId: 'concern-1', category: 'EMISSIONS', dtcObservationIds: ['dtc-1'],
    supportingEvidenceIds: ['e-dtc', 'e-ff'], contradictingEvidenceIds: [], unavailableEvidenceIds: [],
    interpretation: 'ECU-reported condition with freeze-frame context',
    eventConfidence: 'CONFIRMED_BY_ECU', conditionConfidence: 'STRONG',
    causeGroups: [{
      causeGroupId: 'cause-air-metering', label: 'Air metering', confidence: 'WEAK',
      supportingEvidenceIds: ['e-ff'], contradictingEvidenceIds: [], limitations: ['Cause not established'],
    }],
    limitations: ['Mechanical cause is not proven'],
  };
}

describe('CHECK core fail-closed domain validation', () => {
  it('accepts a referentially consistent terminal scan, coverage and concern graph', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticScan(scan)).not.toThrow();
    expect(() => assertValidDiagnosticCoverage(scan, validCoverage())).not.toThrow();
    expect(() => assertValidDiagnosticConcerns(scan, [validConcern()])).not.toThrow();
  });

  it('requires endedAt for every terminal scan and preserves chronology', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticScan({ ...scan, endedAt: undefined })).toThrow('requires endedAt');
    expect(() => assertValidDiagnosticScan({ ...scan, endedAt: 99 })).toThrow('precedes startedAt');
  });

  it('rejects duplicate endpoint and evidence identities', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticScan({ ...scan, endpoints: [...scan.endpoints, scan.endpoints[0]] })).toThrow('duplicate identifiers');
    expect(() => assertValidDiagnosticScan({ ...scan, evidenceFacts: [...scan.evidenceFacts, scan.evidenceFacts[0]] })).toThrow('duplicate identifiers');
  });

  it('rejects DTCs attributed to endpoints that were never discovered', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticScan({ ...scan, troubleCodes: [{ ...scan.troubleCodes[0], sourceEndpointId: 'ghost-ecu' }] })).toThrow('unknown endpoint ghost-ecu');
  });

  it('rejects malformed DTC identity or family mismatches', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticScan({ ...scan, troubleCodes: [{ ...scan.troubleCodes[0], code: 'PZZZZ' }] })).toThrow('Invalid OBD-II DTC');
    expect(() => assertValidDiagnosticScan({ ...scan, troubleCodes: [{ ...scan.troubleCodes[0], family: 'BODY' }] })).toThrow('family mismatch');
  });

  it('rejects dangling evidence references and dangling evidence relations', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticScan({ ...scan, troubleCodes: [{ ...scan.troubleCodes[0], evidenceIds: ['missing-evidence'] }] })).toThrow('unknown evidence missing-evidence');
    expect(() => assertValidDiagnosticScan({ ...scan, evidenceRelations: [{ ...scan.evidenceRelations[0], toEvidenceId: 'missing-evidence' }] })).toThrow('unknown toEvidenceId');
  });

  it('rejects self-relations and partially versioned correlation rules', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticScan({ ...scan, evidenceRelations: [{ ...scan.evidenceRelations[0], toEvidenceId: 'e-ff' }] })).toThrow('cannot self-reference');
    expect(() => assertValidDiagnosticScan({ ...scan, evidenceRelations: [{ ...scan.evidenceRelations[0], ruleVersion: undefined }] })).toThrow('must appear together');
  });

  it('does not allow attribution summaries to contradict observation-level truth', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticScan({ ...scan, endpointAttribution: 'PARTIAL' })).toThrow('requires both attributed and unattributed');
    expect(() => assertValidDiagnosticScan({ ...scan, endpointAttribution: 'UNATTRIBUTED' })).toThrow('contains attributed observations');
    expect(() => assertValidDiagnosticScan({
      ...scan, endpointAttribution: 'ATTRIBUTED', troubleCodes: [{ ...scan.troubleCodes[0], sourceEndpointId: null }],
    })).toThrow('contains unattributed observations');
  });

  it('keeps readiness support, applicability, completion and presentation state coherent', () => {
    const scan = validScan();
    const readiness = scan.readiness[0];
    expect(() => assertValidDiagnosticScan({
      ...scan,
      readiness: [{ ...readiness, monitors: [{ monitorId: 'catalyst', supported: false, completion: 'INCOMPLETE', readinessState: 'NOT_READY' }] }],
    })).toThrow('unsupported monitor must be NOT_APPLICABLE');
    expect(() => assertValidDiagnosticScan({
      ...scan,
      readiness: [{ ...readiness, monitors: [{ monitorId: 'catalyst', supported: false, completion: 'NOT_APPLICABLE', readinessState: 'NOT_READY' }] }],
    })).toThrow('unsupported monitor must be NOT_SUPPORTED');
    expect(() => assertValidDiagnosticScan({
      ...scan,
      readiness: [{ ...readiness, monitors: [{ monitorId: 'catalyst', supported: true, completion: 'INCOMPLETE', readinessState: 'READY' }] }],
    })).toThrow('incomplete supported monitor must be NOT_READY');
    expect(() => assertValidDiagnosticScan({
      ...scan,
      readiness: [{ ...readiness, monitors: [{ monitorId: 'catalyst', supported: 'UNKNOWN', completion: 'COMPLETE', readinessState: 'READY' }] }],
    })).toThrow('unknown support must remain UNKNOWN');
  });

  it('requires actual values only for FRAME_OBSERVED and valid DTC correlation', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticScan({ ...scan, freezeFrames: [{ ...scan.freezeFrames[0], values: [] }] })).toThrow('requires at least one value');
    expect(() => assertValidDiagnosticScan({ ...scan, freezeFrames: [{ ...scan.freezeFrames[0], relatedDtcObservationId: 'ghost-dtc' }] })).toThrow('unknown DTC ghost-dtc');
    expect(() => assertValidDiagnosticScan({
      ...scan,
      freezeFrames: [{ ...scan.freezeFrames[0], state: 'NO_DATA', values: [{ pid: '0C', value: 1000 }] }],
    })).toThrow('cannot carry decoded values');
  });

  it('rejects non-finite freeze-frame and evidence numeric values', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticScan({
      ...scan,
      freezeFrames: [{ ...scan.freezeFrames[0], values: [{ pid: '0C', value: Number.NaN }] }],
    })).toThrow('must be finite');
    expect(() => assertValidDiagnosticScan({
      ...scan,
      evidenceFacts: scan.evidenceFacts.map(item => item.evidenceId === 'e-ff' ? { ...item, value: Number.POSITIVE_INFINITY } : item),
    })).toThrow('must be finite');
  });

  it('requires Mode06 threshold claims to retain mathematically consistent measured limits', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticScan({ ...scan, monitorResults: [{ ...scan.monitorResults[0], testValue: undefined }] })).toThrow('requires testValue');
    expect(() => assertValidDiagnosticScan({ ...scan, monitorResults: [{ ...scan.monitorResults[0], minimumLimit: undefined, maximumLimit: undefined }] })).toThrow('requires at least one limit');
    expect(() => assertValidDiagnosticScan({ ...scan, monitorResults: [{ ...scan.monitorResults[0], minimumLimit: 3, maximumLimit: 2 }] })).toThrow('minimumLimit cannot exceed maximumLimit');
    expect(() => assertValidDiagnosticScan({ ...scan, monitorResults: [{ ...scan.monitorResults[0], testValue: 5, outcome: 'WITHIN_LIMITS' }] })).toThrow('WITHIN_LIMITS contradicts');
    expect(() => assertValidDiagnosticScan({ ...scan, monitorResults: [{ ...scan.monitorResults[0], testValue: 1, outcome: 'OUTSIDE_LIMITS' }] })).toThrow('OUTSIDE_LIMITS contradicts');
  });

  it('requires coverage discovery to exactly equal the endpoint set', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticCoverage(scan, { ...validCoverage(), discoveredEndpointIds: [] })).toThrow('exactly match scan endpoints');
  });

  it('rejects coverage that scans or characterizes endpoints outside discovery truth', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticCoverage(scan, { ...validCoverage(), scannedEndpointIds: ['ecu-1', 'ecu-2'] })).toThrow('was not discovered');
    expect(() => assertValidDiagnosticCoverage(scan, { ...validCoverage(), services: [{ endpointId: 'ecu-2', service: '03', outcome: 'COMPLETE' }] })).toThrow('undiscovered endpoint ecu-2');
  });

  it('rejects coverage that omits an evaluated endpoint or marks NOT_EVALUATED as scanned', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticCoverage(scan, { ...validCoverage(), scannedEndpointIds: [] })).toThrow('omits evaluated endpoint');
    const notEvaluated: DiagnosticScan = { ...scan, endpoints: [{ ...scan.endpoints[0], scanStatus: 'NOT_EVALUATED' }] };
    expect(() => assertValidDiagnosticCoverage(notEvaluated, validCoverage())).toThrow('scanStatus is NOT_EVALUATED');
  });

  it('rejects duplicate service coverage rows that could make coverage ambiguous', () => {
    const scan = validScan();
    const row = validCoverage().services[0];
    expect(() => assertValidDiagnosticCoverage(scan, { ...validCoverage(), services: [row, { ...row }] })).toThrow('duplicate identifiers');
  });

  it('rejects concerns that reference nonexistent DTC or evidence identities', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticConcerns(scan, [{ ...validConcern(), dtcObservationIds: ['ghost-dtc'] }])).toThrow('unknown DTC ghost-dtc');
    expect(() => assertValidDiagnosticConcerns(scan, [{ ...validConcern(), supportingEvidenceIds: ['ghost-evidence'] }])).toThrow('unknown evidence ghost-evidence');
  });

  it('rejects the same evidence being both supporting and contradicting', () => {
    const scan = validScan();
    expect(() => assertValidDiagnosticConcerns(scan, [{ ...validConcern(), contradictingEvidenceIds: ['e-ff'] }])).toThrow('same evidence as supporting and contradicting');
  });

  it('seals only a SHA-256-addressed, chronologically valid, internally consistent report', () => {
    const scan = validScan();
    const report = createDiagnosticReport({
      reportId: 'report-valid', scan, coverage: validCoverage(), concerns: [validConcern()], versions,
      evidenceHash: 'A'.repeat(64), sealedAt: 201,
    });
    expect(report.evidenceHash).toBe('a'.repeat(64));

    expect(() => createDiagnosticReport({
      reportId: 'report-bad-hash', scan, coverage: validCoverage(), concerns: [validConcern()], versions,
      evidenceHash: 'sha256:not-a-digest', sealedAt: 201,
    })).toThrow('64-character hexadecimal SHA-256');

    expect(() => createDiagnosticReport({
      reportId: 'report-bad-time', scan, coverage: validCoverage(), concerns: [validConcern()], versions,
      evidenceHash: 'b'.repeat(64), sealedAt: 199,
    })).toThrow('cannot precede scan endedAt');
  });
});
