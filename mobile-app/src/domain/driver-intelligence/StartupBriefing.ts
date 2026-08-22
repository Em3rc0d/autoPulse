import type { DriverAdvisory, StartupBriefing } from './models';

export function buildStartupBriefing(advisories: readonly DriverAdvisory[]): StartupBriefing {
  const active = [...advisories];
  const warnings = active.filter(item => item.severity === 'WARNING' || item.severity === 'CRITICAL');

  const headline = warnings.length > 0
    ? `${warnings.length} important warning${warnings.length === 1 ? '' : 's'}`
    : 'Vehicle ready';

  const spoken = active
    .filter(item => item.voiceMessage)
    .slice(0, 3)
    .map(item => item.voiceMessage as string);

  const voiceMessage = ['AutoPulse ready.', ...spoken].join(' ');

  return {
    headline,
    voiceMessage,
    advisories: active,
  };
}
