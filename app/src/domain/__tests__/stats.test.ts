import { startChallenge } from '../challenge';
import {
  PIGGY_BANK_THRESHOLD,
  activeDays,
  cigarettesNotSmoked,
  morningStreak,
  recordOf,
  savings,
  sevenDayAverage,
  timeRegainedMinutes,
  timelineRows,
  totalResultMinutes,
} from '../stats';
import { closedChallenge } from '../testing/fixtures';

const done = (id: string, day: string, ladderKey: 'm30' | 'm45' | 'h1' = 'm30') =>
  closedChallenge({ id, day, ladderKey, outcome: 'completed' });
const failed = (id: string, day: string, after: number) =>
  closedChallenge({ id, day, ladderKey: 'h1', outcome: 'interrupted', interruptedAfterMinutes: after });

describe('activeDays and morningStreak', () => {
  it('keeps the streak across spring-forward (2026-03-29)', () => {
    const cs = [done('a', '2026-03-28'), done('b', '2026-03-29'), done('c', '2026-03-30')];
    expect(morningStreak(cs, new Date('2026-03-30T12:00:00'))).toBe(3);
  });

  it('counts consecutive days including interrupted ones', () => {
    const cs = [done('a', '2026-09-25'), failed('b', '2026-09-26', 5), done('c', '2026-09-27'),
      done('d', '2026-09-28'), done('e', '2026-09-29')];
    expect(morningStreak(cs, new Date('2026-09-29T12:00:00'))).toBe(5);
  });

  it('breaks on a gap', () => {
    const cs = [done('a', '2026-09-25'), done('c', '2026-09-28'), done('d', '2026-09-29')];
    expect(morningStreak(cs, new Date('2026-09-29T12:00:00'))).toBe(2);
  });

  it(`keeps yesterday's streak alive before today's challenge starts`, () => {
    const cs = [done('a', '2026-09-28'), done('b', '2026-09-29')];
    expect(morningStreak(cs, new Date('2026-09-30T06:00:00'))).toBe(2);
    expect(morningStreak(cs, new Date('2026-10-01T06:00:00'))).toBe(0);
  });

  it('counts both days of a running 24 h challenge', () => {
    const c = startChallenge({
      id: 'x',
      now: new Date('2026-09-28T07:10:00'),
      lastCigaretteAt: new Date('2026-09-27T22:00:00'),
      choice: { ladderKey: 'h24' },
    });
    expect([...activeDays([c], new Date('2026-09-29T06:00:00'))]).toEqual(['2026-09-28', '2026-09-29']);
  });

  it('does not count days after an abandoned challenge reached its goal', () => {
    const c = startChallenge({
      id: 'x',
      now: new Date('2026-09-20T07:10:00'),
      lastCigaretteAt: new Date('2026-09-19T22:00:00'),
      choice: { ladderKey: 'h1' },
    });
    expect([...activeDays([c], new Date('2026-09-29T06:00:00'))]).toEqual(['2026-09-20']);
  });
});

describe('record and average', () => {
  it('finds the longest result, including interrupted ones', () => {
    expect(recordOf([])).toBeNull();
    const cs = [done('a', '2026-09-27'), failed('b', '2026-09-28', 41), done('c', '2026-09-29', 'm45')];
    expect(recordOf(cs)).toEqual({ minutes: 45, day: '2026-09-29' });
  });

  it('averages the last 7 Dilato days', () => {
    const cs = [done('old', '2026-09-20'), done('a', '2026-09-24'), failed('b', '2026-09-29', 41)];
    expect(sevenDayAverage(cs, new Date('2026-09-29T12:00:00'))).toBe(36); // (30 + 41) / 2 rounded
    expect(sevenDayAverage([done('old', '2026-09-20')], new Date('2026-09-29T12:00:00'))).toBeNull();
  });
});

describe('money and time', () => {
  it('reports no savings for an invalid pack size', () => {
    expect(savings({ totalMinutes: 1024, cigsPerDay: 15, packPrice: 18, packSize: 0 })).toBe(0);
  });

  it('estimates cigarettes, savings and time regained', () => {
    expect(cigarettesNotSmoked(1024, 15)).toBe(16);
    expect(savings({ totalMinutes: 1024, cigsPerDay: 15, packPrice: 18, packSize: 20 })).toBe(14.4);
    expect(timeRegainedMinutes(1024, 15)).toBe(80);
  });

  it('sums closed results only', () => {
    const running = startChallenge({
      id: 'r',
      now: new Date('2026-09-29T07:10:00'),
      lastCigaretteAt: new Date('2026-09-28T22:00:00'),
      choice: { ladderKey: 'h1' },
    });
    expect(totalResultMinutes([done('a', '2026-09-27'), failed('b', '2026-09-28', 41), running])).toBe(71);
  });

  it('defines the piggy-bank thresholds per currency', () => {
    expect(PIGGY_BANK_THRESHOLD).toEqual({ PLN: 100, EUR: 25, USD: 25, GBP: 20 });
  });
});

describe('timelineRows', () => {
  it('marks success, record, interrupted and empty days', () => {
    const cs = [done('a', '2026-09-27'), done('b', '2026-09-28', 'm45'), failed('c', '2026-09-29', 41)];
    expect(timelineRows(cs, '2026-09-26', '2026-09-29')).toEqual([
      { day: '2026-09-26', minutes: 0, kind: 'empty' },
      { day: '2026-09-27', minutes: 30, kind: 'success' },
      { day: '2026-09-28', minutes: 45, kind: 'record' },
      { day: '2026-09-29', minutes: 41, kind: 'interrupted' },
    ]);
  });
});
