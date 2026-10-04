import { createDb } from '../db';
import { nodeDriver } from '../testing/nodeDriver';

async function freshDb() {
  const db = createDb(nodeDriver());
  await db.exec('CREATE TABLE t (v INTEGER NOT NULL)');
  return db;
}

describe('createDb', () => {
  it('runs statements and reads rows', async () => {
    const db = await freshDb();
    await db.run('INSERT INTO t (v) VALUES (?)', [1]);
    expect(await db.all<{ v: number }>('SELECT v FROM t')).toEqual([{ v: 1 }]);
    expect(await db.get<{ v: number }>('SELECT v FROM t WHERE v = ?', [1])).toEqual({ v: 1 });
    expect(await db.get('SELECT v FROM t WHERE v = ?', [2])).toBeNull();
  });

  it('commits a transaction and returns its result', async () => {
    const db = await freshDb();
    const result = await db.transaction(async (tx) => {
      await tx.run('INSERT INTO t (v) VALUES (?)', [1]);
      return 'done';
    });
    expect(result).toBe('done');
    expect(await db.all('SELECT v FROM t')).toEqual([{ v: 1 }]);
  });

  it('rolls back a failed transaction and keeps working', async () => {
    const db = await freshDb();
    await expect(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO t (v) VALUES (?)', [1]);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.all('SELECT v FROM t')).toEqual([]);
    await db.run('INSERT INTO t (v) VALUES (?)', [2]);
    expect(await db.all('SELECT v FROM t')).toEqual([{ v: 2 }]);
  });

  it('never lets other work interleave with an open transaction', async () => {
    const db = await freshDb();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const tx = db.transaction(async (t) => {
      await t.run('INSERT INTO t (v) VALUES (1)');
      await gate;
      await t.run('INSERT INTO t (v) VALUES (2)');
    });
    const read = db.all<{ v: number }>('SELECT v FROM t ORDER BY v');
    release();
    await tx;
    expect(await read).toEqual([{ v: 1 }, { v: 2 }]);
  });
});
