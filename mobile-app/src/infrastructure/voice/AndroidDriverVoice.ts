import { NativeModules, Platform } from 'react-native';
import type { DriverAlertSeverity, VoiceLanguage } from '../../domain/driver-intelligence/DriverAlertLexicon';

interface AutoPulseVoiceNativeModule {
  speak(text: string): Promise<boolean>;
  speakLocalized?: (text: string, languageTag: VoiceLanguage) => Promise<boolean>;
  speakAlert?: (text: string, languageTag: VoiceLanguage, priority: number) => Promise<boolean>;
  stop(): Promise<boolean>;
}

const nativeVoice = NativeModules.AutoPulseVoice as AutoPulseVoiceNativeModule | undefined;

export async function speakDriverMessage(
  message: string,
  language: VoiceLanguage = 'en-US',
  severity: DriverAlertSeverity = 'S2_ATTENTION',
): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeVoice || !message.trim()) return false;
  try {
    // Legacy speak()/speakLocalized() returned true at enqueue, not at audio
    // completion. For driver-safety alerts, that is not acceptable evidence.
    if (!nativeVoice.speakAlert) return false;
    const priorities: Record<DriverAlertSeverity, number> = {
      S0_NORMAL: 0,
      S1_ADVISORY: 1,
      S2_ATTENTION: 2,
      S3_CRITICAL: 3,
    };
    return await nativeVoice.speakAlert(message.trim(), language, priorities[severity]);
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
