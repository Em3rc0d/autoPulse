import { canTransitionEvaluation } from '../evaluation/logic/evaluationStateMachine';
import { canTransitionCapture } from '../evaluation/logic/captureStateMachine';
import { canTransitionLiveSession } from '../telemetry/logic/liveSessionStateMachine';
import { canAddEvidence } from '../evaluation/logic/evidencePolicy';
import { DefaultTelemetryEvidencePromoter } from '../bridges/telemetryEvidence/promotionPolicy';
import { EvaluationState, CaptureState } from '../evaluation/models/enums';
import { LiveSessionState, TelemetryPreset } from '../telemetry/models/enums';
import { createEvaluationId, createTenantId, createVehicleId, createTechnicianId, createLiveSessionId, createEvidenceItemId } from '../shared/identifiers';
import { nowUtc } from '../shared/timestamps';
import { Evaluation } from '../evaluation/models/evaluation';
import { TelemetryWindow } from '../telemetry/models/telemetryWindow';
import { LiveTelemetrySession } from '../telemetry/models/liveTelemetrySession';
import { createElapsedMs, createSequenceNumber } from '../shared/durations';

describe('Integrated Domain Scenarios', () => {

  it('Escenario 1: Evaluación independiente (Capturas múltiples y continuación)', () => {
    // 1. Crear y abrir evaluación
    expect(canTransitionEvaluation(EvaluationState.DRAFT, EvaluationState.OPEN).ok).toBe(true);
    
    // 3 & 4. Añadir y abortar/interrumpir primera captura
    expect(canTransitionCapture(CaptureState.CREATED, CaptureState.CONNECTING).ok).toBe(true);
    expect(canTransitionCapture(CaptureState.CONNECTING, CaptureState.FAILED).ok).toBe(true);
    
    // 5 & 6. Segunda captura completada
    expect(canTransitionCapture(CaptureState.CREATED, CaptureState.CONNECTING).ok).toBe(true);
    expect(canTransitionCapture(CaptureState.CONNECTING, CaptureState.CONNECTED).ok).toBe(true);
    expect(canTransitionCapture(CaptureState.CONNECTED, CaptureState.CAPTURING).ok).toBe(true);
    expect(canTransitionCapture(CaptureState.CAPTURING, CaptureState.COMPLETED).ok).toBe(true);
    
    // La evaluación sigue permitiendo evidencia
    expect(canAddEvidence(EvaluationState.OPEN).ok).toBe(true);
  });

  it('Escenario 2: Sesión Live independiente (Ausencia de ceros mágicos no testeable aquí, pero estados sí)', () => {
    expect(canTransitionLiveSession(LiveSessionState.CREATED, LiveSessionState.CONNECTING).ok).toBe(true);
    expect(canTransitionLiveSession(LiveSessionState.CONNECTING, LiveSessionState.STREAMING).ok).toBe(true);
    expect(canTransitionLiveSession(LiveSessionState.STREAMING, LiveSessionState.COMPLETED).ok).toBe(true);
  });

  it('Escenario 3 & 4: Promoción de ventana y prohibición en firmada', () => {
    const promoter = new DefaultTelemetryEvidencePromoter();
    const evalId = createEvaluationId('eval-1');
    const sessionId = createLiveSessionId('sess-1');

    const openEvaluation: Evaluation = {
      id: evalId,
      tenantId: createTenantId('t-1'),
      vehicleId: createVehicleId('v-1'),
      technicianId: createTechnicianId('tech-1'),
      state: EvaluationState.OPEN,
      scope: { requestedItems: [] },
      createdAt: nowUtc()
    };

    const session: LiveTelemetrySession = {
      id: sessionId,
      vehicleId: createVehicleId('v-1'),
      operatorId: createTechnicianId('tech-1'),
      state: LiveSessionState.COMPLETED,
      preset: TelemetryPreset.DIAGNOSTIC,
      activeSignalIds: [],
      recordingPolicy: { mode: 'OFF' },
      startedAt: nowUtc(),
      markerIds: []
    };

    const window: TelemetryWindow = {
      sessionId,
      startedAt: nowUtc(),
      endedAt: nowUtc(),
      frames: [
        { sessionId, timestamp: nowUtc(), elapsedMs: createElapsedMs(100), sequenceNumber: createSequenceNumber(1), samples: [] },
        { sessionId, timestamp: nowUtc(), elapsedMs: createElapsedMs(200), sequenceNumber: createSequenceNumber(2), samples: [] }
      ],
      markers: [],
      signalDefinitions: []
    };

    const evidenceId = createEvidenceItemId('ev-test');

    // Escenario 3: Permite promocionar si está abierta
    const promotionResult = promoter.promoteWindow(window, openEvaluation, evidenceId);
    expect(promotionResult.ok).toBe(true);

    // Escenario 4: Rechaza si está firmada
    const signedEvaluation: Evaluation = { ...openEvaluation, state: EvaluationState.SIGNED };
    const rejectedResult = promoter.promoteWindow(window, signedEvaluation, evidenceId);
    expect(rejectedResult.ok).toBe(false);
  });

});
