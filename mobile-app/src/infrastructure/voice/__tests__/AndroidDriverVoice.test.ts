jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: { AutoPulseVoice: {
    speak: jest.fn(async () => true),
    speakLocalized: jest.fn(async () => true),
    speakAlert: jest.fn(async () => true),
    stop: jest.fn(async () => true),
  } },
}));

import { NativeModules } from 'react-native';
import { speakDriverMessage } from '../AndroidDriverVoice';

describe('Android speech acceptance is NOT speech completion', () => {
  const voice = NativeModules.AutoPulseVoice as {
    speak: jest.Mock; speakLocalized: jest.Mock; speakAlert?: jest.Mock; stop: jest.Mock;
  };
  beforeEach(() => {
    voice.speak.mockClear();
    voice.speakLocalized.mockClear();
    voice.speakAlert = jest.fn(async () => true);
  });

  it('routes critical Spanish phrases through completed-utterance native API', async () => {
    expect(await speakDriverMessage('ALTO. MOTOR CALIENTE.', 'es-ES', 'S3_CRITICAL')).toBe(true);
    expect(voice.speakAlert).toHaveBeenCalledWith('ALTO. MOTOR CALIENTE.', 'es-ES', 3);
    expect(voice.speakLocalized).not.toHaveBeenCalled();
  });

  it('preserves lower voice priorities for advisory events', async () => {
    expect(await speakDriverMessage('SIGNAL LOST.', 'en-US', 'S1_ADVISORY')).toBe(true);
    expect(voice.speakAlert).toHaveBeenCalledWith('SIGNAL LOST.', 'en-US', 1);
  });

  it('does not trust old native TTS that resolves at enqueue', async () => {
    voice.speakAlert = undefined;
    expect(await speakDriverMessage('ALTO. MOTOR CALIENTE.', 'es-ES')).toBe(false);
    expect(await speakDriverMessage('STOP. ENGINE HOT.', 'en-US')).toBe(false);
    expect(voice.speakLocalized).not.toHaveBeenCalled();
    expect(voice.speak).not.toHaveBeenCalled();
  });

  it('reports failed, interrupted or unsupported TTS as false', async () => {
    voice.speakAlert?.mockResolvedValue(false);
    expect(await speakDriverMessage('STOP. ENGINE HOT.', 'en-US', 'S3_CRITICAL')).toBe(false);
  });
});
