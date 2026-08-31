import { NativeModules, Platform } from 'react-native';
import {
  resolveDriverAlertMessage,
  type DriverAlertKey,
  type DriverVoiceLanguage,
} from '../../domain/driver-intelligence/DriverAlertLexicon';
import { loadDriverVoiceLanguage } from './DriverVoicePreferences';

interface AutoPulseVoiceNativeModule {
  speak(text: string, languageTag: DriverVoiceLanguage): Promise<boolean>;
  stop(): Promise<boolean>;
}

const nativeVoice = NativeModules.AutoPulseVoice as AutoPulseVoiceNativeModule | undefined;

async function speakWithLanguage(message: string, language: DriverVoiceLanguage): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeVoice || !message.trim()) return false;
  try {
    return await nativeVoice.speak(message.trim(), language);
  } catch (error) {
    console.warn('[AutoPulseVoice] Speech degraded:', error);
    return false;
  }
}

export async function speakDriverMessage(message: string): Promise<boolean> {
  const language = await loadDriverVoiceLanguage();
  return speakWithLanguage(message, language);
}

export async function speakDriverAlert(key: DriverAlertKey): Promise<boolean> {
  const language = await loadDriverVoiceLanguage();
  return speakWithLanguage(resolveDriverAlertMessage(key, language), language);
}

export async function stopDriverVoice(): Promise<void> {
  if (Platform.OS !== 'android' || !nativeVoice) return;
  try {
    await nativeVoice.stop();
  } catch (error) {
    console.warn('[AutoPulseVoice] Stop degraded:', error);
  }
}
