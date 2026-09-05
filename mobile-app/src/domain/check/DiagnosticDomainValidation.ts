import type { DiagnosticConcern } from './DiagnosticConcern';
import type { DiagnosticCoverage } from './DiagnosticCoverage';
import type { DiagnosticEndpoint } from './DiagnosticEndpoint';
import type {
  DiagnosticEvidenceFact,
  DiagnosticEvidenceRelation,
  DiagnosticEvidenceScalar,
  DiagnosticEvidenceValue,
} from './DiagnosticEvidence';
import type { DiagnosticFreezeFrame } from './DiagnosticFreezeFrame';
import type { DiagnosticMonitorResult } from './DiagnosticMonitorResult';
import type { DiagnosticReadiness, DiagnosticReadinessMonitor } from './DiagnosticReadiness';
import type { DiagnosticScan } from './DiagnosticScan';
import { isDiagnosticScanTerminal } from './DiagnosticScanState';
import { diagnosticTroubleCodeFamily, type DiagnosticTroubleCode } from './DiagnosticTroubleCode';

const DTC_PATTERN = /^[PBCU][0-3][0-9A-F]{3}$/;

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must be non-empty`);
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function assertFiniteTimestamp(value: number, label: string): void {
  assertFiniteNumber(value, label);
}

function assertUniqueNonEmpty(values: readonly string[], label: string): void {
  const normalized = values.map(value => value.trim());
  if (normalized.some(value => value.length === 0)) throw new Error(`${label} contains an empty identifier`);
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} contains duplicate identifiers`);
}

function assertKnownEndpoint(endpointId: string | null, endpointIds: ReadonlySet<string>, label: string): void {
  if (endpointId !== null && !endpointIds.has(endpointId)) {
    throw new Error(`${label} references unknown endpoint ${endpointId}`);
  }
}

function assertEvidenceRefs(ids: readonly string[], evidenceIds: ReadonlySet<string>, label: string): void {
  assertUniqueNonEmpty(ids, label);
  for (const id of ids) {
    if (!evidenceIds.has(id)) throw new Error(`${label} references unknown evidence ${id}`);
  }
}

function assertEvidenceScalar(value: DiagnosticEvidenceScalar, label: string): void {
  if (typeof value === 'number') assertFiniteNumber(value, label);
}

function assertEvidenceValue(value: DiagnosticEvidenceValue, label: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertEvidenceScalar(item, `${label}[${index}]`));
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, scalar] of Object.entries(value)) {
      assertNonEmpty(key, `${label} record key`);
      assertEvidenceScalar(scalar, `${label}.${key}`);
    }
    return;
  }
  assertEvidenceScalar(value as DiagnosticEvidenceScalar, label);
}

function assertEndpoint(endpoint: DiagnosticEndpoint): void {
  assertNonEmpty(endpoint.endpointId, 'Diagnostic endpointId');
  if (endpoint.sourceAddress !== undefined) assertNonEmpty(endpoint.sourceAddress, `Diagnostic endpoint ${endpoint.endpointId} sourceAddress`);

  const identityKeys = endpoint.identityEvidence.map(item => item.key);
  assertUniqueNonEmpty(identityKeys, `Diagnostic endpoint ${endpoint.endpointId} identity keys`);
  for (const identity of endpoint.identityEvidence) {
    assertNonEmpty(identity.value, `Diagnostic endpoint ${endpoint.endpointId} identity value`);
    assertNonEmpty(identity.provenance, `Diagnostic endpoint ${endpoint.endpointId} identity provenance`);
    assertFiniteTimestamp(identity.observedAt, `Diagnostic endpoint ${endpoint.endpointId} identity observedAt`);
  }

  const serviceKeys = endpoint.supportedServices.map(item => `${item.service.trim().toUpperCase()}::${item.stage}`);
  assertUniqueNonEmpty(serviceKeys, `Diagnostic endpoint ${endpoint.endpointId} service-stage observations`);
  for (const service of endpoint.supportedServices) {
    assertNonEmpty(service.service, `Diagnostic endpoint ${endpoint.endpointId} service`);
    assertNonEmpty(service.provenance, `Diagnostic endpoint ${endpoint.endpointId} service provenance`);
    if (service.stage === 'OBSERVED' && service.outcome === undefined) {
      throw new Error(`Diagnostic endpoint ${endpoint.endpointId} observed service ${service.service} requires an outcome`);
    }
    if (service.stage !== 'OBSERVED' && service.outcome !== undefined) {
      throw new Error(`Diagnostic endpoint ${endpoint.endpointId} service ${service.service} cannot carry an outcome before OBSERVED stage`);
    }
    if (service.observedAt !== undefined) assertFiniteTimestamp(service.observedAt, `Diagnostic endpoint ${endpoint.endpointId} service observedAt`);
  }

  const pidKeys = endpoint.supportedPids.map(item => `${item.pid.trim().toUpperCase()}::${item.stage}`);
  assertUniqueNonEmpty(pidKeys, `Diagnostic endpoint ${endpoint.endpointId} PID-stage observations`);
  for (const pid of endpoint.supportedPids) {
    assertNonEmpty(pid.pid, `Diagnostic endpoint ${endpoint.endpointId} PID`);
    assertNonEmpty(pid.provenance, `Diagnostic endpoint ${endpoint.endpointId} PID provenance`);
  }
}

function assertDtc(dtc: DiagnosticTroubleCode, endpointIds: ReadonlySet<string>): void {
  assertNonEmpty(dtc.observationId, 'Diagnostic DTC observationId');
  const code = dtc.code.trim().toUpperCase();
  if (!DTC_PATTERN.test(code)) throw new Error(`Invalid OBD-II DTC code ${dtc.code}`);
  if (diagnosticTroubleCodeFamily(code) !== dtc.family) throw new Error(`DTC family mismatch for ${dtc.code}`);
  assertKnownEndpoint(dtc.sourceEndpointId, endpointIds, `DTC ${dtc.observationId}`);
  assertFiniteTimestamp(dtc.observedAt, `DTC ${dtc.observationId} observedAt`);
  if (dtc.canonicalMeaning !== undefined) {
    assertNonEmpty(dtc.canonicalMeaning, `DTC ${dtc.observationId} canonicalMeaning`);
    assertNonEmpty(dtc.meaningProvenance.sourceId, `DTC ${dtc.observationId} meaning sourceId`);
    assertNonEmpty(dtc.meaningProvenance.sourceVersion, `DTC ${dtc.observationId} meaning sourceVersion`);
  }
}

function assertReadinessMonitor(readinessId: string, monitor: DiagnosticReadinessMonitor): void {
  assertNonEmpty(monitor.monitorId, `Readiness ${readinessId} monitorId`);

  if (monitor.supported === false) {
    if (monitor.completion !== 'NOT_APPLICABLE') {
      throw new Error(`Readiness ${readinessId} monitor ${monitor.monitorId} unsupported monitor must be NOT_APPLICABLE`);
    }
    if (monitor.readinessState !== 'NOT_SUPPORTED') {
      throw new Error(`Readiness ${readinessId} monitor ${monitor.monitorId} unsupported monitor must be NOT_SUPPORTED`);
    }
    return;
  }

  if (monitor.supported === 'UNKNOWN') {
    if (monitor.completion !== 'UNKNOWN' || monitor.readinessState !== 'UNKNOWN') {
      throw new Error(`Readiness ${readinessId} monitor ${monitor.monitorId} unknown support must remain UNKNOWN`);
    }
    return;
  }

  if (monitor.completion === 'COMPLETE' && monitor.readinessState !== 'READY') {
    throw new Error(`Readiness ${readinessId} monitor ${monitor.monitorId} complete supported monitor must be READY`);
  }
  if (monitor.completion === 'INCOMPLETE' && monitor.readinessState !== 'NOT_READY') {
    throw new Error(`Readiness ${readinessId} monitor ${monitor.monitorId} incomplete supported monitor must be NOT_READY`);
  }
  if (monitor.completion === 'UNKNOWN' && monitor.readinessState !== 'UNKNOWN') {
    throw new Error(`Readiness ${readinessId} monitor ${monitor.monitorId} unknown completion must remain UNKNOWN`);
  }
  if (monitor.completion === 'NOT_APPLICABLE') {
    throw new Error(`Readiness ${readinessId} monitor ${monitor.monitorId} cannot be supported and NOT_APPLICABLE`);
  }
}

function assertReadiness(readiness: DiagnosticReadiness, endpointIds: ReadonlySet<string>): void {
  assertNonEmpty(readiness.readinessId, 'Diagnostic readinessId');
  assertKnownEndpoint(readiness.sourceEndpointId, endpointIds, `Readiness ${readiness.readinessId}`);
  assertFiniteTimestamp(readiness.observedAt, `Readiness ${readiness.readinessId} observedAt`);
  if (readiness.confirmedDtcCount !== undefined && (!Number.isInteger(readiness.confirmedDtcCount) || readiness.confirmedDtcCount < 0)) {
    throw new Error(`Readiness ${readiness.readinessId} confirmedDtcCount must be a non-negative integer`);
  }
  assertUniqueNonEmpty(readiness.monitors.map(item => item.monitorId), `Readiness ${readiness.readinessId} monitor IDs`);
  readiness.monitors.forEach(item => assertReadinessMonitor(readiness.readinessId, item));
}

function assertFreezeFrame(frame: DiagnosticFreezeFrame, endpointIds: ReadonlySet<string>, dtcIds: ReadonlySet<string>): void {
  assertNonEmpty(frame.freezeFrameId, 'Diagnostic freezeFrameId');
  assertKnownEndpoint(frame.sourceEndpointId, endpointIds, `Freeze frame ${frame.freezeFrameId}`);
  assertFiniteTimestamp(frame.observedAt, `Freeze frame ${frame.freezeFrameId} observedAt`);
  if (typeof frame.capturedAt === 'number') assertFiniteTimestamp(frame.capturedAt, `Freeze frame ${frame.freezeFrameId} capturedAt`);
  if (frame.relatedDtcObservationId !== undefined && !dtcIds.has(frame.relatedDtcObservationId)) {
    throw new Error(`Freeze frame ${frame.freezeFrameId} references unknown DTC ${frame.relatedDtcObservationId}`);
  }
  if (frame.state === 'FRAME_OBSERVED' && frame.values.length === 0) {
    throw new Error(`Freeze frame ${frame.freezeFrameId} FRAME_OBSERVED requires at least one value`);
  }
  if (frame.state !== 'FRAME_OBSERVED' && frame.values.length > 0) {
    throw new Error(`Freeze frame ${frame.freezeFrameId} ${frame.state} cannot carry decoded values`);
  }
  if (frame.state === 'UNATTRIBUTED' && frame.sourceEndpointId !== null) {
    throw new Error(`Freeze frame ${frame.freezeFrameId} UNATTRIBUTED must have null sourceEndpointId`);
  }

  const valueKeys = frame.values.map(value => `${value.pid.trim().toUpperCase()}::${value.signalId?.trim() ?? ''}`);
  assertUniqueNonEmpty(valueKeys, `Freeze frame ${frame.freezeFrameId} value identities`);
  for (const value of frame.values) {
    assertNonEmpty(value.pid, `Freeze frame ${frame.freezeFrameId} PID`);
    if (value.signalId !== undefined) assertNonEmpty(value.signalId, `Freeze frame ${frame.freezeFrameId} signalId`);
    if (typeof value.value === 'number') assertFiniteNumber(value.value, `Freeze frame ${frame.freezeFrameId} value`);
    if (value.unit !== undefined) assertNonEmpty(value.unit, `Freeze frame ${frame.freezeFrameId} unit`);
  }
}

function assertMonitorResult(result: DiagnosticMonitorResult, endpointIds: ReadonlySet<string>): void {
  assertNonEmpty(result.monitorResultId, 'Diagnostic monitorResultId');
  assertNonEmpty(result.monitorId, `Mode06 ${result.monitorResultId} monitorId`);
  assertKnownEndpoint(result.sourceEndpointId, endpointIds, `Mode06 ${result.monitorResultId}`);
  assertNonEmpty(result.provenance, `Mode06 ${result.monitorResultId} provenance`);
  assertFiniteTimestamp(result.observedAt, `Mode06 ${result.monitorResultId} observedAt`);
  if (result.rawValue !== undefined) assertEvidenceValue(result.rawValue, `Mode06 ${result.monitorResultId} rawValue`);
  if (result.testValue !== undefined) assertFiniteNumber(result.testValue, `Mode06 ${result.monitorResultId} testValue`);
  if (result.minimumLimit !== undefined) assertFiniteNumber(result.minimumLimit, `Mode06 ${result.monitorResultId} minimumLimit`);
  if (result.maximumLimit !== undefined) assertFiniteNumber(result.maximumLimit, `Mode06 ${result.monitorResultId} maximumLimit`);
  if (result.minimumLimit !== undefined && result.maximumLimit !== undefined && result.minimumLimit > result.maximumLimit) {
    throw new Error(`Mode06 ${result.monitorResultId} minimumLimit cannot exceed maximumLimit`);
  }

  const boundedOutcome = result.outcome === 'WITHIN_LIMITS' || result.outcome === 'OUTSIDE_LIMITS';
  if (boundedOutcome && result.testValue === undefined) {
    throw new Error(`Mode06 ${result.monitorResultId} ${result.outcome} requires testValue`);
  }
  if (boundedOutcome && result.minimumLimit === undefined && result.maximumLimit === undefined) {
    throw new Error(`Mode06 ${result.monitorResultId} ${result.outcome} requires at least one limit`);
  }
  if (boundedOutcome && result.testValue !== undefined) {
    const below = result.minimumLimit !== undefined && result.testValue < result.minimumLimit;
    const above = result.maximumLimit !== undefined && result.testValue > result.maximumLimit;
    const actuallyOutside = below || above;
    if (result.outcome === 'WITHIN_LIMITS' && actuallyOutside) {
      throw new Error(`Mode06 ${result.monitorResultId} WITHIN_LIMITS contradicts testValue/limits`);
    }
    if (result.outcome === 'OUTSIDE_LIMITS' && !actuallyOutside) {
      throw new Error(`Mode06 ${result.monitorResultId} OUTSIDE_LIMITS contradicts testValue/limits`);
    }
  }

  if (result.meaning !== undefined) {
    assertNonEmpty(result.meaning.label, `Mode06 ${result.monitorResultId} meaning label`);
    assertNonEmpty(result.meaning.sourceId, `Mode06 ${result.monitorResultId} meaning sourceId`);
    assertNonEmpty(result.meaning.sourceVersion, `Mode06 ${result.monitorResultId} meaning sourceVersion`);
  }
}

function assertEvidenceFact(fact: DiagnosticEvidenceFact, endpointIds: ReadonlySet<string>): void {
  assertNonEmpty(fact.evidenceId, 'Diagnostic evidenceId');
  assertKnownEndpoint(fact.sourceEndpointId, endpointIds, `Evidence ${fact.evidenceId}`);
  assertFiniteTimestamp(fact.observedAt, `Evidence ${fact.evidenceId} observedAt`);
  assertEvidenceValue(fact.value, `Evidence ${fact.evidenceId} value`);
  assertNonEmpty(fact.provenance, `Evidence ${fact.evidenceId} provenance`);
  if (fact.unit !== undefined) assertNonEmpty(fact.unit, `Evidence ${fact.evidenceId} unit`);
}

function assertEvidenceRelation(relation: DiagnosticEvidenceRelation, evidenceIds: ReadonlySet<string>): void {
  assertNonEmpty(relation.relationId, 'Diagnostic relationId');
  if (!evidenceIds.has(relation.fromEvidenceId)) throw new Error(`Evidence relation ${relation.relationId} has unknown fromEvidenceId ${relation.fromEvidenceId}`);
  if (!evidenceIds.has(relation.toEvidenceId)) throw new Error(`Evidence relation ${relation.relationId} has unknown toEvidenceId ${relation.toEvidenceId}`);
  if (relation.fromEvidenceId === relation.toEvidenceId) throw new Error(`Evidence relation ${relation.relationId} cannot self-reference`);
  if ((relation.ruleId === undefined) !== (relation.ruleVersion === undefined)) {
    throw new Error(`Evidence relation ${relation.relationId} ruleId and ruleVersion must appear together`);
  }
  if (relation.ruleId !== undefined) {
    assertNonEmpty(relation.ruleId, `Evidence relation ${relation.relationId} ruleId`);
    assertNonEmpty(relation.ruleVersion!, `Evidence relation ${relation.relationId} ruleVersion`);
  }
}

function sourceAttributionValues(scan: DiagnosticScan): readonly (string | null)[] {
  return [
    ...scan.troubleCodes.map(item => item.sourceEndpointId),
    ...scan.readiness.map(item => item.sourceEndpointId),
    ...scan.freezeFrames.map(item => item.sourceEndpointId),
    ...scan.monitorResults.map(item => item.sourceEndpointId),
    ...scan.evidenceFacts.map(item => item.sourceEndpointId),
  ];
}

function assertAttribution(scan: DiagnosticScan): void {
  const values = sourceAttributionValues(scan);
  if (values.length === 0) return;
  const attributed = values.some(value => value !== null);
  const unattributed = values.some(value => value === null);
  if (scan.endpointAttribution === 'ATTRIBUTED' && unattributed) {
    throw new Error('Diagnostic scan ATTRIBUTED contains unattributed observations');
  }
  if (scan.endpointAttribution === 'UNATTRIBUTED' && attributed) {
    throw new Error('Diagnostic scan UNATTRIBUTED contains attributed observations');
  }
  if (scan.endpointAttribution === 'PARTIAL' && !(attributed && unattributed)) {
    throw new Error('Diagnostic scan PARTIAL attribution requires both attributed and unattributed observations');
  }
}

export function assertValidDiagnosticScan(scan: DiagnosticScan): void {
  assertNonEmpty(scan.scanId, 'Diagnostic scanId');
  assertFiniteTimestamp(scan.startedAt, `Diagnostic scan ${scan.scanId} startedAt`);
  if (isDiagnosticScanTerminal(scan.state) && scan.endedAt === undefined) {
    throw new Error(`Terminal diagnostic scan ${scan.scanId} requires endedAt`);
  }
  if (scan.endedAt !== undefined) {
    assertFiniteTimestamp(scan.endedAt, `Diagnostic scan ${scan.scanId} endedAt`);
    if (scan.endedAt < scan.startedAt) throw new Error(`Diagnostic scan ${scan.scanId} endedAt precedes startedAt`);
  }

  assertUniqueNonEmpty(scan.endpoints.map(item => item.endpointId), `Diagnostic scan ${scan.scanId} endpoint IDs`);
  scan.endpoints.forEach(assertEndpoint);
  const endpointIds = new Set(scan.endpoints.map(item => item.endpointId));

  assertUniqueNonEmpty(scan.troubleCodes.map(item => item.observationId), `Diagnostic scan ${scan.scanId} DTC observation IDs`);
  scan.troubleCodes.forEach(item => assertDtc(item, endpointIds));
  const dtcIds = new Set(scan.troubleCodes.map(item => item.observationId));

  assertUniqueNonEmpty(scan.readiness.map(item => item.readinessId), `Diagnostic scan ${scan.scanId} readiness IDs`);
  scan.readiness.forEach(item => assertReadiness(item, endpointIds));

  assertUniqueNonEmpty(scan.freezeFrames.map(item => item.freezeFrameId), `Diagnostic scan ${scan.scanId} freeze-frame IDs`);
  scan.freezeFrames.forEach(item => assertFreezeFrame(item, endpointIds, dtcIds));

  assertUniqueNonEmpty(scan.monitorResults.map(item => item.monitorResultId), `Diagnostic scan ${scan.scanId} Mode06 result IDs`);
  scan.monitorResults.forEach(item => assertMonitorResult(item, endpointIds));

  assertUniqueNonEmpty(scan.evidenceFacts.map(item => item.evidenceId), `Diagnostic scan ${scan.scanId} evidence IDs`);
  scan.evidenceFacts.forEach(item => assertEvidenceFact(item, endpointIds));
  const evidenceIds = new Set(scan.evidenceFacts.map(item => item.evidenceId));

  for (const dtc of scan.troubleCodes) assertEvidenceRefs(dtc.evidenceIds, evidenceIds, `DTC ${dtc.observationId} evidenceIds`);
  for (const readiness of scan.readiness) assertEvidenceRefs(readiness.evidenceIds, evidenceIds, `Readiness ${readiness.readinessId} evidenceIds`);
  for (const frame of scan.freezeFrames) assertEvidenceRefs(frame.evidenceIds, evidenceIds, `Freeze frame ${frame.freezeFrameId} evidenceIds`);
  for (const result of scan.monitorResults) assertEvidenceRefs(result.evidenceIds, evidenceIds, `Mode06 ${result.monitorResultId} evidenceIds`);

  assertUniqueNonEmpty(scan.evidenceRelations.map(item => item.relationId), `Diagnostic scan ${scan.scanId} relation IDs`);
  scan.evidenceRelations.forEach(item => assertEvidenceRelation(item, evidenceIds));
  assertUniqueNonEmpty(scan.limitations, `Diagnostic scan ${scan.scanId} limitations`);
  assertAttribution(scan);
}

export function assertValidDiagnosticCoverage(scan: DiagnosticScan, coverage: DiagnosticCoverage): void {
  const endpointIds = new Set(scan.endpoints.map(item => item.endpointId));
  assertUniqueNonEmpty(coverage.discoveredEndpointIds, 'Diagnostic coverage discoveredEndpointIds');
  assertUniqueNonEmpty(coverage.scannedEndpointIds, 'Diagnostic coverage scannedEndpointIds');

  const discovered = new Set(coverage.discoveredEndpointIds);
  if (discovered.size !== endpointIds.size || [...endpointIds].some(endpointId => !discovered.has(endpointId))) {
    throw new Error('Diagnostic coverage discoveredEndpointIds must exactly match scan endpoints');
  }

  const scanned = new Set(coverage.scannedEndpointIds);
  for (const endpointId of scanned) {
    if (!discovered.has(endpointId)) throw new Error(`Diagnostic coverage scanned endpoint ${endpointId} was not discovered`);
  }

  for (const endpoint of scan.endpoints) {
    const wasScanned = scanned.has(endpoint.endpointId);
    if (wasScanned && endpoint.scanStatus === 'NOT_EVALUATED') {
      throw new Error(`Diagnostic coverage marks endpoint ${endpoint.endpointId} scanned while scanStatus is NOT_EVALUATED`);
    }
    if (!wasScanned && endpoint.scanStatus !== 'NOT_EVALUATED') {
      throw new Error(`Diagnostic coverage omits evaluated endpoint ${endpoint.endpointId} from scannedEndpointIds`);
    }
  }

  const serviceKeys: string[] = [];
  for (const service of coverage.services) {
    assertNonEmpty(service.service, 'Diagnostic coverage service');
    if (service.endpointId !== null) {
      if (!discovered.has(service.endpointId)) {
        throw new Error(`Diagnostic coverage service ${service.service} references undiscovered endpoint ${service.endpointId}`);
      }
      if (service.outcome !== 'NOT_EVALUATED' && !scanned.has(service.endpointId)) {
        throw new Error(`Diagnostic coverage service ${service.service} has evaluated outcome for unscanned endpoint ${service.endpointId}`);
      }
    }
    if (service.detail !== undefined) assertNonEmpty(service.detail, `Diagnostic coverage ${service.service} detail`);
    serviceKeys.push(`${service.endpointId ?? 'UNATTRIBUTED'}::${service.service.trim().toUpperCase()}`);
  }
  assertUniqueNonEmpty(serviceKeys, 'Diagnostic coverage service observations');
  assertUniqueNonEmpty(coverage.availableEvidenceFamilies, 'Diagnostic coverage evidence families');
  assertUniqueNonEmpty(coverage.limitations, 'Diagnostic coverage limitations');
}

export function assertValidDiagnosticConcerns(scan: DiagnosticScan, concerns: readonly DiagnosticConcern[]): void {
  assertUniqueNonEmpty(concerns.map(item => item.concernId), 'Diagnostic concern IDs');
  const dtcIds = new Set(scan.troubleCodes.map(item => item.observationId));
  const evidenceIds = new Set(scan.evidenceFacts.map(item => item.evidenceId));

  for (const concern of concerns) {
    assertNonEmpty(concern.concernId, 'Diagnostic concernId');
    assertUniqueNonEmpty(concern.dtcObservationIds, `Concern ${concern.concernId} DTC IDs`);
    for (const id of concern.dtcObservationIds) {
      if (!dtcIds.has(id)) throw new Error(`Concern ${concern.concernId} references unknown DTC ${id}`);
    }
    assertEvidenceRefs(concern.supportingEvidenceIds, evidenceIds, `Concern ${concern.concernId} supportingEvidenceIds`);
    assertEvidenceRefs(concern.contradictingEvidenceIds, evidenceIds, `Concern ${concern.concernId} contradictingEvidenceIds`);
    assertEvidenceRefs(concern.unavailableEvidenceIds, evidenceIds, `Concern ${concern.concernId} unavailableEvidenceIds`);

    const supporting = new Set(concern.supportingEvidenceIds);
    if (concern.contradictingEvidenceIds.some(id => supporting.has(id))) {
      throw new Error(`Concern ${concern.concernId} cannot mark the same evidence as supporting and contradicting`);
    }
    if (concern.interpretation !== undefined) assertNonEmpty(concern.interpretation, `Concern ${concern.concernId} interpretation`);
    assertUniqueNonEmpty(concern.limitations, `Concern ${concern.concernId} limitations`);
    assertUniqueNonEmpty(concern.causeGroups.map(item => item.causeGroupId), `Concern ${concern.concernId} cause-group IDs`);

    for (const group of concern.causeGroups) {
      assertNonEmpty(group.causeGroupId, `Concern ${concern.concernId} causeGroupId`);
      assertNonEmpty(group.label, `Concern ${concern.concernId} cause-group label`);
      assertEvidenceRefs(group.supportingEvidenceIds, evidenceIds, `Cause group ${group.causeGroupId} supportingEvidenceIds`);
      assertEvidenceRefs(group.contradictingEvidenceIds, evidenceIds, `Cause group ${group.causeGroupId} contradictingEvidenceIds`);
      assertUniqueNonEmpty(group.limitations, `Cause group ${group.causeGroupId} limitations`);
      const groupSupporting = new Set(group.supportingEvidenceIds);
      if (group.contradictingEvidenceIds.some(id => groupSupporting.has(id))) {
        throw new Error(`Cause group ${group.causeGroupId} cannot mark the same evidence as supporting and contradicting`);
      }
    }
  }
}

export function assertSha256(value: string, label = 'SHA-256'): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error(`${label} must be a 64-character hexadecimal SHA-256 digest`);
}
