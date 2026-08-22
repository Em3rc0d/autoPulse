import {
  createDriverVoiceMemory,
  decideAdvisoryVoice,
  decideStartupVoice,
  markAdvisorySpoken,
  markStartupSpoken,
  type DriverAdvisory,
} from '..';

const warning: DriverAdvisory = {
  id: 'dtc:CONFIRMED:P0302',
  severity: 'WARNING',
  title: 'Engine warning',
  shortMessage: 'Cylinder two misfire detected',
  voiceMessage: 'Cylinder two misfire detected.',
  confidence: 'HIGH',
  evidence: [{ kind: 'DTC', reference: 'P0302' }],
  startedAt: 1_000,
  cooldownMs: 60_000,
};

describe('Driver voice policy', () => {
  it('speaks startup briefing only once', () => {
    const briefing = {
      headline: '1 important warning',
      voiceMessage: 'AutoPulse ready. One engine warning.',
      advisories: [warning],
    };
    const memory = createDriverVoiceMemory();

    expect(decideStartupVoice(briefing, memory)).toEqual({
      shouldSpeak: true,
      message: briefing.voiceMessage,
      reason: 'STARTUP',
    });

    expect(decideStartupVoice(briefing, markStartupSpoken(memory))).toEqual({
      shouldSpeak: false,
      reason: 'SILENT',
    });
  });

  it('keeps info and notice advisories silent by default', () => {
    const memory = createDriverVoiceMemory();
    const info = { ...warning, id: 'info', severity: 'INFO' as const };
    const notice = { ...warning, id: 'notice', severity: 'NOTICE' as const };

    expect(decideAdvisoryVoice(info, memory, 2_000).shouldSpeak).toBe(false);
    expect(decideAdvisoryVoice(notice, memory, 2_000).shouldSpeak).toBe(false);
  });

  it('speaks a warning on change and suppresses repetition inside cooldown', () => {
    const memory = createDriverVoiceMemory();
    const first = decideAdvisoryVoice(warning, memory, 2_000);
    expect(first.reason).toBe('NEW_WARNING');
    expect(first.shouldSpeak).toBe(true);

    const afterSpeech = markAdvisorySpoken(memory, warning.id, 2_000);
    expect(decideAdvisoryVoice(warning, afterSpeech, 30_000)).toEqual({
      shouldSpeak: false,
      reason: 'COOLDOWN',
    });

    expect(decideAdvisoryVoice(warning, afterSpeech, 62_001).shouldSpeak).toBe(true);
  });
});
