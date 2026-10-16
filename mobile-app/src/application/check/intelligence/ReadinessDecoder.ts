import type { Mode01DirectObservationResult } from '../parsers/Mode01DirectObservationParser';

export type ReadinessMonitorState = 'READY' | 'NOT_READY' | 'NOT_SUPPORTED';
export type IgnitionType = 'SPARK' | 'COMPRESSION';

export interface ReadinessMonitorObservation {
  readonly id: string;
  readonly label: string;
  readonly state: ReadinessMonitorState;
}

export interface DiagnosticReadinessObservation {
  readonly milOn: boolean;
  readonly confirmedDtcCount: number;
  readonly ignitionType: IgnitionType;
  readonly monitors: readonly ReadinessMonitorObservation[];
  readonly sourceEndpointId: string | null;
  readonly observedAt: number;
  readonly rawBytes: readonly number[];
  readonly provenance: string;
}

function monitor(id: string, label: string, supported: boolean, incomplete: boolean): ReadinessMonitorObservation {
  return Object.freeze({
    id,
    label,
    state: supported ? (incomplete ? 'NOT_READY' : 'READY') : 'NOT_SUPPORTED',
  });
}

export function decodePid0101Readiness(
  result: Mode01DirectObservationResult,
): DiagnosticReadinessObservation | undefined {
  if (result.outcome !== 'OBSERVED_DIRECTLY' || result.requestPid.toUpperCase() !== '01') return undefined;
  const bytes = result.dataBytes;
  if (bytes.length < 4) return undefined;
  const [a, b, c, d] = bytes;
  const compression = (b & 0x08) !== 0;
  const monitors: ReadinessMonitorObservation[] = [
    monitor('MISFIRE', 'Misfire', (b & 0x01) !== 0, (b & 0x10) !== 0),
    monitor('FUEL_SYSTEM', 'Fuel system', (b & 0x02) !== 0, (b & 0x20) !== 0),
    monitor('COMPREHENSIVE_COMPONENTS', 'Comprehensive components', (b & 0x04) !== 0, (b & 0x40) !== 0),
  ];

  const labels = compression
    ? [
      ['NMHC_CATALYST', 'NMHC catalyst'],
      ['NOX_SCR', 'NOx/SCR aftertreatment'],
      ['RESERVED_2', 'Reserved monitor'],
      ['BOOST_PRESSURE', 'Boost pressure'],
      ['RESERVED_4', 'Reserved monitor'],
      ['EXHAUST_GAS_SENSOR', 'Exhaust gas sensor'],
      ['PM_FILTER', 'PM filter'],
      ['EGR_VVT', 'EGR/VVT'],
    ] as const
    : [
      ['CATALYST', 'Catalyst'],
      ['HEATED_CATALYST', 'Heated catalyst'],
      ['EVAP', 'Evaporative system'],
      ['SECONDARY_AIR', 'Secondary air'],
      ['AC_REFRIGERANT', 'A/C refrigerant'],
      ['O2_SENSOR', 'Oxygen sensor'],
      ['O2_HEATER', 'Oxygen sensor heater'],
      ['EGR_VVT', 'EGR/VVT'],
    ] as const;

  labels.forEach(([id, label], bit) => {
    if (id.startsWith('RESERVED_')) return;
    monitors.push(monitor(id, label, (c & (1 << bit)) !== 0, (d & (1 << bit)) !== 0));
  });

  return Object.freeze({
    milOn: (a & 0x80) !== 0,
    confirmedDtcCount: a & 0x7f,
    ignitionType: compression ? 'COMPRESSION' as const : 'SPARK' as const,
    monitors: Object.freeze(monitors),
    sourceEndpointId: result.sourceEndpointId,
    observedAt: result.observedAt,
    rawBytes: Object.freeze([...bytes.slice(0, 4)]),
    provenance: `${result.provenance}; PID 0101 SAE-style readiness semantics; NOT_READY never means FAILED`,
  });
}
