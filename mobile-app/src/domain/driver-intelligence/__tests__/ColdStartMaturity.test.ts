import { resolveColdStartMaturity } from '../ColdStartMaturity';

const observation = (overrides: Partial<{
  value: number;
  firstValue: number;
  firstObservedAt: number;
  observedAt: number;
  sampleCount: number;
}> = {}) => ({
  value: 90,
  firstValue: 88,
  firstObservedAt: 0,
  observedAt: 12_000,
  sampleCount: 6,
  quality: 'VALID' as const,
  ...overrides,
});

describe('ColdStartMaturity', () => {
  it('does not mature without real RPM and coolant evidence', () => {
    expect(resolveColdStartMaturity({ nowMs: 20_000 }).complete).toBe(false);
  });

  it('matures a warm restart after a short stable observation window', () => {
    const result = resolveColdStartMaturity({
      rpm: observation({ value: 820, firstValue: 980 }),
      coolant: observation({ value: 91, firstValue: 89 }),
      nowMs: 12_000,
    });
    expect(result).toMatchObject({ complete: true, kind: 'WARM', reason: 'WARM_START_STABLE' });
  });

  it('keeps a cold start open until actual warm-up evidence exists', () => {
    const result = resolveColdStartMaturity({
      rpm: observation({ value: 900, firstValue: 1250, sampleCount: 12, observedAt: 40_000 }),
      coolant: observation({ value: 51, firstValue: 50, sampleCount: 12, observedAt: 40_000 }),
      nowMs: 40_000,
    });
    expect(result.complete).toBe(false);
    expect(result.kind).toBe('COLD');
  });

  it('matures a cold start when warming is directly observed', () => {
    const result = resolveColdStartMaturity({
      rpm: observation({ value: 850, firstValue: 1200, sampleCount: 12, observedAt: 40_000 }),
      coolant: observation({ value: 54, firstValue: 50, sampleCount: 12, observedAt: 40_000 }),
      nowMs: 40_000,
    });
    expect(result).toMatchObject({ complete: true, kind: 'COLD', reason: 'COLD_START_WARMING_OBSERVED' });
  });
});
