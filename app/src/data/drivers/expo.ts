import * as SQLite from 'expo-sqlite';
import { createDb, type Db, type SqlValue } from '../db';
import { migrate } from '../schema';

/**
 * Opens and migrates the app database on the device. Not run by Jest (native module); it is
 * exercised by the plan 3 development build.
 */
export async function openAppDb(name = 'dilato.db'): Promise<Db> {
  const native = await SQLite.openDatabaseAsync(name);
  await native.execAsync('PRAGMA journal_mode = WAL;');
  const db = createDb({
    exec: (sql) => native.execAsync(sql),
    run: async (sql, params) => {
      await native.runAsync(sql, [...params]);
    },
    all: <T>(sql: string, params: readonly SqlValue[]) => native.getAllAsync<T>(sql, [...params]),
  });
  await migrate(db);
  return db;
}
