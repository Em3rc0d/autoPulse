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
    purpose: 'Only the vehicle state that matters most right now.',
  },
  FAMILY: {
    mode: 'FAMILY',
    label: 'Family / Daily',
    shortLabel: 'Family',
    icon: '⌂',
    purpose: 'Calm daily-driving view focused on health, speed and reliability.',
  },
  PERFORMANCE: {
    mode: 'PERFORMANCE',
    label: 'Performance',
    shortLabel: 'Performance',
    icon: '⚡',
    purpose: 'Powertrain load, temperatures and response using available vehicle signals.',
  },
  OFF_ROAD: {
    mode: 'OFF_ROAD',
    label: 'Off-Road',
    shortLabel: 'Off-Road',
    icon: '△',
    purpose: 'Vehicle stress plus terrain and phone-sensor context when available.',
  },
  DIAGNOSTIC: {
    mode: 'DIAGNOSTIC',
    label: 'Diagnostic',
    shortLabel: 'Diagnostic',
    icon: '✦',
    purpose: 'Technical evidence, health and diagnostic signals without hiding provenance.',
  },
};

export const DRIVING_MODE_ORDER: readonly DrivingMode[] = [
  'ESSENTIAL',
  'FAMILY',
  'PERFORMANCE',
  'OFF_ROAD',
  'DIAGNOSTIC',
];
