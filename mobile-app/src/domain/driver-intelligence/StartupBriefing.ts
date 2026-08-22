import type { DriverAdvisory, StartupBriefing } from './models';

export function buildStartupBriefing(advisories: readonly DriverAdvisory[]): StartupBriefing {
  const active = [...advisories];
  const warnings = active.filter(item => item.severity === 'WARNING' || item.severity === 'CRITICAL');

  const headline = warnings.length > 0
    ? `${warnings.length} important warning${warnings.length === 1 ? '' : 's'}`
    : 'Startup scan complete';

  const spoken = active
    .filter(item => item.voiceMessage)
    .slice(0, 3)
    .map(item => item.voiceMessage as string);

  // "AutoPulse ready" means the app's startup assessment is mature enough to
  // brief the driver; it is deliberately not a claim that the entire vehicle is healthy.
  const voiceMessage = ['AutoPulse ready.', ...spoken].join(' ');

  return {
    headline,
    voiceMessage,
    advisories: active,
  };
}
