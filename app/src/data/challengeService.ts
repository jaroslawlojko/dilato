import {
  DomainError,
  addOvertime,
  advance,
  canStartToday,
  confirmSmokedEarlier,
  confirmSucceeded,
  finishForToday,
  interrupt,
  isClosed,
  markCravingHelpUsed,
  markSeen,
  needsConfirmation,
  reconcile,
  startChallenge,
  type BadgeAward,
  type Challenge,
  type ChallengeChoice,
  type OvertimeBlock,
} from '../domain';
import type { Db } from './db';
import {
  activeCraving,
  awardBadge,
  getProfile,
  listChallenges,
  listEarned,
  saveChallenge,
  saveCraving,
  saveProfile,
} from './repositories';
import type { CravingSession, EarnedBadge, Profile, Technique } from './types';

/** Onboarding has not saved a profile yet. */
export class NoProfileError extends Error {
  constructor() {
    super('no_profile');
    this.name = 'NoProfileError';
  }
}

export interface Snapshot {
  profile: Profile;
  /** Every challenge as it stands now, oldest first. */
  challenges: readonly Challenge[];
  /** S03's challenge: the latest one while it is open or belongs to today. */
  current: Challenge | null;
  /** Show "Nadal trwa?" for this one before offering other actions. */
  pendingConfirmation: Challenge | null;
  earned: readonly EarnedBadge[];
  /** Awarded by the call that produced this snapshot (drives celebrations). */
  awarded: readonly BadgeAward[];
  bestSmokeFreeMinutes: number;
  activeCraving: CravingSession | null;
}

export interface ChallengeServiceDeps {
  db: Db;
  userId: string;
  /** UUID generator (`expo-crypto` `randomUUID` in the app). */
  newId: () => string;
}

interface Loaded {
  profile: Profile;
  challenges: Challenge[];
  earned: EarnedBadge[];
  craving: CravingSession | null;
}

/** What a user action changes before reconciliation. */
interface Step {
  challenge?: Challenge;
  craving?: CravingSession;
}

/** The latest stored challenge that is still open at `now`, or null. */
function openAt(s: Loaded, now: Date): Challenge | null {
  const stored = [...s.challenges].reverse().find((c) => !isClosed(c));
  const c = stored && advance(stored, now);
  return c && !isClosed(c) ? c : null;
}

function requireOpen(s: Loaded, now: Date): Challenge {
  const c = openAt(s, now);
  if (!c) throw new DomainError('invalid_transition');
  return c;
}

/** "Nadal trwa?" must be answered before anything else changes (spec §4.5). */
function requireNoPending(s: Loaded, now: Date): void {
  if (s.challenges.some((c) => needsConfirmation(c, now))) throw new DomainError('confirmation_pending');
}

function requirePending(s: Loaded, now: Date): Challenge {
  const c = [...s.challenges].reverse().find((ch) => needsConfirmation(ch, now));
  if (!c) throw new DomainError('invalid_transition');
  return c;
}

/**
 * The one entry point for challenge actions. Every method runs one serialised transaction:
 * load → domain step → `reconcile` → write changed challenges, awards and the best smoke-free value
 * (each with its outbox entry). A rejected step writes nothing.
 */
export function createChallengeService({ db, userId, newId }: ChallengeServiceDeps) {
  function commit(now: Date, step?: (s: Loaded) => Step): Promise<Snapshot> {
    return db.transaction(async (tx) => {
      const profile = await getProfile(tx, userId);
      if (!profile) throw new NoProfileError();
      const loaded: Loaded = {
        profile,
        challenges: await listChallenges(tx, userId),
        earned: await listEarned(tx, userId),
        craving: await activeCraving(tx, userId),
      };
      const { challenge, craving } = step?.(loaded) ?? {};
      const r = reconcile(
        {
          stored: loaded.challenges,
          proposed: challenge,
          earned: new Set(loaded.earned.map((b) => b.badgeId)),
          profile,
          bestSmokeFreeMinutes: profile.bestSmokeFreeMinutes,
        },
        now,
      );

      for (const c of r.changed) await saveChallenge(tx, userId, c, now);
      if (craving) await saveCraving(tx, userId, craving, now);
      const earned = new Map(loaded.earned.map((b) => [b.badgeId, b]));
      for (const award of r.awards) earned.set(award.badgeId, await awardBadge(tx, userId, award, now, newId));
      const nextProfile =
        r.bestSmokeFreeMinutes > profile.bestSmokeFreeMinutes
          ? { ...profile, bestSmokeFreeMinutes: r.bestSmokeFreeMinutes }
          : profile;
      if (nextProfile !== profile) await saveProfile(tx, userId, nextProfile, now);

      const active = craving ?? loaded.craving;
      return {
        profile: nextProfile,
        challenges: r.challenges,
        current: r.current,
        pendingConfirmation: r.pendingConfirmation,
        earned: [...earned.values()],
        awarded: r.awards,
        bestSmokeFreeMinutes: r.bestSmokeFreeMinutes,
        activeCraving: active && active.endedAt === null ? active : null,
      };
    });
  }

  return {
    /** App open / foreground: rollover, records, badges, best smoke-free. Never marks anything seen. */
    open: (now: Date) => commit(now),

    start: (input: { choice: ChallengeChoice; lastCigaretteAt: Date }, now: Date) =>
      commit(now, (s) => {
        requireNoPending(s, now);
        if (!canStartToday(s.challenges, now)) throw new DomainError('invalid_transition');
        return { challenge: startChallenge({ id: newId(), now, ...input }) };
      }),

    addOvertime: (block: OvertimeBlock, now: Date) =>
      commit(now, (s) => (requireNoPending(s, now), { challenge: addOvertime(requireOpen(s, now), block, now) })),

    /** "Na dziś wystarczy". */
    finishForToday: (now: Date) =>
      commit(now, (s) => (requireNoPending(s, now), { challenge: finishForToday(requireOpen(s, now), now) })),

    /** "Tym razem się nie udało". */
    interrupt: (now: Date) =>
      commit(now, (s) => (requireNoPending(s, now), { challenge: interrupt(requireOpen(s, now), now) })),

    /** "Tak, udało się". */
    confirmSucceeded: (now: Date) =>
      commit(now, (s) => ({ challenge: confirmSucceeded(requirePending(s, now), now) })),

    /** "Zapaliłem(-am) wcześniej". */
    confirmSmokedEarlier: (smokedAt: Date, now: Date) =>
      commit(now, (s) => ({ challenge: confirmSmokedEarlier(requirePending(s, now), smokedAt, now) })),

    /**
     * The timer screen has shown the open challenge without a break since `visibleSince`. A goal the
     * screen watched arrive counts as seen; one reached before the screen appeared waits for the
     * "Nadal trwa?" answer instead.
     */
    markSeen: (visibleSince: Date, now: Date) =>
      commit(now, (s) => {
        const open = openAt(s, now);
        if (!open) return {};
        if (needsConfirmation(open, now) && visibleSince.getTime() > open.targetAt.getTime()) return {};
        return { challenge: markSeen(open, now) };
      }),

    /** S06 "Mam głód": the challenge counts as helped (`wave_master`). */
    startCraving: (technique: Technique, now: Date) =>
      commit(now, (s) => {
        requireNoPending(s, now);
        const open = requireOpen(s, now);
        return {
          challenge: markCravingHelpUsed(open),
          craving: { id: newId(), challengeId: open.id, startedAt: now, endedAt: null, technique },
        };
      }),

    /** "Fala minęła". No-op without an active session. */
    endCraving: (now: Date) => commit(now, (s) => (s.craving ? { craving: { ...s.craving, endedAt: now } } : {})),
  };
}

export type ChallengeService = ReturnType<typeof createChallengeService>;
