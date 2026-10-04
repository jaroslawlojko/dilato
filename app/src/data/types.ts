import type { BadgeId, Currency, HabitProfile } from '../domain';

/** Spec §3.1, plus `bestSmokeFreeMinutes` (spec §4.8, #44). */
export interface Profile {
  readonly locale: 'pl' | 'en';
  readonly habitProfile: HabitProfile;
  readonly cigsPerDay: number;
  readonly packPrice: number;
  readonly packSize: number;
  readonly currency: Currency;
  readonly momentLabel: string;
  /** Local `HH:mm`. */
  readonly usualTime: string;
  readonly reminderMode: 'time' | 'none';
  /** Local `HH:mm`. */
  readonly reminderTime: string;
  /** Bit 0 = Monday … bit 6 = Sunday. */
  readonly reminderDays: number;
  readonly grammarForm: 'neutral' | 'f' | 'm';
  readonly theme: 'system' | 'light' | 'dark';
  /** Set at registration (plan 4); null in the offline app. */
  readonly healthConsentAt: Date | null;
  readonly termsAcceptedAt: Date | null;
  /** Highest smoke-free value ever reached; never lowered. */
  readonly bestSmokeFreeMinutes: number;
}

export interface EarnedBadge {
  readonly id: string;
  readonly badgeId: BadgeId;
  readonly firstEarnedAt: Date;
  readonly lastEarnedAt: Date;
  /** ≥ 1; only `new_record` goes above 1. */
  readonly times: number;
  /** The challenge of the first earning. */
  readonly challengeId: string | null;
}

export type Technique = 'breathing' | 'water' | 'walk' | 'hands' | 'message';

export interface CravingSession {
  readonly id: string;
  readonly challengeId: string;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly technique: Technique;
}
