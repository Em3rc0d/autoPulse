import {
  DRIVER_ALERT_LEXICON,
  driverAlertPhrase,
} from '../DriverAlertLexicon';
import {
  markLiveAlertSpoken,
  selectCoolantDriverAlert,
  shouldSpeakLiveAlert,
} from '../LiveDriverAlertPolicy';

const preferences = {
  voiceAlertsEnabled: true,
  criticalAlertsEnabled: true,
  attentionAlertsEnabled: true,
  advisoryAlertsEnabled: true,
};

describe('DriverAlertLexicon', () => {
  it('uses English by explicit locale and Spanish when selected', () => {
    expect(driverAlertPhrase('ENGINE_HOT', 'en-US')).toBe('STOP. ENGINE HOT.');
    expect(driverAlertPhrase('ENGINE_HOT', 'es-ES')).toBe('ALTO. MOTOR CALIENTE.');
  });

  it('never maps coolant temperature to FIRE_RISK', () => {
    const critical = selectCoolantDriverAlert({ quality: 'VALID', advisory: 'CRITICAL' }, true);
    expect(critical?.key).toBe('ENGINE_HOT');
    expect(critical?.key).not.toBe('FIRE_RISK');
  });

  it('maps elevated coolant to a short advisory', () => {
    const elevated = selectCoolantDriverAlert({ quality: 'VALID', advisory: 'ELEVATED' }, true);
    expect(elevated).toEqual(DRIVER_ALERT_LEXICON.TEMP_RISING);
  });

  it('does not alert from unavailable evidence', () => {
    expect(selectCoolantDriverAlert({ quality: 'UNAVAILABLE', advisory: 'CRITICAL' }, false)).toBeNull();
  });
});

describe('LiveDriverAlertPolicy', () => {
  it('suppresses the same alert during cooldown', () => {
    const at = 1_000_000;
    const alert = DRIVER_ALERT_LEXICON.TEMP_RISING;
    const memory = markLiveAlertSpoken(alert, at);

    expect(shouldSpeakLiveAlert(alert, preferences, memory, at + 5_000)).toBe(false);
  });

  it('speaks immediately when severity escalates', () => {
    const at = 1_000_000;
    const advisoryMemory = markLiveAlertSpoken(DRIVER_ALERT_LEXICON.TEMP_RISING, at);

    expect(shouldSpeakLiveAlert(
      DRIVER_ALERT_LEXICON.ENGINE_HOT,
      preferences,
      advisoryMemory,
      at + 1_000,
    )).toBe(true);
  });

  it('respects advisory voice being disabled', () => {
    expect(shouldSpeakLiveAlert(
      DRIVER_ALERT_LEXICON.TEMP_RISING,
      { ...preferences, advisoryAlertsEnabled: false },
      {},
      Date.now(),
    )).toBe(false);
  });
});
