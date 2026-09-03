import { DRIVER_ALERT_LEXICON } from '../DriverAlertLexicon';
import {
  INACTIVE_ALERT_EPISODE,
  advanceAlertLifecycle,
} from '../DriverAlertLifecycle';

describe('DriverAlertLifecycle', () => {
  it('turns evidence loss during an active critical alert into UNRESOLVED, not resolved', () => {
    const active = advanceAlertLifecycle(INACTIVE_ALERT_EPISODE, {
      detectedAlert: DRIVER_ALERT_LEXICON.ENGINE_HOT,
      evidenceAvailable: true,
      nowMs: 1_000,
    });
    const lost = advanceAlertLifecycle(active, {
      detectedAlert: null,
      evidenceAvailable: false,
      nowMs: 2_000,
    });
    expect(lost.state).toBe('UNRESOLVED');
    expect(lost.peakSeverity).toBe('S3_CRITICAL');
  });

  it('requires sustained positive evidence before recovery resolves', () => {
    const active = advanceAlertLifecycle(INACTIVE_ALERT_EPISODE, {
      detectedAlert: DRIVER_ALERT_LEXICON.TEMP_RISING,
      evidenceAvailable: true,
      nowMs: 1_000,
    });
    const recovering = advanceAlertLifecycle(active, {
      detectedAlert: null,
      evidenceAvailable: true,
      nowMs: 2_000,
      recoveryConfirmMs: 3_000,
    });
    expect(recovering.state).toBe('RECOVERING');
    const resolved = advanceAlertLifecycle(recovering, {
      detectedAlert: null,
      evidenceAvailable: true,
      nowMs: 5_100,
      recoveryConfirmMs: 3_000,
    });
    expect(resolved.state).toBe('RESOLVED');
  });

  it('returns to UNRESOLVED if evidence disappears during recovery', () => {
    const active = advanceAlertLifecycle(INACTIVE_ALERT_EPISODE, {
      detectedAlert: DRIVER_ALERT_LEXICON.ENGINE_HOT,
      evidenceAvailable: true,
      nowMs: 1_000,
    });
    const recovering = advanceAlertLifecycle(active, {
      detectedAlert: null,
      evidenceAvailable: true,
      nowMs: 2_000,
    });
    const lost = advanceAlertLifecycle(recovering, {
      detectedAlert: null,
      evidenceAvailable: false,
      nowMs: 2_500,
    });
    expect(lost.state).toBe('UNRESOLVED');
  });

  it('keeps one episode while severity escalates', () => {
    const advisory = advanceAlertLifecycle(INACTIVE_ALERT_EPISODE, {
      detectedAlert: DRIVER_ALERT_LEXICON.TEMP_RISING,
      evidenceAvailable: true,
      nowMs: 1_000,
    });
    const critical = advanceAlertLifecycle(advisory, {
      detectedAlert: DRIVER_ALERT_LEXICON.ENGINE_HOT,
      evidenceAvailable: true,
      nowMs: 1_500,
    });
    expect(critical.state).toBe('ACTIVE');
    expect(critical.startedAt).toBe(1_000);
    expect(critical.currentSeverity).toBe('S3_CRITICAL');
    expect(critical.peakSeverity).toBe('S3_CRITICAL');
  });
});
