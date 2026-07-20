import { LiveTelemetryAlert } from '../models/liveTelemetryAlert';
import { LiveAlertState } from '../models/enums';

export function acknowledgeAlert(alert: LiveTelemetryAlert): LiveTelemetryAlert {
  if (alert.state !== LiveAlertState.ACTIVE) {
    return alert;
  }
  return {
    ...alert,
    state: LiveAlertState.ACKNOWLEDGED
  };
}

export function dismissAlert(alert: LiveTelemetryAlert): LiveTelemetryAlert {
  return {
    ...alert,
    state: LiveAlertState.DISMISSED
  };
}
