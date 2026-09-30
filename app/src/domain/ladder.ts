import { atLocalTime, minutesBetween } from './time';

export type LadderKey =
  | 'm15' | 'm30' | 'm45' | 'h1' | 'h1_5' | 'h2' | 'h3' | 'noon' | 'evening' | 'h24';

export type TargetKind = 'minutes' | 'until_noon' | 'until_evening';

export type LadderStep =
  | { key: LadderKey; targetKind: 'minutes'; minutes: number }
  | { key: LadderKey; targetKind: 'until_noon' | 'until_evening'; untilTime: string };

export const LADDER: readonly LadderStep[] = [
  { key: 'm15', targetKind: 'minutes', minutes: 15 },
  { key: 'm30', targetKind: 'minutes', minutes: 30 },
  { key: 'm45', targetKind: 'minutes', minutes: 45 },
  { key: 'h1', targetKind: 'minutes', minutes: 60 },
  { key: 'h1_5', targetKind: 'minutes', minutes: 90 },
  { key: 'h2', targetKind: 'minutes', minutes: 120 },
  { key: 'h3', targetKind: 'minutes', minutes: 180 },
  { key: 'noon', targetKind: 'until_noon', untilTime: '12:00' },
  { key: 'evening', targetKind: 'until_evening', untilTime: '20:00' },
  { key: 'h24', targetKind: 'minutes', minutes: 1440 },
];

export const UNTIL_CUTOFF_MINUTES = 15;
export const CUSTOM_MIN_MINUTES = 15;
export const CUSTOM_MAX_MINUTES = 1440;
export const CUSTOM_STEP_MINUTES = 5;

export function stepIndex(key: LadderKey): number {
  return LADDER.findIndex((s) => s.key === key);
}

export function getStep(key: LadderKey): LadderStep {
  return LADDER[stepIndex(key)];
}

export function stepAbove(key: LadderKey): LadderKey {
  return LADDER[Math.min(stepIndex(key) + 1, LADDER.length - 1)].key;
}

export function stepBelow(key: LadderKey): LadderKey {
  return LADDER[Math.max(stepIndex(key) - 1, 0)].key;
}

export function resolveTargetMinutes(step: LadderStep, startAt: Date): number {
  if (step.targetKind === 'minutes') return step.minutes;
  return minutesBetween(startAt, atLocalTime(startAt, step.untilTime));
}

export function isStepAvailable(step: LadderStep, now: Date): boolean {
  return step.targetKind === 'minutes' || resolveTargetMinutes(step, now) >= UNTIL_CUTOFF_MINUTES;
}

export function availableSteps(now: Date): LadderStep[] {
  return LADDER.filter((s) => isStepAvailable(s, now));
}

export function isValidCustomMinutes(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= CUSTOM_MIN_MINUTES &&
    minutes <= CUSTOM_MAX_MINUTES &&
    minutes % CUSTOM_STEP_MINUTES === 0
  );
}

/** Nearest fixed-minute step at or below `minutes` (noon/evening are never returned). */
export function stepForMinutes(minutes: number): LadderKey {
  let best: LadderKey = 'm15';
  for (const s of LADDER) {
    if (s.targetKind === 'minutes' && s.minutes <= minutes) best = s.key;
  }
  return best;
}
