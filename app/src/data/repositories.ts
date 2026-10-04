import type { BadgeAward, Challenge } from '../domain';
import type { Tx } from './db';
import {
  challengeFromRow,
  challengeToRow,
  cravingFromRow,
  cravingToRow,
  earnedBadgeFromRow,
  earnedBadgeToRow,
  profileFromRow,
  profileToRow,
} from './rows';
import type { CravingSession, EarnedBadge, Profile } from './types';
import { writeRow } from './write';

type Raw = Record<string, unknown>;

export async function getProfile(tx: Tx, userId: string): Promise<Profile | null> {
  const row = await tx.get<Raw>('SELECT * FROM profiles WHERE user_id = ? AND deleted_at IS NULL', [userId]);
  return row ? profileFromRow(row) : null;
}

/**
 * Validates with the same rules as a read (throws `InvalidRowError` before writing) and never
 * lowers the stored best smoke-free value (spec §4.8), whatever the caller passes.
 */
export async function saveProfile(tx: Tx, userId: string, profile: Profile, now: Date): Promise<void> {
  const existing = await getProfile(tx, userId);
  const best = Math.max(profile.bestSmokeFreeMinutes, existing?.bestSmokeFreeMinutes ?? 0);
  const row = profileToRow({ ...profile, bestSmokeFreeMinutes: best }, userId);
  profileFromRow(row);
  await writeRow(tx, 'profiles', row, now);
}

export async function listChallenges(tx: Tx, userId: string): Promise<Challenge[]> {
  const rows = await tx.all<Raw>(
    'SELECT * FROM challenges WHERE user_id = ? AND deleted_at IS NULL ORDER BY started_at',
    [userId],
  );
  return rows.map(challengeFromRow);
}

/** Every save validates like a read, so a bad record fails its own write, never every later read. */
export async function saveChallenge(tx: Tx, userId: string, ch: Challenge, now: Date): Promise<void> {
  const row = challengeToRow(ch, userId);
  challengeFromRow(row);
  await writeRow(tx, 'challenges', row, now);
}

export async function listEarned(tx: Tx, userId: string): Promise<EarnedBadge[]> {
  const rows = await tx.all<Raw>(
    'SELECT * FROM badges_earned WHERE user_id = ? AND deleted_at IS NULL ORDER BY first_earned_at',
    [userId],
  );
  return rows.map(earnedBadgeFromRow);
}

/** First earning inserts; a repeat (only `new_record` is repeatable) counts `times`. Never deletes. */
export async function awardBadge(
  tx: Tx,
  userId: string,
  award: BadgeAward,
  now: Date,
  newId: () => string,
): Promise<EarnedBadge> {
  const existing = await tx.get<Raw>('SELECT * FROM badges_earned WHERE user_id = ? AND badge_id = ?', [
    userId,
    award.badgeId,
  ]);
  let badge: EarnedBadge;
  if (existing) {
    const earned = earnedBadgeFromRow(existing);
    badge = { ...earned, lastEarnedAt: now, times: earned.times + 1 };
  } else {
    badge = { id: newId(), badgeId: award.badgeId, firstEarnedAt: now, lastEarnedAt: now, times: 1, challengeId: award.challengeId };
  }
  const row = earnedBadgeToRow(badge, userId);
  earnedBadgeFromRow(row);
  await writeRow(tx, 'badges_earned', row, now);
  return badge;
}

export async function activeCraving(tx: Tx, userId: string): Promise<CravingSession | null> {
  const row = await tx.get<Raw>(
    `SELECT * FROM craving_sessions WHERE user_id = ? AND ended_at IS NULL AND deleted_at IS NULL
     ORDER BY started_at DESC LIMIT 1`,
    [userId],
  );
  return row ? cravingFromRow(row) : null;
}

export async function saveCraving(tx: Tx, userId: string, session: CravingSession, now: Date): Promise<void> {
  const row = cravingToRow(session, userId);
  cravingFromRow(row);
  await writeRow(tx, 'craving_sessions', row, now);
}
