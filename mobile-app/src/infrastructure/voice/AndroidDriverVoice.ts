import { NativeModules, Platform } from 'react-native';

interface AutoPulseVoiceNativeModule {
  speak(text: string): Promise<boolean>;
  stop(): Promise<boolean>;
}

const nativeVoice = NativeModules.AutoPulseVoice as AutoPulseVoiceNativeModule | undefined;

export async function speakDriverMessage(message: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeVoice || !message.trim()) return false;
  try {
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
