import type { DrivingMode } from './models';

export interface DrivingModePresentation {
  mode: DrivingMode;
  label: string;
  shortLabel: string;
  icon: string;
  purpose: string;
}

export const DRIVING_MODE_PRESENTATION: Record<DrivingMode, DrivingModePresentation> = {
  ESSENTIAL: {
    mode: 'ESSENTIAL',
    label: 'Essential',
    shortLabel: 'Essential',
    icon: '◉',
    purpose: 'The few vehicle states that matter most right now.',
  },
  FAMILY: {
    mode: 'FAMILY',
    label: 'Family / Daily',
    shortLabel: 'Family',
    icon: '⌂',
    purpose: 'A calm view of health, reliability and everyday driving state.',
  },
  PERFORMANCE: {
    mode: 'PERFORMANCE',
    label: 'Performance',
    shortLabel: 'Performance',
    icon: '⚡',
    purpose: 'Engine readiness, thermal state, power demand and breathing from the best evidence available.',
  },
  OFF_ROAD: {
    mode: 'OFF_ROAD',
    label: 'Off-Road',
    shortLabel: 'Off-Road',
    icon: '△',
    purpose: 'Engine stress, terrain, attitude and altitude without pretending unavailable sensors exist.',
  },
  DIAGNOSTIC: {
    mode: 'DIAGNOSTIC',
    label: 'Diagnostic',
    shortLabel: 'Diagnostic',
    icon: '✦',
    purpose: 'Technical evidence and health state with provenance kept explicit.',
  },
};

export const DRIVING_MODE_ORDER: readonly DrivingMode[] = [
  'ESSENTIAL',
  'FAMILY',
  'PERFORMANCE',
  'OFF_ROAD',
  'DIAGNOSTIC',
];
