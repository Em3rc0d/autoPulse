import {
  DEFAULT_DRIVER_VOICE_LANGUAGE,
  resolveDriverAlertMessage,
} from '..';

describe('Driver alert lexicon', () => {
  it('defaults to English', () => {
    expect(DEFAULT_DRIVER_VOICE_LANGUAGE).toBe('en-US');
    expect(resolveDriverAlertMessage('ENGINE_HOT')).toBe('STOP. ENGINE HOT.');
  });

  it('provides controlled Spanish equivalents', () => {
    expect(resolveDriverAlertMessage('ENGINE_HOT', 'es-ES')).toBe('ALTO. MOTOR CALIENTE.');
    expect(resolveDriverAlertMessage('CHECK_ENGINE', 'es-ES')).toBe('REVISA MOTOR.');
    expect(resolveDriverAlertMessage('TEMP_RISING', 'es-ES')).toBe('ATENCIÓN. TEMPERATURA SUBIENDO.');
  });

  it('keeps fire risk distinct from engine temperature', () => {
    expect(resolveDriverAlertMessage('FIRE_RISK', 'en-US')).toBe('STOP. FIRE RISK.');
    expect(resolveDriverAlertMessage('ENGINE_HOT', 'en-US')).not.toContain('FIRE');
  });
});
