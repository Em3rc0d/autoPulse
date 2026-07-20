import { SignalId } from '../../shared/identifiers';
import { TelemetryValueOrigin, TelemetryPreset } from './enums';

export interface TelemetrySignalDefinition {
  readonly id: SignalId;
  readonly technicalName: string;
  readonly displayName: string;
  readonly plainLanguageDescription: string;
  readonly unit: string;
  readonly origin: TelemetryValueOrigin;
  readonly category: string;
  readonly sourceIdentifier: string;
  readonly requiredCapability?: string;
  readonly recommendedPresets: readonly TelemetryPreset[];
  readonly safetyRelevant: boolean;
}
