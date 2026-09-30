import { startChallenge } from '../challenge';
import { BODY_BENEFITS, bestSmokeFreeMinutes, nextBenefit, unlockedBenefits } from '../body';
import { closedChallenge } from '../testing/fixtures';

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

  it('does not keep counting after an abandoned challenge was closed by rollover', () => {
    const abandoned = startChallenge({
      id: 'x',
      now: new Date('2026-09-29T07:10:00'),
      lastCigaretteAt: new Date('2026-09-28T22:00:00'),
      choice: { ladderKey: 'm30' },
    });
    // goal 07:40; first cigarette assumed at the goal → 9 h 40 min, whenever it is read
    expect(bestSmokeFreeMinutes([abandoned], new Date('2026-10-02T09:00:00'))).toBe(580);
  });

  it('reports the next card with progress', () => {
    const next = nextBenefit(860);
    expect(next?.id).toBe('b_24h');
    expect(next?.progress).toBeCloseTo(860 / 1440);
    expect(nextBenefit(525600)).toBeNull();
  });

  it('uses the live value when it beats the longest closed one', () => {
    const closed = closedChallenge({ id: 'a', day: '2026-09-28', outcome: 'completed' }); // 570
    const live = startChallenge({
      id: 'b',
      now: new Date('2026-09-29T07:10:00'),
      lastCigaretteAt: new Date('2026-09-28T20:00:00'),
      choice: { ladderKey: 'h1' },
    });
    expect(bestSmokeFreeMinutes([closed], new Date('2026-09-29T07:10:00'))).toBe(570);
    expect(bestSmokeFreeMinutes([closed, live], new Date('2026-09-29T07:40:00'))).toBe(700);
  });
});
