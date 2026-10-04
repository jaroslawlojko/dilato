import { interrupt, startChallenge } from '../../domain';
import {
  activeCraving,
  awardBadge,
  getProfile,
  listChallenges,
  listEarned,
  saveChallenge,
  saveCraving,
  saveProfile,
} from '../repositories';
import { USER, sequentialIds, testProfile } from '../testing/fixtures';
import { openTestDb } from '../testing/openTestDb';
import { listOutbox } from '../write';

const at = (iso: string) => new Date(iso);
const challenge = (id: string, startIso: string) =>
  startChallenge({ id, now: at(startIso), lastCigaretteAt: at('2026-09-28T22:10:00'), choice: { ladderKey: 'h1' } });

describe('profiles', () => {
  it('saves and reads a profile', async () => {
    const db = await openTestDb();
    expect(await getProfile(db, USER)).toBeNull();
    await db.transaction((tx) => saveProfile(tx, USER, testProfile, at('2026-09-29T07:00:00')));
    expect(await getProfile(db, USER)).toEqual(testProfile);
    expect((await listOutbox(db)).map((e) => e.tableName)).toEqual(['profiles']);
  });

  it('rejects an invalid profile and writes nothing', async () => {
    const db = await openTestDb();
    await expect(
      db.transaction((tx) => saveProfile(tx, USER, { ...testProfile, cigsPerDay: 0 }, at('2026-09-29T07:00:00'))),
    ).rejects.toThrow('profiles.cigs_per_day:');
    expect(await getProfile(db, USER)).toBeNull();
    expect(await listOutbox(db)).toEqual([]);
  });

  it('never lowers the best smoke-free value', async () => {
    const db = await openTestDb();
    const now = at('2026-09-29T07:00:00');
    await db.transaction((tx) => saveProfile(tx, USER, { ...testProfile, bestSmokeFreeMinutes: 1490 }, now));
    await db.transaction((tx) => saveProfile(tx, USER, { ...testProfile, cigsPerDay: 15 }, now));
    expect(await getProfile(db, USER)).toMatchObject({ cigsPerDay: 15, bestSmokeFreeMinutes: 1490 });
  });
});

describe('challenges', () => {
  it('lists the latest state, oldest first', async () => {
    const db = await openTestDb();
    const later = challenge('c2', '2026-09-30T07:10:00');
    const earlier = challenge('c1', '2026-09-29T07:10:00');
    await db.transaction(async (tx) => {
      await saveChallenge(tx, USER, later, at('2026-09-30T07:10:00'));
      await saveChallenge(tx, USER, earlier, at('2026-09-29T07:10:00'));
      await saveChallenge(tx, USER, interrupt(earlier, at('2026-09-29T07:30:00')), at('2026-09-29T07:30:00'));
    });
    const list = await listChallenges(db, USER);
    expect(list.map((c) => [c.id, c.status])).toEqual([
      ['c1', 'interrupted'],
      ['c2', 'running'],
    ]);
  });

  it('rejects a challenge that breaks the data model and writes nothing', async () => {
    const db = await openTestDb();
    const closed = interrupt(challenge('c1', '2026-09-29T07:10:00'), at('2026-09-29T07:30:00'));
    await expect(
      db.transaction((tx) => saveChallenge(tx, USER, { ...closed, resultMinutes: null }, at('2026-09-29T07:30:00'))),
    ).rejects.toThrow('challenges.result_minutes:');
    expect(await listChallenges(db, USER)).toEqual([]);
    expect(await listOutbox(db)).toEqual([]);
  });

  it('allows one challenge per Dilato day', async () => {
    const db = await openTestDb();
    await db.transaction((tx) => saveChallenge(tx, USER, challenge('c1', '2026-09-29T07:10:00'), at('2026-09-29T07:10:00')));
    await expect(
      db.transaction((tx) => saveChallenge(tx, USER, challenge('c2', '2026-09-29T09:00:00'), at('2026-09-29T09:00:00'))),
    ).rejects.toThrow('UNIQUE constraint failed');
  });
});

describe('badges', () => {
  it('awards once, then only counts repeats', async () => {
    const db = await openTestDb();
    const newId = sequentialIds('b');
    await db.transaction((tx) =>
      awardBadge(tx, USER, { badgeId: 'new_record', challengeId: 'c1' }, at('2026-09-29T08:00:00'), newId),
    );
    await db.transaction((tx) =>
      awardBadge(tx, USER, { badgeId: 'new_record', challengeId: 'c2' }, at('2026-09-30T08:00:00'), newId),
    );
    expect(await listEarned(db, USER)).toEqual([
      {
        id: 'b-1',
        badgeId: 'new_record',
        firstEarnedAt: at('2026-09-29T08:00:00'),
        lastEarnedAt: at('2026-09-30T08:00:00'),
        times: 2,
        challengeId: 'c1',
      },
    ]);
  });
});

describe('cravings', () => {
  it('tracks the active session until it ends', async () => {
    const db = await openTestDb();
    const session = {
      id: 'k1',
      challengeId: 'c1',
      startedAt: at('2026-09-29T07:30:00'),
      endedAt: null,
      technique: 'breathing' as const,
    };
    await db.transaction((tx) => saveCraving(tx, USER, session, at('2026-09-29T07:30:00')));
    expect(await activeCraving(db, USER)).toEqual(session);
    await db.transaction((tx) =>
      saveCraving(tx, USER, { ...session, endedAt: at('2026-09-29T07:35:00') }, at('2026-09-29T07:35:00')),
    );
    expect(await activeCraving(db, USER)).toBeNull();
  });
});
