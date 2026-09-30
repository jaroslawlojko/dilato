export const MINUTE_MS = 60_000;
export const DAY_ROLLOVER_HOUR = 4;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar date as YYYY-MM-DD. */
export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local date-time on calendar `day` (YYYY-MM-DD) at hours:minutes. */
export function localDateTime(day: string, hours: number, minutes: number): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hours, minutes, 0, 0);
}

/** The Dilato day an instant belongs to: days run 04:00–03:59 local time. */
export function dilatoDay(at: Date): string {
  const d = new Date(at.getTime());
  if (d.getHours() < DAY_ROLLOVER_HOUR) d.setDate(d.getDate() - 1);
  return localDateString(d);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  // Noon avoids DST edges when the calendar shifts.
  return localDateString(new Date(y, m - 1, d + n, 12, 0, 0, 0));
}

/** Whole minutes from `from` to `to`, floored (real elapsed time). */
export function minutesBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MINUTE_MS);
}

export function addMinutes(at: Date, minutes: number): Date {
  return new Date(at.getTime() + minutes * MINUTE_MS);
}

/** Same local calendar date as `base`, at wall-clock `hhmm` (HH:mm). */
export function atLocalTime(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base.getTime());
  d.setHours(h, m, 0, 0);
  return d;
}
