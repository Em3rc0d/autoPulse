import {
  OFF_ROAD_CONTEXT_PUBLISH_INTERVAL_MS,
  OFF_ROAD_MOTION_UI_MIN_INTERVAL_MS,
  shouldPublishSidecarSample,
} from '../OffRoadSensorPolicy';

describe('OffRoadSensorPolicy', () => {
  it('accepts the first sidecar sample immediately', () => {
    expect(shouldPublishSidecarSample(0, 1000, OFF_ROAD_MOTION_UI_MIN_INTERVAL_MS)).toBe(true);
  });

  it('throttles motion samples so phone sensors cannot flood the JS bridge', () => {
    expect(shouldPublishSidecarSample(1000, 1100, OFF_ROAD_MOTION_UI_MIN_INTERVAL_MS)).toBe(false);
    expect(shouldPublishSidecarSample(1000, 1200, OFF_ROAD_MOTION_UI_MIN_INTERVAL_MS)).toBe(true);
  });

  it('publishes driver-intelligence observations at human-timescale cadence', () => {
    expect(shouldPublishSidecarSample(5000, 5999, OFF_ROAD_CONTEXT_PUBLISH_INTERVAL_MS)).toBe(false);
    expect(shouldPublishSidecarSample(5000, 6000, OFF_ROAD_CONTEXT_PUBLISH_INTERVAL_MS)).toBe(true);
  });

  it('rejects invalid timestamps instead of creating an unbounded publish loop', () => {
    expect(shouldPublishSidecarSample(1000, Number.NaN, OFF_ROAD_CONTEXT_PUBLISH_INTERVAL_MS)).toBe(false);
  });
});
