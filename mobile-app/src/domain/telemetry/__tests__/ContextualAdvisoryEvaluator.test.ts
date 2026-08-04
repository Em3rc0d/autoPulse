import { ContextualAdvisoryEvaluator } from '../ContextualAdvisoryEvaluator';
import { DEMO_PROFILES } from '../SignalProfiles';

describe('ContextualAdvisoryEvaluator', () => {
  describe('Engine Coolant', () => {
    const profile = DEMO_PROFILES.ENGINE_COOLANT;

    it('evaluates boundaries correctly', () => {
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(89, profile)).toBe('WARMING');
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(90, profile)).toBe('NORMAL');
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(105, profile)).toBe('NORMAL');
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(106, profile)).toBe('ELEVATED');
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(115, profile)).toBe('ELEVATED');
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(116, profile)).toBe('CRITICAL');
    });
  });

  describe('Vehicle Speed', () => {
    const profile = DEMO_PROFILES.VEHICLE_SPEED;

    it('evaluates boundaries correctly', () => {
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(0, profile)).toBe('NORMAL');
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(120, profile)).toBe('NORMAL');
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(121, profile)).toBe('ELEVATED');
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(249, profile)).toBe('ELEVATED');
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(250, profile)).toBe('ELEVATED');
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(300, profile)).toBe('ELEVATED');
      expect(ContextualAdvisoryEvaluator.evaluateCandidate(301, profile)).toBe('CRITICAL');
    });
  });

  describe('Engine RPM', () => {
    const profile = DEMO_PROFILES.ENGINE_RPM;

    describe('Stopped (Speed = 0)', () => {
      const context = { speed: { value: 0, quality: 'VALID' as any, observedAt: Date.now() } };

      it('evaluates boundaries correctly', () => {
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(0, profile, context)).toBe('UNKNOWN');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(1, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(599, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(600, profile, context)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(900, profile, context)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(901, profile, context)).toBe('WARMING');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(1200, profile, context)).toBe('WARMING');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(1201, profile, context)).toBe('ELEVATED');
      });
    });

    describe('Running (Speed > 0)', () => {
      const context = { speed: { value: 30, quality: 'VALID' as any, observedAt: Date.now() } };

      it('evaluates boundaries correctly', () => {
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(1499, profile, context)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(1500, profile, context)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(4000, profile, context)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(4001, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(5000, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(5001, profile, context)).toBe('ELEVATED');
      });
    });

    describe('Without speed context', () => {
      it('still evaluates base RPM colors independently', () => {
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(1600, profile)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(4000, profile)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(4001, profile)).toBe('ELEVATED');
      });
    });
  });

  describe('Control Voltage', () => {
    const profile = DEMO_PROFILES.CONTROL_VOLTAGE;

    describe('Engine Running (RPM > 0)', () => {
      const context = { rpm: { value: 800, quality: 'VALID' as any, observedAt: Date.now() } };

      it('evaluates boundaries correctly', () => {
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(13.49, profile, context)).toBe('CRITICAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(13.5, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(13.69, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(13.7, profile, context)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(14.7, profile, context)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(14.71, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(15.0, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(15.01, profile, context)).toBe('CRITICAL');
      });
    });

    describe('Engine Off (RPM = 0)', () => {
      const context = { rpm: { value: 0, quality: 'VALID' as any, observedAt: Date.now() } };

      it('evaluates boundaries correctly', () => {
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(11.99, profile, context)).toBe('CRITICAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(12.0, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(12.39, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(12.4, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(12.59, profile, context)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(12.6, profile, context)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(12.8, profile, context)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(12.81, profile, context)).toBe('UNKNOWN');
      });
    });

    describe('Without RPM context', () => {
      it('uses voltage itself as the fallback operating hint', () => {
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(13.8, profile)).toBe('NORMAL');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(14.9, profile)).toBe('ELEVATED');
        expect(ContextualAdvisoryEvaluator.evaluateCandidate(15.1, profile)).toBe('CRITICAL');
      });
    });
  });
});
