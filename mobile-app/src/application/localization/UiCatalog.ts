import en from './messages.en.json';
import es from './messages.es.json';
import type { VoiceLanguage } from '../../domain/driver-intelligence/DriverAlertLexicon';
export type UiMessageKey = keyof typeof en;
const spanish: Record<UiMessageKey, string> = es;
const english: Record<UiMessageKey, string> = en;
export function uiMessage(key: UiMessageKey, language: VoiceLanguage): string {
  return (language === 'es-ES' ? spanish : english)[key];
}
