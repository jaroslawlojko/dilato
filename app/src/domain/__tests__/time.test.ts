import {
  addDays,
  addMinutes,
  atLocalTime,
  dilatoDay,
  localDateString,
  localDateTime,
  minutesBetween,
} from '../time';

describe('test environment', () => {
  it('runs in Europe/Warsaw', () => {
    expect(new Date('2026-01-15T12:00:00Z').getHours()).toBe(13);
  });
});

describe('dilatoDay', () => {
  it('belongs to the previous day before 04:00', () => {
    expect(dilatoDay(new Date('2026-09-30T03:59:00'))).toBe('2026-09-29');
  });

  it('starts a new day at 04:00', () => {
    expect(dilatoDay(new Date('2026-09-30T04:00:00'))).toBe('2026-09-30');
  });

  it('handles month boundaries', () => {
    expect(dilatoDay(new Date('2026-10-01T00:30:00'))).toBe('2026-09-30');
  });

  it('is stable across the DST change (2026-10-25)', () => {
    expect(dilatoDay(new Date('2026-10-25T03:30:00'))).toBe('2026-10-24');
    expect(dilatoDay(new Date('2026-10-25T05:00:00'))).toBe('2026-10-25');
  });
});

describe('date helpers', () => {
  it('formats local dates', () => {
    expect(localDateString(new Date('2026-03-05T23:30:00'))).toBe('2026-03-05');
  });

  it('builds a local date-time', () => {
    expect(localDateTime('2026-09-28', 22, 5)).toEqual(new Date('2026-09-28T22:05:00'));
  });

  it('adds days across month and DST boundaries', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('floors whole minutes', () => {
    expect(minutesBetween(new Date('2026-09-29T07:00:00'), new Date('2026-09-29T07:01:59'))).toBe(1);
  });

  it('measures real elapsed time across DST', () => {
    // 01:00 CEST -> 05:00 CET is 5 real hours
    expect(minutesBetween(new Date('2026-10-25T01:00:00'), new Date('2026-10-25T05:00:00'))).toBe(300);
  });

  it('adds minutes', () => {
    expect(addMinutes(new Date('2026-09-29T07:10:00'), 60)).toEqual(new Date('2026-09-29T08:10:00'));
  });

  it('sets a wall-clock time on the same calendar date', () => {
    expect(atLocalTime(new Date('2026-09-29T07:10:30'), '12:00')).toEqual(new Date('2026-09-29T12:00:00'));
  });
});
