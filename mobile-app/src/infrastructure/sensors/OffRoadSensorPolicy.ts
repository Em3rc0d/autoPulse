export const OFF_ROAD_MOTION_UI_MIN_INTERVAL_MS = 200;
export const OFF_ROAD_CONTEXT_PUBLISH_INTERVAL_MS = 1000;

export function shouldPublishSidecarSample(
  lastPublishedAt: number,
  candidateObservedAt: number,
  minimumIntervalMs: number,
): boolean {
  if (!Number.isFinite(candidateObservedAt)) return false;
  if (!Number.isFinite(lastPublishedAt) || lastPublishedAt <= 0) return true;
  return candidateObservedAt - lastPublishedAt >= minimumIntervalMs;
}
