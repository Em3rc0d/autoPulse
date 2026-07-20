import { AlertId, LiveSessionId, SignalId } from '../../shared/identifiers';
import { UtcIsoTimestamp } from '../../shared/timestamps';
import { LiveAlertState, LiveAlertSeverity } from './enums';

export interface LiveTelemetryAlert {
  readonly id: AlertId;
  readonly sessionId: LiveSessionId;
  readonly state: LiveAlertState;
  readonly severity: LiveAlertSeverity;
  readonly sourceRuleId: string;
  readonly startedAt: UtcIsoTimestamp;
  readonly endedAt?: UtcIsoTimestamp;
  readonly observedSignalIds: readonly SignalId[];
  readonly message: string;
  readonly recommendedImmediateBehavior?: string;
}
