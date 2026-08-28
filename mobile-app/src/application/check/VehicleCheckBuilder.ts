import { SessionAcquisitionMode, SessionIntegrityState, type SignalSummary } from '../../domain/telemetry/models/sessionSummaryResult';
import type {
  VehicleCheckBuildInput,
  VehicleCheckCompatibilitySummary,
  VehicleCheckCoverage,
  VehicleCheckSignalKey,
  VehicleCheckSignalObservation,
  VehicleCheckSnapshot,
} from './VehicleCheckReport';
import { VEHICLE_CHECK_SCHEMA_VERSION } from './VehicleCheckReport';

interface SignalTarget {
  key: VehicleCheckSignalKey;
  label: string;
  unit: string;
  source: 'ECU' | 'ADAPTER';
  aliases: readonly string[];
}

export const VEHICLE_CHECK_V1_SIGNAL_TARGETS: readonly SignalTarget[] = Object.freeze([
  { key: 'ENGINE_RPM', label: 'Engine RPM', unit: 'rpm', source: 'ECU', aliases: ['RPM', 'ENGINE_RPM', '010C'] },
  { key: 'VEHICLE_SPEED', label: 'Vehicle speed', unit: 'km/h', source: 'ECU', aliases: ['SPEED', 'VEHICLE_SPEED', '010D'] },
  { key: 'ENGINE_COOLANT', label: 'Engine coolant', unit: '°C', source: 'ECU', aliases: ['COOLANT', 'ENGINE_COOLANT', '0105'] },
  { key: 'ECU_VOLTAGE', label: 'Control module voltage', unit: 'V', source: 'ECU', aliases: ['ECU_VOLTAGE', 'CONTROL_MODULE_VOLTAGE', '0142'] },
  { key: 'ADAPTER_VOLTAGE', label: 'Adapter voltage', unit: 'V', source: 'ADAPTER', aliases: ['ADAPTER_VOLTAGE', 'ATRV'] },
]);

function normalized(value: string): string {
  return value.trim().toUpperCase();
}

function findSignalSummary(
  summaries: Record<string, SignalSummary>,
  aliases: readonly string[],
): SignalSummary | null {
  const aliasSet = new Set(aliases.map(normalized));
  for (const [key, value] of Object.entries(summaries)) {
    if (aliasSet.has(normalized(key)) || aliasSet.has(normalized(value.signalId))) return value;
  }
  return null;
}

function toObservation(target: SignalTarget, summary: SignalSummary | null): VehicleCheckSignalObservation {
  if (!summary) {
    return {
      key: target.key,
      label: target.label,
      unit: target.unit,
      source: target.source,
      state: 'NOT_EVALUATED',
      validReadingsCount: 0,
      noDataCount: 0,
      invalidCount: 0,
      min: null,
      avg: null,
      max: null,
    };
  }

  const state = summary.validReadingsCount > 0
    ? 'OBSERVED'
    : summary.noDataCount > 0
      ? 'PROBED_NO_DATA'
      : summary.invalidCount > 0
        ? 'INVALID_ONLY'
        : 'NOT_EVALUATED';

  return {
    key: target.key,
    label: target.label,
    unit: target.unit,
    source: target.source,
    state,
    sourceSignalId: summary.signalId,
    validReadingsCount: summary.validReadingsCount,
    noDataCount: summary.noDataCount,
    invalidCount: summary.invalidCount,
    min: state === 'OBSERVED' ? summary.min : null,
    avg: state === 'OBSERVED' ? summary.avg : null,
    max: state === 'OBSERVED' ? summary.max : null,
  };
}

function buildCoverage(signals: readonly VehicleCheckSignalObservation[]): VehicleCheckCoverage {
  const observedSignals = signals.filter(item => item.state === 'OBSERVED').length;
  const probedNoDataSignals = signals.filter(item => item.state === 'PROBED_NO_DATA').length;
  const invalidOnlySignals = signals.filter(item => item.state === 'INVALID_ONLY').length;
  const notEvaluatedSignals = signals.filter(item => item.state === 'NOT_EVALUATED').length;
  return {
    targetSignals: signals.length,
    observedSignals,
    probedNoDataSignals,
    invalidOnlySignals,
    notEvaluatedSignals,
    observedPercent: signals.length === 0 ? 0 : Math.round((observedSignals / signals.length) * 100),
  };
}

function buildCompatibility(input: VehicleCheckBuildInput): VehicleCheckCompatibilitySummary {
  const snapshot = input.compatibility;
  if (!snapshot) {
    return {
      available: false,
      protocol: input.summary.protocolId ?? 'UNKNOWN',
      standardObdReachable: null,
      discoveredEcuCount: 0,
      enhancedDiagnosticsAdvertised: null,
      enhancedDiagnosticsProbed: null,
    };
  }

  const standardObdObservation = snapshot.observations.find(item => item.key === 'standard_obd_reachable');
  return {
    available: true,
    capturedAt: snapshot.capturedAt,
    protocol: String(snapshot.protocol ?? input.summary.protocolId ?? 'UNKNOWN'),
    standardObdReachable: standardObdObservation ? standardObdObservation.supported : null,
    discoveredEcuCount: snapshot.discoveredEcus.length,
    enhancedDiagnosticsAdvertised: snapshot.enhancedDiagnosticsAdvertised,
    enhancedDiagnosticsProbed: snapshot.enhancedDiagnosticsProbed,
  };
}

export function buildVehicleCheckSnapshot(input: VehicleCheckBuildInput): VehicleCheckSnapshot {
  const { summary } = input;
  const signals = VEHICLE_CHECK_V1_SIGNAL_TARGETS.map(target =>
    toObservation(target, findSignalSummary(summary.signalSummaries, target.aliases))
  );
  const coverage = buildCoverage(signals);
  const compatibility = buildCompatibility(input);
  const limitations: string[] = [
    'Check Lite V1 reports read-only observations from the captured session; it is not a mechanical certification or a prediction of future failures.',
    'ABS, airbag, transmission and manufacturer-enhanced modules are not inferred unless explicitly observed by a future scoped evaluation.',
  ];

  if (summary.integrityState !== SessionIntegrityState.COMPLETE) {
    limitations.push(`Session integrity is ${summary.integrityState}; evidence may be incomplete.`);
  }
  if (summary.acquisitionMode !== SessionAcquisitionMode.REAL_BLE) {
    limitations.push(`Acquisition mode is ${summary.acquisitionMode}; this is not eligible as a physical customer-pilot observation.`);
  }
  if (!compatibility.available) {
    limitations.push('A durable compatibility characterization was not available for this session.');
  }
  if (coverage.notEvaluatedSignals > 0) {
    limitations.push(`${coverage.notEvaluatedSignals} of ${coverage.targetSignals} bounded V1 signals were not evaluated in this session.`);
  }
  const adapterVoltage = signals.find(item => item.key === 'ADAPTER_VOLTAGE');
  const ecuVoltage = signals.find(item => item.key === 'ECU_VOLTAGE');
  if (adapterVoltage?.state === 'OBSERVED' && ecuVoltage?.state !== 'OBSERVED') {
    limitations.push('Adapter voltage was observed, but ECU control-module voltage was not; adapter voltage is not substituted for PID 0142 evidence.');
  }

  const pilotEligible = summary.acquisitionMode === SessionAcquisitionMode.REAL_BLE
    && summary.integrityState === SessionIntegrityState.COMPLETE
    && summary.totalReadingsCount > 0
    && compatibility.available
    && compatibility.standardObdReachable !== false;

  return {
    schema: VEHICLE_CHECK_SCHEMA_VERSION,
    checkId: input.checkId,
    generatedAt: input.generatedAt ?? Date.now(),
    workspaceId: String(summary.workspaceId),
    sessionId: String(summary.sessionId),
    vehicle: { ...input.vehicle, vehicleId: String(summary.vehicleId) },
    acquisition: {
      mode: summary.acquisitionMode,
      adapterId: summary.adapterId,
      protocolId: summary.protocolId,
      startedAt: String(summary.startedAt),
      endedAt: summary.endedAt ? String(summary.endedAt) : undefined,
      durationSeconds: summary.durationSeconds,
    },
    evidence: {
      sessionIntegrity: summary.integrityState,
      interrupted: summary.isInterrupted,
      terminationReason: summary.terminationReason,
      expectedBlocksCount: summary.expectedBlocksCount,
      foundBlocksCount: summary.foundBlocksCount,
      corruptedBlocksCount: summary.corruptedBlocksCount,
      gapsDetectedCount: summary.gapsDetectedCount,
      totalEventsCount: summary.totalEventsCount,
      totalReadingsCount: summary.totalReadingsCount,
    },
    compatibility,
    signals,
    coverage,
    limitations,
    pilotEligible,
  };
}
