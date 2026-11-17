jest.mock('../../settings/DriverPreferences', () => ({
  loadDriverPreferences: jest.fn(),
}));
jest.mock('../../../infrastructure/voice/AndroidDriverVoice', () => ({
  speakDriverMessage: jest.fn(),
}));

import { announceOneShotDriverAlert } from '../DriverVoiceNotificationService';
import { loadDriverPreferences } from '../../settings/DriverPreferences';
import { speakDriverMessage } from '../../../infrastructure/voice/AndroidDriverVoice';

const load = loadDriverPreferences as jest.Mock;
const speak = speakDriverMessage as jest.Mock;

const preferences = {
  voiceAlertsEnabled: true,
  criticalAlertsEnabled: true,
  attentionAlertsEnabled: true,
  advisoryAlertsEnabled: false,
};

describe('Localized, severity-routed system voice', () => {
  beforeEach(() => {
    load.mockReset();
    speak.mockReset().mockResolvedValue(true);
  });

  it('reads a critical event in Spanish and passes native priority', async () => {
    load.mockResolvedValue({ ...preferences, voiceLanguage: 'es-ES' });
    expect(await announceOneShotDriverAlert('ENGINE_HOT')).toBe(true);
    expect(speak).toHaveBeenCalledWith('ALTO. MOTOR CALIENTE.', 'es-ES', 'S3_CRITICAL');
  });

  it('keeps English the default for existing users', async () => {
    load.mockResolvedValue({ ...preferences, voiceLanguage: 'en-US' });
    expect(await announceOneShotDriverAlert('SESSION_INTERRUPTED')).toBe(true);
    expect(speak).toHaveBeenCalledWith('AUTOPULSE SESSION STOPPED.', 'en-US', 'S2_ATTENTION');
  });

  it('respects voice disabled without touching the native TTS engine', async () => {
    load.mockResolvedValue({ ...preferences, voiceAlertsEnabled: false, voiceLanguage: 'es-ES' });
    expect(await announceOneShotDriverAlert('ENGINE_HOT')).toBe(false);
    expect(speak).not.toHaveBeenCalled();
  });
});
