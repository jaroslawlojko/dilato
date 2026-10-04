import { DatabaseSync } from 'node:sqlite';
import type { Driver, SqlValue } from '../db';

/** In-memory SQLite for Jest (Node 24 built-in). Rows are copied to plain objects. */
export function nodeDriver(): Driver {
  const db = new DatabaseSync(':memory:');
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params) => {
      db.prepare(sql).run(...params);
    },
    all: async <T>(sql: string, params: readonly SqlValue[]) =>
      db.prepare(sql).all(...params).map((row) => ({ ...row }) as T),
  };
}
