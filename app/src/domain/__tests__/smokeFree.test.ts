import { startChallenge, interrupt } from '../challenge';
import { defaultLastCigaretteAt, longestSmokeFreeMinutes, smokeFreeMinutes } from '../smokeFree';
import { closedChallenge } from '../testing/fixtures';

const running = () =>
  startChallenge({
    id: 'r',
    now: new Date('2026-09-29T07:10:00'),
    lastCigaretteAt: new Date('2026-09-28T22:05:00'),
    choice: { ladderKey: 'h1' },
  });

describe('smokeFreeMinutes', () => {
  it('counts live while the challenge runs', () => {
    expect(smokeFreeMinutes(running(), new Date('2026-09-29T07:15:00'))).toBe(550);
  });

  it('stops at the first cigarette (challenge end)', () => {
    const c = interrupt(running(), new Date('2026-09-29T07:51:00'));
    expect(smokeFreeMinutes(c, new Date('2026-09-29T20:00:00'))).toBe(586);
  });
});

describe('longestSmokeFreeMinutes', () => {
  it('is the maximum over closed challenges and 0 without any', () => {
    expect(longestSmokeFreeMinutes([])).toBe(0);
    const short = closedChallenge({ id: 'a', day: '2026-09-27', outcome: 'interrupted', interruptedAfterMinutes: 10 });
    const long = closedChallenge({ id: 'b', day: '2026-09-28', ladderKey: 'h2', outcome: 'completed' });
    expect(longestSmokeFreeMinutes([short, long, running()])).toBe(540 + 120);
  });
});

describe('defaultLastCigaretteAt', () => {
  it('defaults to 22:00 the previous day', () => {
    expect(defaultLastCigaretteAt(new Date('2026-09-29T07:00:00'), null)).toEqual(new Date('2026-09-28T22:00:00'));
  });

  it('reuses the previous answer time', () => {
    expect(defaultLastCigaretteAt(new Date('2026-09-29T07:00:00'), new Date('2026-09-27T23:40:00')))
      .toEqual(new Date('2026-09-28T23:40:00'));
  });

  it('places answers after midnight on the right calendar date', () => {
    expect(defaultLastCigaretteAt(new Date('2026-09-29T07:00:00'), new Date('2026-09-28T01:15:00')))
      .toEqual(new Date('2026-09-29T01:15:00'));
  });

  it('works when asked after midnight', () => {
    // 02:00 on 09-30 is still Dilato day 09-29, so "yesterday" is 09-28
    expect(defaultLastCigaretteAt(new Date('2026-09-30T02:00:00'), new Date('2026-09-27T23:40:00')))
      .toEqual(new Date('2026-09-28T23:40:00'));
  });
});
