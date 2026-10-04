import { BODY_BENEFITS, nextBenefit, unlockedBenefits } from '../body';

describe('body benefits', () => {
  it('has ten thresholds from 5 minutes to 1 year', () => {
    expect(BODY_BENEFITS.map((b) => b.minutes)).toEqual([
      5, 20, 480, 720, 1440, 2880, 4320, 20160, 43200, 525600,
    ]);
  });

  it('unlocks cards up to the best smoke-free time', () => {
    expect(unlockedBenefits(0)).toEqual([]);
    expect(unlockedBenefits(5)).toEqual(['b_5m']);
    expect(unlockedBenefits(860)).toEqual(['b_5m', 'b_20m', 'b_8h', 'b_12h']);
  });

  it('reports the next card with progress', () => {
    const next = nextBenefit(860);
    expect(next?.id).toBe('b_24h');
    expect(next?.progress).toBeCloseTo(860 / 1440);
    expect(nextBenefit(525600)).toBeNull();
  });
});
