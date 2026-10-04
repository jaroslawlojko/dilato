import { isNewRecord, newBadges, type BadgeId } from './badges';
import { advance, isClosed, needsConfirmation, type Challenge } from './challenge';
import { bestSmokeFreeMinutes } from './smokeFree';
import { savings, totalResultMinutes, type Currency } from './stats';
import { dilatoDay } from './time';

export interface SavingsProfile {
  cigsPerDay: number;
  packPrice: number;
  packSize: number;
  currency: Currency;
}

export interface ReconcileInput {
  /** Challenges as persisted, any order. */
  stored: readonly Challenge[];
  /** The result of a user action (or a new start); replaces the stored challenge with the same id. */
  proposed?: Challenge;
  earned: ReadonlySet<BadgeId>;
  profile: SavingsProfile;
  /** Highest smoke-free value persisted so far (spec §4.8). */
  bestSmokeFreeMinutes: number;
}

export interface BadgeAward {
  badgeId: BadgeId;
  /** The closing challenge for `new_record`, otherwise the latest challenge. */
  challengeId: string | null;
}

export interface Reconciled {
  /** Every challenge as it stands at `now`, oldest first. */
  challenges: Challenge[];
  /** Challenges that differ from `stored` (by identity) and must be persisted. */
  changed: Challenge[];
  awards: BadgeAward[];
  /** Never lower than the input value. */
  bestSmokeFreeMinutes: number;
  /** The latest challenge waiting for a "Nadal trwa?" answer. */
  pendingConfirmation: Challenge | null;
  /** The challenge S03 is about: the latest one while it is open or belongs to today. */
  current: Challenge | null;
}

/**
 * Everything that must follow a read or a user action, in one pure step: bring every challenge
 * to `now`, award `new_record` once per challenge that closes here (open → closed; a correction of an
 * already-closed challenge is not a close), award the other badges not yet earned, and keep the
 * best smoke-free value at its peak.
 */
export function reconcile(input: ReconcileInput, now: Date): Reconciled {
  const storedById = new Map(input.stored.map((c) => [c.id, c]));
  const merged = new Map(storedById);
  if (input.proposed) merged.set(input.proposed.id, input.proposed);

  const challenges = [...merged.values()]
    .map((c) => advance(c, now))
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const changed = challenges.filter((c) => c !== storedById.get(c.id));
  const closedHere = changed.filter((c) => {
    const before = storedById.get(c.id);
    return isClosed(c) && !(before && isClosed(before));
  });
  const latest = challenges[challenges.length - 1] ?? null;

  const { cigsPerDay, packPrice, packSize, currency } = input.profile;
  const totalSavings = savings({ totalMinutes: totalResultMinutes(challenges), cigsPerDay, packPrice, packSize });
  const awards: BadgeAward[] = [
    ...closedHere
      .filter((c) => isNewRecord(c, challenges))
      .map((c) => ({ badgeId: 'new_record' as const, challengeId: c.id })),
    ...newBadges({ challenges, earned: input.earned, totalSavings, currency, now }).map((badgeId) => ({
      badgeId,
      challengeId: latest?.id ?? null,
    })),
  ];

  return {
    challenges,
    changed,
    awards,
    bestSmokeFreeMinutes: Math.max(input.bestSmokeFreeMinutes, bestSmokeFreeMinutes(challenges, now)),
    pendingConfirmation: [...challenges].reverse().find((c) => needsConfirmation(c, now)) ?? null,
    current: latest && (!isClosed(latest) || latest.day === dilatoDay(now)) ? latest : null,
  };
}
