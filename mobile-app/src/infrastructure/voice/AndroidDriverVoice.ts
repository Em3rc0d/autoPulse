import { NativeModules, Platform } from 'react-native';
import type { VoiceLanguage } from '../../domain/driver-intelligence/DriverAlertLexicon';

interface AutoPulseVoiceNativeModule {
  speak(text: string): Promise<boolean>;
  speakLocalized?: (text: string, languageTag: VoiceLanguage) => Promise<boolean>;
  stop(): Promise<boolean>;
}

const nativeVoice = NativeModules.AutoPulseVoice as AutoPulseVoiceNativeModule | undefined;

export async function speakDriverMessage(
  message: string,
  language: VoiceLanguage = 'en-US',
): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeVoice || !message.trim()) return false;
  try {
    if (nativeVoice.speakLocalized) {
      return await nativeVoice.speakLocalized(message.trim(), language);
    }
    return await nativeVoice.speak(message.trim());
  } catch (error) {
    console.warn('[AutoPulseVoice] Speech degraded:', error);
    return false;
  }
}

export async function stopDriverVoice(): Promise<void> {
  if (Platform.OS !== 'android' || !nativeVoice) return;
  try {
    await nativeVoice.stop();
  } catch (error) {
    console.warn('[AutoPulseVoice] Stop degraded:', error);
  }
}
