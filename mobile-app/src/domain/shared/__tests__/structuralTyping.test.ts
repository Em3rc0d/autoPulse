import { Evaluation } from '../../evaluation/models/evaluation';
import { LiveTelemetrySession } from '../../telemetry/models/liveTelemetrySession';
import { createEvaluationId, createTenantId, createVehicleId, createTechnicianId, createLiveSessionId } from '../identifiers';
import { EvaluationState } from '../../evaluation/models/enums';
import { LiveSessionState, TelemetryPreset } from '../../telemetry/models/enums';
import { nowUtc } from '../timestamps';
import { Finding } from '../../evaluation/models/finding';
import { LiveTelemetryAlert } from '../../telemetry/models/liveTelemetryAlert';
import { FindingSource, FindingStatus, FindingSeverity, ConfidenceLevel } from '../../evaluation/models/enums';
import { LiveAlertState, LiveAlertSeverity } from '../../telemetry/models/enums';
import { createFindingId, createAlertId } from '../identifiers';

describe('Structural Typing & Context Separation', () => {
  it('prevents assigning LiveTelemetrySession to Evaluation', () => {
    const session: LiveTelemetrySession = {
      id: createLiveSessionId('sess-1'),
      vehicleId: createVehicleId('v-1'),
      operatorId: createTechnicianId('tech-1'),
      state: LiveSessionState.CREATED,
      preset: TelemetryPreset.ESSENTIAL,
      activeSignalIds: [],
      recordingPolicy: { mode: 'OFF' },
      startedAt: nowUtc(),
      markerIds: []
    };

    // @ts-expect-error Type 'LiveTelemetrySession' is missing the following properties from type 'Evaluation': tenantId, technicianId, scope
    const evalFromSession: Evaluation = session;
    expect(evalFromSession).toBeDefined();
  });

  it('prevents assigning LiveTelemetryAlert to Finding', () => {
    const alert: LiveTelemetryAlert = {
      id: createAlertId('alert-1'),
      sessionId: createLiveSessionId('sess-1'),
      sourceRuleId: 'rule-1',
      state: LiveAlertState.ACTIVE,
      severity: LiveAlertSeverity.WARNING,
      startedAt: nowUtc(),
      message: 'Test alert',
      observedSignalIds: []
    };

    // @ts-expect-error Type 'LiveTelemetryAlert' is missing the following properties from type 'Finding': evaluationId, source, status, confidence, evidenceIds
    const findingFromAlert: Finding = alert;
    expect(findingFromAlert).toBeDefined();
  });
});
