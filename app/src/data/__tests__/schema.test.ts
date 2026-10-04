import { createDb } from '../db';
import { MIGRATIONS, migrate } from '../schema';
import { nodeDriver } from '../testing/nodeDriver';
import { openTestDb } from '../testing/openTestDb';

describe('migrate', () => {
  it('brings a fresh database to the latest version, once', async () => {
    const db = createDb(nodeDriver());
    expect(await migrate(db)).toBe(MIGRATIONS.length);
    expect(await migrate(db)).toBe(MIGRATIONS.length);
    expect(await db.get('PRAGMA user_version')).toEqual({ user_version: MIGRATIONS.length });
  });

  it('creates the synced tables and the outbox', async () => {
    const db = await openTestDb();
    const tables = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    expect(tables.map((t) => t.name)).toEqual(['badges_earned', 'challenges', 'craving_sessions', 'outbox', 'profiles']);
  });
});
