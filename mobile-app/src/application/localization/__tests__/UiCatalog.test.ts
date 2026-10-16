import en from '../messages.en.json';
import es from '../messages.es.json';
import { uiMessage } from '../UiCatalog';
import { motionUnknownHeading } from '../MotionStateCopy';
import { DRIVER_ALERT_LEXICON } from '../../../domain/driver-intelligence/DriverAlertLexicon';
describe('Keyed UI locale and parked-hysteresis smoke', () => {
  it('keeps locale catalogs complete and nonempty', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim()).not.toBe('');
      expect((es as Record<string,string>)[key].trim()).not.toBe('');
    }
  });
  it('has approved voice phrases in both catalogs for every semantic safety event', () => {
    for (const [key, alert] of Object.entries(DRIVER_ALERT_LEXICON)) {
      expect(en[`voice.${key}` as keyof typeof en]).toBe(alert.en);
      expect(es[`voice.${key}` as keyof typeof es]).toBe(alert.es);
    }
    expect(DRIVER_ALERT_LEXICON.ENGINE_HOT.en).toBe('STOP. ENGINE HOT.');
    expect(DRIVER_ALERT_LEXICON.ENGINE_HOT.es).toBe('ALTO. MOTOR CALIENTE.');
  });

  it('does not call a zero-speed parked transition movement', () => {
    expect(motionUnknownHeading('PARKED_CANDIDATE', true, 'es-ES')).toBe('CONFIRMANDO DETENCIÓN');
    expect(motionUnknownHeading('PARKED_CANDIDATE', true, 'en-US')).toBe('CONFIRMING STOP');
  });
  it('distinguishes moving, conflicting and unavailable speed', () => {
    expect(motionUnknownHeading('MOVING_CANDIDATE', true, 'es-ES')).toBe('CONFIRMANDO MOVIMIENTO');
    expect(motionUnknownHeading('MOVING_CANDIDATE_WITH_SOURCE_CONFLICT', true, 'en-US')).toBe('MOTION CONFLICT');
    expect(motionUnknownHeading('MOTION_EVIDENCE_UNAVAILABLE', false, 'es-ES')).toBe('DATOS DE MOVIMIENTO LIMITADOS');
    expect(uiMessage('motion.indeterminate','en-US')).toBe('MOTION UNCONFIRMED');
  });
});
