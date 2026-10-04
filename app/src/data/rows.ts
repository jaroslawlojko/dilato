import {
  ATTITUDE_BADGES,
  LADDER,
  OVERTIME_BLOCKS,
  PIGGY_BANK_THRESHOLD,
  STARTING_LADDERS,
  THRESHOLD_BADGES,
  type BadgeId,
  type Challenge,
  type ChallengeStatus,
  type Currency,
  type HabitProfile,
  type LadderKey,
  type TargetKind,
} from '../domain';
import type { SqlValue } from './db';
import type { CravingSession, EarnedBadge, Profile, Technique } from './types';

export type Row = Record<string, SqlValue>;

/** A stored (or about-to-be-stored) value breaks the data model. Names the first bad column. */
export class InvalidRowError extends Error {
  readonly table: string;
  readonly column: string;

  constructor(table: string, column: string, value: unknown) {
    super(`${table}.${column}: ${JSON.stringify(value)}`);
    this.name = 'InvalidRowError';
    this.table = table;
    this.column = column;
  }
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const LADDER_KEYS: readonly (LadderKey | 'custom')[] = [...LADDER.map((s) => s.key), 'custom'];
const TARGET_KINDS: readonly TargetKind[] = ['minutes', 'until_noon', 'until_evening'];
const STATUSES: readonly ChallengeStatus[] = ['running', 'achieved', 'overtime', 'completed', 'interrupted'];
const HABIT_PROFILES = Object.keys(STARTING_LADDERS) as HabitProfile[];
const CURRENCIES = Object.keys(PIGGY_BANK_THRESHOLD) as Currency[];
const BADGE_IDS: readonly BadgeId[] = [...THRESHOLD_BADGES.map((b) => b.id), ...ATTITUDE_BADGES];
const TECHNIQUES: readonly Technique[] = ['breathing', 'water', 'walk', 'hands', 'message'];

/** Fields each status guarantees; `isClosed` and the transitions rely on them. */
const REQUIRED_BY_STATUS: Record<ChallengeStatus, readonly (keyof Challenge)[]> = {
  running: [],
  achieved: ['achievedAt'],
  overtime: ['achievedAt', 'overtimeBlockStartedAt', 'overtimeBlockMinutes'],
  completed: ['endedAt', 'resultMinutes', 'firstCigaretteAt'],
  interrupted: ['endedAt', 'resultMinutes', 'firstCigaretteAt'],
};

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);
const snake = (key: string): string => key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

/** Reads one column at a time; throws `InvalidRowError` for the first bad one. */
class RowReader {
  private readonly table: string;
  private readonly row: Record<string, unknown>;

  constructor(table: string, row: Record<string, unknown>) {
    this.table = table;
    this.row = row;
  }

  private fail(column: string): never {
    throw new InvalidRowError(this.table, column, this.row[column]);
  }

  text(c: string): string {
    const v = this.row[c];
    return typeof v === 'string' ? v : this.fail(c);
  }

  match(c: string, pattern: RegExp): string {
    const v = this.text(c);
    return pattern.test(v) ? v : this.fail(c);
  }

  oneOf<T extends string | number>(c: string, allowed: readonly T[]): T {
    const v = this.row[c] as T;
    return allowed.includes(v) ? v : this.fail(c);
  }

  int(c: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
    const v = this.row[c];
    return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : this.fail(c);
  }

  num(c: string, min = 0): number {
    const v = this.row[c];
    return typeof v === 'number' && Number.isFinite(v) && v >= min ? v : this.fail(c);
  }

  bool(c: string): boolean {
    return this.oneOf(c, [0, 1]) === 1;
  }

  date(c: string): Date {
    const d = new Date(this.match(c, ISO_UTC));
    return Number.isNaN(d.getTime()) ? this.fail(c) : d;
  }

  nullable<T>(c: string, read: (column: string) => T): T | null {
    const v = this.row[c];
    return v === null || v === undefined ? null : read(c);
  }
}

export function challengeFromRow(raw: Record<string, unknown>): Challenge {
  const r = new RowReader('challenges', raw);
  const date = (c: string) => r.date(c);
  const dateOrNull = (c: string) => r.nullable(c, date);
  const ch: Challenge = {
    id: r.text('id'),
    day: r.match('day', DAY),
    ladderKey: r.oneOf('ladder_key', LADDER_KEYS),
    targetKind: r.oneOf('target_kind', TARGET_KINDS),
    targetMinutes: r.int('target_minutes', 15, 1440),
    lastCigaretteAt: date('last_cigarette_at'),
    startedAt: date('started_at'),
    targetAt: date('target_at'),
    status: r.oneOf('status', STATUSES),
    achievedAt: dateOrNull('achieved_at'),
    overtimeBlockStartedAt: dateOrNull('overtime_block_started_at'),
    overtimeBlockMinutes: r.nullable('overtime_block_minutes', (c) => r.oneOf(c, OVERTIME_BLOCKS)),
    overtimeMinutes: r.int('overtime_minutes'),
    overtimeBlocksCompleted: r.int('overtime_blocks_completed'),
    endedAt: dateOrNull('ended_at'),
    resultMinutes: r.nullable('result_minutes', (c) => r.int(c)),
    firstCigaretteAt: dateOrNull('first_cigarette_at'),
    usedCravingHelp: r.bool('used_craving_help'),
    lastSeenAt: date('last_seen_at'),
    confirmedAt: dateOrNull('confirmed_at'),
  };
  for (const key of REQUIRED_BY_STATUS[ch.status]) {
    if (ch[key] === null) throw new InvalidRowError('challenges', snake(key), null);
  }
  return ch;
}

export function challengeToRow(ch: Challenge, userId: string): Row {
  return {
    id: ch.id,
    user_id: userId,
    day: ch.day,
    ladder_key: ch.ladderKey,
    last_cigarette_at: iso(ch.lastCigaretteAt),
    started_at: iso(ch.startedAt),
    target_kind: ch.targetKind,
    target_minutes: ch.targetMinutes,
    target_at: iso(ch.targetAt),
    status: ch.status,
    achieved_at: isoOrNull(ch.achievedAt),
    overtime_block_started_at: isoOrNull(ch.overtimeBlockStartedAt),
    overtime_block_minutes: ch.overtimeBlockMinutes,
    overtime_minutes: ch.overtimeMinutes,
    overtime_blocks_completed: ch.overtimeBlocksCompleted,
    ended_at: isoOrNull(ch.endedAt),
    result_minutes: ch.resultMinutes,
    first_cigarette_at: isoOrNull(ch.firstCigaretteAt),
    used_craving_help: ch.usedCravingHelp ? 1 : 0,
    last_seen_at: iso(ch.lastSeenAt),
    confirmed_at: isoOrNull(ch.confirmedAt),
  };
}

export function profileFromRow(raw: Record<string, unknown>): Profile {
  const r = new RowReader('profiles', raw);
  return {
    locale: r.oneOf('locale', ['pl', 'en'] as const),
    habitProfile: r.oneOf('habit_profile', HABIT_PROFILES),
    cigsPerDay: r.int('cigs_per_day', 1, 80),
    packPrice: r.num('pack_price'),
    packSize: r.int('pack_size', 1),
    currency: r.oneOf('currency', CURRENCIES),
    momentLabel: r.text('moment_label'),
    usualTime: r.match('usual_time', HHMM),
    reminderMode: r.oneOf('reminder_mode', ['time', 'none'] as const),
    reminderTime: r.match('reminder_time', HHMM),
    reminderDays: r.int('reminder_days', 0, 127),
    grammarForm: r.oneOf('grammar_form', ['neutral', 'f', 'm'] as const),
    theme: r.oneOf('theme', ['system', 'light', 'dark'] as const),
    healthConsentAt: r.nullable('health_consent_at', (c) => r.date(c)),
    termsAcceptedAt: r.nullable('terms_accepted_at', (c) => r.date(c)),
    bestSmokeFreeMinutes: r.int('best_smoke_free_minutes'),
  };
}

export function profileToRow(p: Profile, userId: string): Row {
  return {
    user_id: userId,
    locale: p.locale,
    habit_profile: p.habitProfile,
    cigs_per_day: p.cigsPerDay,
    pack_price: p.packPrice,
    pack_size: p.packSize,
    currency: p.currency,
    moment_label: p.momentLabel,
    usual_time: p.usualTime,
    reminder_mode: p.reminderMode,
    reminder_time: p.reminderTime,
    reminder_days: p.reminderDays,
    grammar_form: p.grammarForm,
    theme: p.theme,
    health_consent_at: isoOrNull(p.healthConsentAt),
    terms_accepted_at: isoOrNull(p.termsAcceptedAt),
    best_smoke_free_minutes: p.bestSmokeFreeMinutes,
  };
}

export function earnedBadgeFromRow(raw: Record<string, unknown>): EarnedBadge {
  const r = new RowReader('badges_earned', raw);
  return {
    id: r.text('id'),
    badgeId: r.oneOf('badge_id', BADGE_IDS),
    firstEarnedAt: r.date('first_earned_at'),
    lastEarnedAt: r.date('last_earned_at'),
    times: r.int('times', 1),
    challengeId: r.nullable('challenge_id', (c) => r.text(c)),
  };
}

export function earnedBadgeToRow(b: EarnedBadge, userId: string): Row {
  return {
    id: b.id,
    user_id: userId,
    badge_id: b.badgeId,
    first_earned_at: iso(b.firstEarnedAt),
    last_earned_at: iso(b.lastEarnedAt),
    times: b.times,
    challenge_id: b.challengeId,
  };
}

export function cravingFromRow(raw: Record<string, unknown>): CravingSession {
  const r = new RowReader('craving_sessions', raw);
  return {
    id: r.text('id'),
    challengeId: r.text('challenge_id'),
    startedAt: r.date('started_at'),
    endedAt: r.nullable('ended_at', (c) => r.date(c)),
    technique: r.oneOf('technique', TECHNIQUES),
  };
}

export function cravingToRow(s: CravingSession, userId: string): Row {
  return {
    id: s.id,
    user_id: userId,
    challenge_id: s.challengeId,
    started_at: iso(s.startedAt),
    ended_at: isoOrNull(s.endedAt),
    technique: s.technique,
  };
}
