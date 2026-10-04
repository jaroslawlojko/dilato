import { advance, isClosed, type Challenge } from './challenge';
import { addDays, dilatoDay } from './time';

export type Currency = 'PLN' | 'EUR' | 'USD' | 'GBP';

export const WAKING_MINUTES = 960;
export const MINUTES_PER_CIGARETTE = 5;

/** Last moment a challenge was genuinely active (never "now" for a forgotten, already-achieved one). */
function activeUntil(ch: Challenge, now: Date): Date {
  const c = advance(ch, now);
  if (isClosed(c)) return c.endedAt;
  return c.status === 'achieved' && c.achievedAt ? c.achievedAt : now;
}

/** Dilato days on which a challenge was started or running. */
export function activeDays(challenges: readonly Challenge[], now: Date): Set<string> {
  const days = new Set<string>();
  for (const c of challenges) {
    days.add(c.day);
    const last = dilatoDay(activeUntil(c, now));
    for (let d = c.day; d <= last; d = addDays(d, 1)) days.add(d);
  }
  return days;
}

/** "Seria poranków": consecutive active days ending today (or yesterday, before today's start). */
export function morningStreak(challenges: readonly Challenge[], now: Date): number {
  const days = activeDays(challenges, now);
  let d = dilatoDay(now);
  if (!days.has(d)) d = addDays(d, -1);
  let streak = 0;
  while (days.has(d)) {
    streak += 1;
    d = addDays(d, -1);
  }
  return streak;
}

/** A result is a new record when it beats an earlier record, and an earlier record exists. */
export function beatsRecord(minutes: number, previousBest: number): boolean {
  return previousBest > 0 && minutes > previousBest;
}

export function recordOf(challenges: readonly Challenge[]): { minutes: number; day: string } | null {
  let best: { minutes: number; day: string } | null = null;
  for (const c of challenges.filter(isClosed)) {
    if (!best || c.resultMinutes > best.minutes) best = { minutes: c.resultMinutes, day: c.day };
  }
  return best;
}

export function sevenDayAverage(challenges: readonly Challenge[], now: Date): number | null {
  const from = addDays(dilatoDay(now), -6);
  const recent = challenges.filter(isClosed).filter((c) => c.day >= from);
  if (recent.length === 0) return null;
  const sum = recent.reduce((s, c) => s + c.resultMinutes, 0);
  return Math.round(sum / recent.length);
}

export function totalResultMinutes(challenges: readonly Challenge[]): number {
  return challenges.filter(isClosed).reduce((s, c) => s + c.resultMinutes, 0);
}

export function cigarettesNotSmoked(totalMinutes: number, cigsPerDay: number): number {
  return (totalMinutes * cigsPerDay) / WAKING_MINUTES;
}

export function savings(input: {
  totalMinutes: number;
  cigsPerDay: number;
  packPrice: number;
  packSize: number;
}): number {
  if (input.packSize <= 0) return 0;
  const value = cigarettesNotSmoked(input.totalMinutes, input.cigsPerDay) * (input.packPrice / input.packSize);
  return Math.round(value * 100) / 100;
}

export function timeRegainedMinutes(totalMinutes: number, cigsPerDay: number): number {
  return Math.round(cigarettesNotSmoked(totalMinutes, cigsPerDay) * MINUTES_PER_CIGARETTE);
}

export type TimelineKind = 'success' | 'record' | 'interrupted' | 'empty';

/** S12 "Linia": one row per Dilato day in [fromDay, toDay]. */
export function timelineRows(
  challenges: readonly Challenge[],
  fromDay: string,
  toDay: string,
): { day: string; minutes: number; kind: TimelineKind }[] {
  const byDay = new Map<string, { minutes: number; kind: TimelineKind }>();
  let best = 0;
  const chronological = challenges.filter(isClosed).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  for (const c of chronological) {
    const minutes = c.resultMinutes;
    const isRecord = beatsRecord(minutes, best);
    best = Math.max(best, minutes);
    const kind: TimelineKind =
      c.status === 'interrupted' ? 'interrupted' : isRecord ? 'record' : 'success';
    byDay.set(c.day, { minutes, kind });
  }

  const rows: { day: string; minutes: number; kind: TimelineKind }[] = [];
  for (let d = fromDay; d <= toDay; d = addDays(d, 1)) {
    rows.push({ day: d, ...(byDay.get(d) ?? { minutes: 0, kind: 'empty' as const }) });
  }
  return rows;
}
