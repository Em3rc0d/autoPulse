import type { DriverAdvisory, StartupBriefing } from './models';
import type { StartupAssessmentState } from './StartupAssessment';

export interface DriverVoiceMemory {
  startupSpoken: boolean;
  advisoryLastSpokenAt: Record<string, number>;
}

export interface DriverVoiceDecision {
  shouldSpeak: boolean;
  message?: string;
  reason: 'STARTUP' | 'NEW_WARNING' | 'NEW_CRITICAL' | 'COOLDOWN' | 'SILENT' | 'NO_MESSAGE' | 'SCAN_IN_PROGRESS';
}

export const createDriverVoiceMemory = (): DriverVoiceMemory => ({
  startupSpoken: false,
  advisoryLastSpokenAt: {},
});

export function decideStartupVoice(
  briefing: StartupBriefing,
  memory: DriverVoiceMemory,
): DriverVoiceDecision {
  if (memory.startupSpoken) {
    return { shouldSpeak: false, reason: 'SILENT' };
  }

  const message = briefing.voiceMessage?.trim();
  if (!message) {
    return { shouldSpeak: false, reason: 'NO_MESSAGE' };
  }

  return { shouldSpeak: true, message, reason: 'STARTUP' };
}

/**
 * Normal startup voice is gated by assessment maturity. A real warning/critical
 * advisory can still be spoken immediately through decideAdvisoryVoice while the
 * deeper diagnostic/cold-start scan continues.
 */
export function decideStartupVoiceWhenReady(
  briefing: StartupBriefing,
  memory: DriverVoiceMemory,
  assessment: StartupAssessmentState,
): DriverVoiceDecision {
  if (!assessment.canBrief || assessment.scanInProgress) {
    return { shouldSpeak: false, reason: 'SCAN_IN_PROGRESS' };
  }

  return decideStartupVoice(briefing, memory);
}

export function decideAdvisoryVoice(
  advisory: DriverAdvisory,
  memory: DriverVoiceMemory,
  nowMs: number,
): DriverVoiceDecision {
  const message = advisory.voiceMessage?.trim();
  if (!message) {
    return { shouldSpeak: false, reason: 'NO_MESSAGE' };
  }

  // INFO and NOTICE remain visual by default. Driver voice is reserved for
  // warnings and critical state changes so AutoPulse does not chatter.
  if (advisory.severity !== 'WARNING' && advisory.severity !== 'CRITICAL') {
    return { shouldSpeak: false, reason: 'SILENT' };
  }

  const lastSpokenAt = memory.advisoryLastSpokenAt[advisory.id];
  if (lastSpokenAt !== undefined && nowMs - lastSpokenAt < advisory.cooldownMs) {
    return { shouldSpeak: false, reason: 'COOLDOWN' };
  }

  return {
    shouldSpeak: true,
    message,
    reason: advisory.severity === 'CRITICAL' ? 'NEW_CRITICAL' : 'NEW_WARNING',
  };
}

export function markStartupSpoken(memory: DriverVoiceMemory): DriverVoiceMemory {
  return { ...memory, startupSpoken: true };
}

export function markAdvisorySpoken(
  memory: DriverVoiceMemory,
  advisoryId: string,
  spokenAtMs: number,
): DriverVoiceMemory {
  return {
    ...memory,
    advisoryLastSpokenAt: {
      ...memory.advisoryLastSpokenAt,
      [advisoryId]: spokenAtMs,
    },
  };
}
