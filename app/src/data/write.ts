import type { Tx } from './db';
import type { Row } from './rows';

export type SyncedTable = 'profiles' | 'challenges' | 'craving_sessions' | 'badges_earned';

const KEY: Record<SyncedTable, string> = {
  profiles: 'user_id',
  challenges: 'id',
  craving_sessions: 'id',
  badges_earned: 'id',
};

/**
 * The only way the app writes a synced row (spec §8): upsert it — keeping `created_at`, stamping
 * `updated_at` for last-write-wins — and queue the stored row in the outbox, inside the caller's
 * transaction. A pending entry for the same row is replaced, because sync sends whole rows.
 */
export async function writeRow(tx: Tx, table: SyncedTable, row: Row, now: Date): Promise<void> {
  const stamp = now.toISOString();
  const key = KEY[table];
  const full: Row = { ...row, created_at: stamp, updated_at: stamp, deleted_at: null };
  const columns = Object.keys(full);
  const updates = columns.filter((c) => c !== key && c !== 'created_at').map((c) => `${c} = excluded.${c}`);
  await tx.run(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
     ON CONFLICT (${key}) DO UPDATE SET ${updates.join(', ')}`,
    columns.map((c) => full[c]),
  );
  const stored = await tx.get<Row>(`SELECT * FROM ${table} WHERE ${key} = ?`, [full[key]]);
  await tx.run(
    `INSERT INTO outbox (table_name, row_id, op, payload, attempts, next_attempt_at, created_at)
     VALUES (?, ?, 'upsert', ?, 0, ?, ?)
     ON CONFLICT (table_name, row_id) DO UPDATE SET
       payload = excluded.payload, attempts = 0, next_attempt_at = excluded.next_attempt_at`,
    [table, String(full[key]), JSON.stringify(stored), stamp, stamp],
  );
}

export interface OutboxEntry {
  tableName: SyncedTable;
  rowId: string;
  op: 'upsert';
  /** The row exactly as stored in SQLite (booleans as 0/1; plan 4 maps it to Postgres). */
  payload: Row;
  attempts: number;
  nextAttemptAt: string;
}

/** Pending entries, oldest first. */
export async function listOutbox(tx: Tx): Promise<OutboxEntry[]> {
  const rows = await tx.all<{
    table_name: SyncedTable;
    row_id: string;
    op: 'upsert';
    payload: string;
    attempts: number;
    next_attempt_at: string;
  }>('SELECT * FROM outbox ORDER BY created_at, rowid');
  return rows.map((r) => ({
    tableName: r.table_name,
    rowId: r.row_id,
    op: r.op,
    payload: JSON.parse(r.payload) as Row,
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
  }));
}
