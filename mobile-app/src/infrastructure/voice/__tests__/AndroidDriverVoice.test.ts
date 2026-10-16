jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: { AutoPulseVoice: {
    speak: jest.fn(async () => true),
    speakLocalized: jest.fn(async () => true),
    stop: jest.fn(async () => true),
  } },
}));
import { NativeModules } from 'react-native';
import { speakDriverMessage } from '../AndroidDriverVoice';
describe('Android voice locale smoke', () => {
  const voice = NativeModules.AutoPulseVoice as { speak: jest.Mock; speakLocalized?: jest.Mock; stop: jest.Mock };
  beforeEach(() => { voice.speak.mockClear(); voice.speakLocalized = jest.fn(async () => true); });
  it('routes Spanish through the localized TTS method', async () => {
    expect(await speakDriverMessage('ALTO. MOTOR CALIENTE.', 'es-ES')).toBe(true);
    expect(voice.speakLocalized).toHaveBeenCalledWith('ALTO. MOTOR CALIENTE.', 'es-ES');
    expect(voice.speak).not.toHaveBeenCalled();
  });
  it('fails closed rather than using an English voice for Spanish', async () => {
    voice.speakLocalized = undefined;
    expect(await speakDriverMessage('ALTO. MOTOR CALIENTE.', 'es-ES')).toBe(false);
    expect(voice.speak).not.toHaveBeenCalled();
    expect(await speakDriverMessage('STOP. ENGINE HOT.', 'en-US')).toBe(true);
  });
  it('never invents TTS acceptance after failure', async () => {
    voice.speakLocalized?.mockResolvedValue(false);
    expect(await speakDriverMessage('STOP. ENGINE HOT.', 'en-US')).toBe(false);
  });
});
