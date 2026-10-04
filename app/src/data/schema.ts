import type { Db } from './db';

/**
 * Append-only: never edit a shipped migration, add a new one. Migration i brings the database to
 * `PRAGMA user_version = i + 1`. Columns mirror spec §3 (Postgres has the same names).
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE profiles (
    user_id TEXT PRIMARY KEY NOT NULL,
    locale TEXT NOT NULL,
    habit_profile TEXT NOT NULL,
    cigs_per_day INTEGER NOT NULL,
    pack_price REAL NOT NULL,
    pack_size INTEGER NOT NULL,
    currency TEXT NOT NULL,
    moment_label TEXT NOT NULL,
    usual_time TEXT NOT NULL,
    reminder_mode TEXT NOT NULL,
    reminder_time TEXT NOT NULL,
    reminder_days INTEGER NOT NULL,
    grammar_form TEXT NOT NULL,
    theme TEXT NOT NULL,
    health_consent_at TEXT,
    terms_accepted_at TEXT,
    best_smoke_free_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE challenges (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    ladder_key TEXT NOT NULL,
    last_cigarette_at TEXT NOT NULL,
    started_at TEXT NOT NULL,
    target_kind TEXT NOT NULL,
    target_minutes INTEGER NOT NULL,
    target_at TEXT NOT NULL,
    status TEXT NOT NULL,
    achieved_at TEXT,
    overtime_block_started_at TEXT,
    overtime_block_minutes INTEGER,
    overtime_minutes INTEGER NOT NULL,
    overtime_blocks_completed INTEGER NOT NULL,
    ended_at TEXT,
    result_minutes INTEGER,
    first_cigarette_at TEXT,
    used_craving_help INTEGER NOT NULL,
    last_seen_at TEXT NOT NULL,
    confirmed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE UNIQUE INDEX challenges_one_per_day ON challenges (user_id, day) WHERE deleted_at IS NULL;

  CREATE TABLE craving_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    challenge_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    technique TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );

  CREATE TABLE badges_earned (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    first_earned_at TEXT NOT NULL,
    last_earned_at TEXT NOT NULL,
    times INTEGER NOT NULL,
    challenge_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE UNIQUE INDEX badges_earned_once ON badges_earned (user_id, badge_id);

  CREATE TABLE outbox (
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    op TEXT NOT NULL,
    payload TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (table_name, row_id)
  );
  `,
];

export async function migrate(db: Db): Promise<number> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  for (let version = (row?.user_version ?? 0) + 1; version <= MIGRATIONS.length; version++) {
    await db.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[version - 1]);
      await tx.exec(`PRAGMA user_version = ${version}`);
    });
  }
  return Math.max(row?.user_version ?? 0, MIGRATIONS.length);
}
