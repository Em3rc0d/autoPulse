import { SignalAdvisoryProfile } from './SignalAdvisory';

export const DEMO_PROFILES: Record<string, SignalAdvisoryProfile> = {
  ENGINE_RPM: {
    vehicleId: 'demo',
    signalId: 'ENGINE_RPM',
    sourceType: 'GENERIC_REFERENCE',
    calibrationStatus: 'GENERIC_ONLY',
    hysteresisMs: 3000,
    sustainDurationMs: 2000,
    bands: [], // Handled by ContextualAdvisoryEvaluator
    referenceRanges: [
      { context: 'IDLE', label: 'Ralentí', min: 600, max: 900, unit: 'rpm', displayOrder: 1 },
      { context: 'COLD_START', label: 'Arranque en frío', max: 1200, unit: 'rpm', maxInclusive: true, displayOrder: 2 },
      { context: 'NORMAL_DRIVING', label: 'Marcha normal', min: 1500, max: 3000, unit: 'rpm', displayOrder: 3 },
      { context: 'GASOLINE_ENGINE', label: 'Gasolina', min: 2000, max: 4000, unit: 'rpm', displayOrder: 4 },
      { context: 'GENERAL', label: 'Redline', unit: 'rpm', displayOrder: 5 }
    ]
  },
  ENGINE_COOLANT: {
    vehicleId: 'demo',
    signalId: 'ENGINE_COOLANT',
    sourceType: 'GENERIC_REFERENCE',
    calibrationStatus: 'GENERIC_ONLY',
    hysteresisMs: 3000,
    sustainDurationMs: 2000,
    bands: [
      { max: 89, status: 'WARMING' },
      { min: 90, max: 105, status: 'NORMAL' },
      { min: 106, max: 115, status: 'ELEVATED' },
      { min: 116, status: 'CRITICAL' },
    ],
    referenceRanges: [
      { context: 'GENERAL', label: 'Rango esperado', min: 90, max: 105, unit: '°C', displayOrder: 1 },
      { context: 'GENERAL', label: 'Precaución', min: 106, max: 115, unit: '°C', displayOrder: 2 },
      { context: 'GENERAL', label: 'Umbral alto', min: 115, minInclusive: false, unit: '°C', displayOrder: 3 },
    ]
  },
  VEHICLE_SPEED: {
    vehicleId: 'demo',
    signalId: 'VEHICLE_SPEED',
    sourceType: 'GENERIC_REFERENCE',
    calibrationStatus: 'GENERIC_ONLY',
    hysteresisMs: 3000,
    sustainDurationMs: 2000,
    bands: [
      { min: 0, max: 120, status: 'NORMAL' },
      { min: 121, max: 249, status: 'ELEVATED' },
      { min: 250, max: 300, status: 'ELEVATED' },
      { min: 301, status: 'CRITICAL' },
    ],
    referenceRanges: [
      { context: 'GENERAL', label: 'Estable', min: 0, max: 120, unit: 'km/h', displayOrder: 1 },
      { context: 'GENERAL', label: 'Precaución', min: 121, max: 249, unit: 'km/h', displayOrder: 2 },
      { context: 'GENERAL', label: 'Alto', min: 250, max: 300, unit: 'km/h', displayOrder: 3 },
      { context: 'GENERAL', label: 'Extremo', min: 300, minInclusive: false, unit: 'km/h', displayOrder: 4 }
    ]
  },
  ENGINE_LOAD: {
    vehicleId: 'demo',
    signalId: 'ENGINE_LOAD',
    sourceType: 'GENERIC_REFERENCE',
    calibrationStatus: 'GENERIC_ONLY',
    hysteresisMs: 0,
    sustainDurationMs: 0,
    bands: [],
  },
  THROTTLE_POSITION: {
    vehicleId: 'demo',
    signalId: 'THROTTLE_POSITION',
    sourceType: 'GENERIC_REFERENCE',
    calibrationStatus: 'GENERIC_ONLY',
    hysteresisMs: 0,
    sustainDurationMs: 0,
    bands: [],
  },
  CONTROL_VOLTAGE: {
    vehicleId: 'demo',
    signalId: 'CONTROL_VOLTAGE',
    sourceType: 'GENERIC_REFERENCE',
    calibrationStatus: 'GENERIC_ONLY',
    hysteresisMs: 3000,
    sustainDurationMs: 2000,
    bands: [], // Handled by ContextualAdvisoryEvaluator
    referenceRanges: [
      { context: 'ENGINE_OFF', label: 'Batería en buen nivel', min: 12.6, max: 12.8, unit: 'V', displayOrder: 1 },
      { context: 'ENGINE_OFF', label: 'Nivel aceptable / vigilar', min: 12.4, max: 12.59, unit: 'V', displayOrder: 2 },
      { context: 'ENGINE_OFF', label: 'Batería baja', min: 12.0, max: 12.39, unit: 'V', displayOrder: 3 },
      { context: 'ENGINE_OFF', label: 'Muy baja', max: 12.0, maxInclusive: false, unit: 'V', displayOrder: 4 },
      { context: 'ENGINE_RUNNING', label: 'Carga esperada', min: 13.7, max: 14.7, unit: 'V', displayOrder: 5 },
      { context: 'ENGINE_RUNNING', label: 'Carga baja', min: 13.5, max: 13.69, unit: 'V', displayOrder: 6 },
      { context: 'ENGINE_RUNNING', label: 'Carga elevada', min: 14.71, max: 15.0, unit: 'V', displayOrder: 7 },
      { context: 'ENGINE_RUNNING', label: 'Fuera del rango demo', max: 13.5, maxInclusive: false, unit: 'V', displayOrder: 8 },
      { context: 'ENGINE_RUNNING', label: 'Sobrecarga demo', min: 15.0, minInclusive: false, unit: 'V', displayOrder: 9 },
    ]
  }
};
