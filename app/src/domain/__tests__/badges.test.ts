import { addOvertime, startChallenge } from '../challenge';
import {
  TOTAL_BADGES,
  celebrationTier,
  isNewRecord,
  newBadges,
  thresholdBadgesReached,
  type BadgeContext,
  type BadgeId,
} from '../badges';
import { closedChallenge } from '../testing/fixtures';

const ctx = (over: Partial<BadgeContext>): BadgeContext => ({
  challenges: [],
  earned: new Set<BadgeId>(),
  totalSavings: 0,
  currency: 'PLN',
  now: new Date('2026-09-29T12:00:00'),
  ...over,
});

const hourChallenge = () =>
  startChallenge({
    id: 'h',
    now: new Date('2026-09-29T07:10:00'),
    lastCigaretteAt: new Date('2026-09-28T22:00:00'),
    choice: { ladderKey: 'h1' },
  });

describe('catalogue', () => {
  it('has 22 badges', () => {
    expect(TOTAL_BADGES).toBe(22);
  });

  it('awards MVP thresholds only, up to 24 h', () => {
    expect(thresholdBadgesReached(14)).toEqual([]);
    expect(thresholdBadgesReached(60)).toEqual(['t_15m', 't_30m', 't_45m', 't_1h']);
    expect(thresholdBadgesReached(5000)).toEqual([
      't_15m', 't_30m', 't_45m', 't_1h', 't_2h', 't_3h', 't_6h', 't_12h', 't_24h',
    ]);
  });
});

describe('newBadges', () => {
  it('awards nothing while a challenge is still running', () => {
    expect(newBadges(ctx({ challenges: [hourChallenge()], now: new Date('2026-09-29T07:50:00') }))).toEqual([]);
  });

  it('awards thresholds once the goal is reached, skipping earned ones', () => {
    const now = new Date('2026-09-29T08:10:00');
    expect(newBadges(ctx({ challenges: [hourChallenge()], now }))).toEqual(['t_15m', 't_30m', 't_45m', 't_1h']);
    expect(
      newBadges(ctx({ challenges: [hourChallenge()], now, earned: new Set<BadgeId>(['t_15m', 't_30m']) })),
    ).toEqual(['t_45m', 't_1h']);
  });

  it('counts overtime toward thresholds and awards Dokładka for a full block', () => {
    const c = addOvertime(hourChallenge(), 60, new Date('2026-09-29T08:10:00'));
    const now = new Date('2026-09-29T09:15:00');
    expect(newBadges(ctx({ challenges: [c], now }))).toEqual([
      't_15m', 't_30m', 't_45m', 't_1h', 't_2h', 'extra_time',
    ]);
  });

  it('awards Pięć poranków after 5 consecutive days', () => {
    const cs = ['25', '26', '27', '28', '29'].map((d) =>
      closedChallenge({ id: d, day: `2026-09-${d}`, outcome: 'interrupted', interruptedAfterMinutes: 5 }),
    );
    expect(newBadges(ctx({ challenges: cs }))).toContain('five_mornings');
    expect(newBadges(ctx({ challenges: cs.slice(1) }))).not.toContain('five_mornings');
  });

  it('awards Szczerość for coming back the morning after an interruption', () => {
    const fail = closedChallenge({ id: 'f', day: '2026-09-28', outcome: 'interrupted' });
    const next = closedChallenge({ id: 'n', day: '2026-09-29', outcome: 'completed' });
    expect(newBadges(ctx({ challenges: [fail, next] }))).toContain('honesty');
    expect(newBadges(ctx({ challenges: [fail] }))).not.toContain('honesty');
  });

  it('awards Mistrz fali after 3 completed challenges with breathing help', () => {
    const helped = (id: string, day: string, outcome: 'completed' | 'interrupted') =>
      closedChallenge({ id, day, outcome, usedCravingHelp: true });
    const two = [helped('a', '2026-09-25', 'completed'), helped('b', '2026-09-26', 'completed')];
    expect(newBadges(ctx({ challenges: [...two, helped('c', '2026-09-27', 'interrupted')] }))).not.toContain('wave_master');
    expect(newBadges(ctx({ challenges: [...two, helped('c', '2026-09-27', 'completed')] }))).toContain('wave_master');
  });

  it('awards Skarbonka at the currency threshold', () => {
    expect(newBadges(ctx({ totalSavings: 99.99 }))).not.toContain('piggy_bank');
    expect(newBadges(ctx({ totalSavings: 100 }))).toContain('piggy_bank');
    expect(newBadges(ctx({ totalSavings: 25, currency: 'EUR' }))).toContain('piggy_bank');
  });

  it('never awards new_record (handled by isNewRecord)', () => {
    const cs = [
      closedChallenge({ id: 'a', day: '2026-09-28', outcome: 'completed' }),
      closedChallenge({ id: 'b', day: '2026-09-29', ladderKey: 'm45', outcome: 'completed' }),
    ];
    expect(newBadges(ctx({ challenges: cs }))).not.toContain('new_record');
  });
});

describe('isNewRecord', () => {
  const first = closedChallenge({ id: 'a', day: '2026-09-27', outcome: 'completed' }); // 30
  const better = closedChallenge({ id: 'b', day: '2026-09-28', ladderKey: 'm45', outcome: 'completed' }); // 45
  const worse = closedChallenge({ id: 'c', day: '2026-09-29', outcome: 'completed' }); // 30
  const failedLong = closedChallenge({
    id: 'd', day: '2026-09-29', ladderKey: 'h1', outcome: 'interrupted', interruptedAfterMinutes: 50,
  });

  it('is false for the very first result', () => {
    expect(isNewRecord(first, [first])).toBe(false);
  });

  it('is true when the previous best is beaten, even by an interrupted attempt', () => {
    expect(isNewRecord(better, [first, better])).toBe(true);
    expect(isNewRecord(failedLong, [first, better, failedLong])).toBe(true);
  });

  it('is false when not beaten', () => {
    expect(isNewRecord(worse, [first, better, worse])).toBe(false);
  });
});

describe('celebrationTier', () => {
  it('uses the highest threshold badge awarded', () => {
    expect(celebrationTier(['t_15m', 't_30m'], 30)).toBe('small');
    expect(celebrationTier(['t_15m', 't_30m', 't_45m', 't_1h'], 60)).toBe('medium');
    expect(celebrationTier(['t_24h'], 1440)).toBe('large');
  });

  it('falls back to the reached minutes when no threshold badge is new', () => {
    expect(celebrationTier([], 45)).toBe('small');
    expect(celebrationTier(['extra_time'], 90)).toBe('medium');
    expect(celebrationTier([], 1440)).toBe('large');
  });
});
