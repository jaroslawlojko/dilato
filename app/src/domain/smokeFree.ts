import { advance, isClosed, type Challenge } from './challenge';
import { DAY_ROLLOVER_HOUR, addDays, dilatoDay, localDateTime, minutesBetween } from './time';

/** "Czas bez dymu": from the last cigarette to the first one (challenge end), or to now. */
export function smokeFreeMinutes(ch: Challenge, now: Date): number {
  return Math.max(0, minutesBetween(ch.lastCigaretteAt, ch.firstCigaretteAt ?? now));
}

/** S10 "Najdłużej bez dymu": maximum over closed challenges. */
export function longestSmokeFreeMinutes(challenges: readonly Challenge[]): number {
  return challenges
    .filter(isClosed)
    .reduce((max, c) => Math.max(max, minutesBetween(c.lastCigaretteAt, c.firstCigaretteAt)), 0);
}

/** Body-benefit basis (spec §4.8): max(longest closed, live value of open challenges). */
export function bestSmokeFreeMinutes(challenges: readonly Challenge[], now: Date): number {
  const live = challenges
    .filter((c) => !isClosed(c))
    .reduce((max, c) => Math.max(max, smokeFreeMinutes(advance(c, now), now)), 0);
  return Math.max(longestSmokeFreeMinutes(challenges), live);
}

/**
 * Default answer to "Ostatni papieros wczoraj o…": the previous answer's wall-clock time
 * (or 22:00) during the previous Dilato day.
 */
export function defaultLastCigaretteAt(now: Date, previous: Date | null): Date {
  const hours = previous ? previous.getHours() : 22;
  const minutes = previous ? previous.getMinutes() : 0;
  const today = dilatoDay(now);
  // Yesterday's Dilato day spans yesterday 04:00 → today 03:59 (calendar dates).
  const calendarDay = hours < DAY_ROLLOVER_HOUR ? today : addDays(today, -1);
  // Always in the past: yesterday's Dilato day ends before today's 04:00, and now is after it.
  return localDateTime(calendarDay, hours, minutes);
}
