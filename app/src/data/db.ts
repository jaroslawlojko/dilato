export type SqlValue = string | number | null;

/** What a SQLite engine must provide. Two adapters: expo-sqlite (device) and node:sqlite (Jest). */
export interface Driver {
  exec(sql: string): Promise<void>;
  run(sql: string, params: readonly SqlValue[]): Promise<void>;
  all<T>(sql: string, params: readonly SqlValue[]): Promise<T[]>;
}

/** Queries; inside `Db.transaction`, use only the `tx` you are given. */
export interface Tx {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
}

/**
 * The app database. Every call is serialised on one connection, so a transaction never interleaves
 * with other work. Calling `db` (instead of `tx`) inside `transaction` deadlocks.
 */
export interface Db extends Tx {
  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

export function createDb(driver: Driver): Db {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task);
    queue = result.catch(() => undefined);
    return result;
  };

  const tx: Tx = {
    exec: (sql) => driver.exec(sql),
    run: (sql, params = []) => driver.run(sql, params),
    all: <T>(sql: string, params: readonly SqlValue[] = []) => driver.all<T>(sql, params),
    get: async <T>(sql: string, params: readonly SqlValue[] = []) => (await driver.all<T>(sql, params))[0] ?? null,
  };

  return {
    exec: (sql) => serial(() => tx.exec(sql)),
    run: (sql, params) => serial(() => tx.run(sql, params)),
    all: <T>(sql: string, params?: readonly SqlValue[]) => serial(() => tx.all<T>(sql, params)),
    get: <T>(sql: string, params?: readonly SqlValue[]) => serial(() => tx.get<T>(sql, params)),
    transaction: <T>(work: (tx: Tx) => Promise<T>) =>
      serial(async () => {
        await driver.exec('BEGIN');
        try {
          const result = await work(tx);
          await driver.exec('COMMIT');
          return result;
        } catch (e) {
          await driver.exec('ROLLBACK');
          throw e;
        }
      }),
  };
}
