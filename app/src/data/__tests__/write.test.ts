import { openTestDb } from '../testing/openTestDb';
import { USER } from '../testing/fixtures';
import { listOutbox, writeRow } from '../write';
import type { Row } from '../rows';

const T1 = new Date('2026-09-29T05:30:00.000Z');
const T2 = new Date('2026-09-29T05:35:00.000Z');
const craving = (endedAt: string | null): Row => ({
  id: 'k1',
  user_id: USER,
  challenge_id: 'c1',
  started_at: T1.toISOString(),
  ended_at: endedAt,
  technique: 'breathing',
});

describe('writeRow', () => {
  it('stores the row with its timestamps and queues it in the outbox', async () => {
    const db = await openTestDb();
    await db.transaction((tx) => writeRow(tx, 'craving_sessions', craving(null), T1));

    const row = await db.get<Row>('SELECT * FROM craving_sessions WHERE id = ?', ['k1']);
    expect(row).toMatchObject({ created_at: T1.toISOString(), updated_at: T1.toISOString(), deleted_at: null });
    expect(await listOutbox(db)).toEqual([
      { tableName: 'craving_sessions', rowId: 'k1', op: 'upsert', payload: row, attempts: 0, nextAttemptAt: T1.toISOString() },
    ]);
  });

  it('keeps created_at on update and coalesces the pending entry', async () => {
    const db = await openTestDb();
    await db.transaction((tx) => writeRow(tx, 'craving_sessions', craving(null), T1));
    await db.run('UPDATE outbox SET attempts = 3');
    await db.transaction((tx) => writeRow(tx, 'craving_sessions', craving(T2.toISOString()), T2));

    const row = await db.get<Row>('SELECT * FROM craving_sessions WHERE id = ?', ['k1']);
    expect(row).toMatchObject({ created_at: T1.toISOString(), updated_at: T2.toISOString(), ended_at: T2.toISOString() });
    const outbox = await listOutbox(db);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ payload: row, attempts: 0, nextAttemptAt: T2.toISOString() });
  });

  it('rolls back the row and its outbox entry together', async () => {
    const db = await openTestDb();
    await expect(
      db.transaction(async (tx) => {
        await writeRow(tx, 'craving_sessions', craving(null), T1);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.all('SELECT * FROM craving_sessions')).toEqual([]);
    expect(await listOutbox(db)).toEqual([]);
  });
});
