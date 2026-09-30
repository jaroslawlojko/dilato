import { isClosed, liveResultMinutes, refresh, type Challenge } from './challenge';
import { PIGGY_BANK_THRESHOLD, morningStreak, type Currency } from './stats';
import { addDays } from './time';

export type ThresholdBadgeId =
  | 't_15m' | 't_30m' | 't_45m' | 't_1h' | 't_2h' | 't_3h' | 't_6h' | 't_12h'
  | 't_24h' | 't_48h' | 't_72h' | 't_7d' | 't_14d' | 't_30d' | 't_90d' | 't_365d';
export type AttitudeBadgeId =
  | 'five_mornings' | 'extra_time' | 'honesty' | 'new_record' | 'wave_master' | 'piggy_bank';
export type BadgeId = ThresholdBadgeId | AttitudeBadgeId;
export type SkyTier = 'dawn' | 'morning' | 'full_sun' | 'horizon';

export interface ThresholdBadge {
  id: ThresholdBadgeId;
  minutes: number;
  tier: SkyTier;
  availableInMvp: boolean;
}

const H = 60;
const D = 24 * H;

export const THRESHOLD_BADGES: readonly ThresholdBadge[] = [
  { id: 't_15m', minutes: 15, tier: 'dawn', availableInMvp: true },
  { id: 't_30m', minutes: 30, tier: 'dawn', availableInMvp: true },
  { id: 't_45m', minutes: 45, tier: 'dawn', availableInMvp: true },
  { id: 't_1h', minutes: H, tier: 'morning', availableInMvp: true },
  { id: 't_2h', minutes: 2 * H, tier: 'morning', availableInMvp: true },
  { id: 't_3h', minutes: 3 * H, tier: 'morning', availableInMvp: true },
  { id: 't_6h', minutes: 6 * H, tier: 'morning', availableInMvp: true },
  { id: 't_12h', minutes: 12 * H, tier: 'morning', availableInMvp: true },
  { id: 't_24h', minutes: D, tier: 'full_sun', availableInMvp: true },
  { id: 't_48h', minutes: 2 * D, tier: 'full_sun', availableInMvp: false },
  { id: 't_72h', minutes: 3 * D, tier: 'full_sun', availableInMvp: false },
  { id: 't_7d', minutes: 7 * D, tier: 'horizon', availableInMvp: false },
  { id: 't_14d', minutes: 14 * D, tier: 'horizon', availableInMvp: false },
  { id: 't_30d', minutes: 30 * D, tier: 'horizon', availableInMvp: false },
  { id: 't_90d', minutes: 90 * D, tier: 'horizon', availableInMvp: false },
  { id: 't_365d', minutes: 365 * D, tier: 'horizon', availableInMvp: false },
];

export const ATTITUDE_BADGES: readonly AttitudeBadgeId[] = [
  'five_mornings', 'extra_time', 'honesty', 'new_record', 'wave_master', 'piggy_bank',
];

export const TOTAL_BADGES = THRESHOLD_BADGES.length + ATTITUDE_BADGES.length;
export const FIVE_MORNINGS_DAYS = 5;
export const WAVE_MASTER_COUNT = 3;

/** Minutes that count toward threshold badges: nothing until the goal is reached or the challenge ends. */
export function countedMinutes(ch: Challenge, now: Date): number {
  const c = refresh(ch, now);
  return c.status === 'running' ? 0 : liveResultMinutes(c, now);
}

export function thresholdBadgesReached(minutes: number): ThresholdBadgeId[] {
  return THRESHOLD_BADGES.filter((b) => b.availableInMvp && b.minutes <= minutes).map((b) => b.id);
}

export interface BadgeContext {
  challenges: readonly Challenge[];
  earned: ReadonlySet<BadgeId>;
  totalSavings: number;
  currency: Currency;
  now: Date;
}

/** Badges whose conditions hold and that are not yet earned. Badges are never taken away. */
export function newBadges(ctx: BadgeContext): BadgeId[] {
  const { challenges, earned, now } = ctx;
  const found: BadgeId[] = [];

  const best = challenges.reduce((max, c) => Math.max(max, countedMinutes(c, now)), 0);
  found.push(...thresholdBadgesReached(best));

  if (morningStreak(challenges, now) >= FIVE_MORNINGS_DAYS) found.push('five_mornings');

  if (challenges.some((c) => refresh(c, now).overtimeBlocksCompleted > 0)) found.push('extra_time');

  const startedDays = new Set(challenges.map((c) => c.day));
  if (challenges.some((c) => c.status === 'interrupted' && startedDays.has(addDays(c.day, 1)))) {
    found.push('honesty');
  }

  const helpedSuccesses = challenges.filter((c) => c.status === 'completed' && c.usedCravingHelp).length;
  if (helpedSuccesses >= WAVE_MASTER_COUNT) found.push('wave_master');

  if (ctx.totalSavings >= PIGGY_BANK_THRESHOLD[ctx.currency]) found.push('piggy_bank');

  return found.filter((id) => !earned.has(id));
}

/** "Nowy rekord": beats every earlier closed result, and an earlier result exists. Repeatable. */
export function isNewRecord(closedChallenge: Challenge, challenges: readonly Challenge[]): boolean {
  if (!isClosed(closedChallenge) || closedChallenge.resultMinutes === null) return false;
  const previousBest = challenges
    .filter(
      (c) =>
        c.id !== closedChallenge.id &&
        isClosed(c) &&
        c.startedAt.getTime() < closedChallenge.startedAt.getTime(),
    )
    .reduce((max, c) => Math.max(max, c.resultMinutes ?? 0), 0);
  return previousBest > 0 && closedChallenge.resultMinutes > previousBest;
}

export type CelebrationTier = 'small' | 'medium' | 'large';

export function celebrationTier(awarded: readonly BadgeId[], reachedMinutes: number): CelebrationTier {
  const highestThreshold = THRESHOLD_BADGES.filter((b) => awarded.includes(b.id)).reduce(
    (max, b) => Math.max(max, b.minutes),
    0,
  );
  const basis = highestThreshold > 0 ? highestThreshold : reachedMinutes;
  if (basis >= D) return 'large';
  if (basis >= H) return 'medium';
  return 'small';
}
