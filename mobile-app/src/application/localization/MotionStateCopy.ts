import type { VoiceLanguage } from '../../domain/driver-intelligence/DriverAlertLexicon';
import { uiMessage, type UiMessageKey } from './UiCatalog';
export function motionUnknownHeading(reason: string, evidenceAvailable: boolean, language: VoiceLanguage): string {
  let key: UiMessageKey;
  if (!evidenceAvailable) key = 'motion.dataLimited';
  else if (reason === 'PARKED_CANDIDATE') key = 'motion.confirmParked';
  else if (reason === 'MOVING_CANDIDATE') key = 'motion.confirmMoving';
  else if (reason === 'MOVING_CANDIDATE_WITH_SOURCE_CONFLICT') key = 'motion.conflict';
  else key = 'motion.indeterminate';
  return uiMessage(key, language);
}
