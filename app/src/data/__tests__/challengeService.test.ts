import { DomainError, type LadderKey } from '../../domain';
import { closedChallenge } from '../../domain/testing/fixtures';
import { NoProfileError, createChallengeService } from '../challengeService';
import { getProfile, listChallenges, listEarned, saveChallenge, saveProfile } from '../repositories';
import { USER, sequentialIds, testProfile } from '../testing/fixtures';
import { openTestDb } from '../testing/openTestDb';
import { listOutbox } from '../write';

const at = (iso: string) => new Date(iso);
const choose = (ladderKey: LadderKey, lastCigaretteAt: Date) => ({ choice: { ladderKey }, lastCigaretteAt });
const ids = (awarded: readonly { badgeId: string }[]) => awarded.map((a) => a.badgeId);

async function setup() {
  const db = await openTestDb();
  await db.transaction((tx) => saveProfile(tx, USER, testProfile, at('2026-09-28T20:00:00')));
  return { db, svc: createChallengeService({ db, userId: USER, newId: sequentialIds() }) };
}

/** Yesterday a 30-min success; today (2026-09-30) an h1 challenge started 07:10, last cigarette 22:10. */
async function withRecordCandidate() {
  const s = await setup();
  await s.db.transaction((tx) =>
    saveChallenge(tx, USER, closedChallenge({ id: 'd1', day: '2026-09-29', outcome: 'completed' }), at('2026-09-29T08:00:00')),
  );
  await s.svc.start(choose('h1', at('2026-09-29T22:10:00')), at('2026-09-30T07:10:00')); // id-1
  return s;
}

describe('ChallengeService', () => {
  it('needs a profile', async () => {
    const db = await openTestDb();
    const svc = createChallengeService({ db, userId: USER, newId: sequentialIds() });
    await expect(svc.open(at('2026-09-29T07:00:00'))).rejects.toBeInstanceOf(NoProfileError);
  });

  it('starts a challenge, persists it and queues it for sync', async () => {
    const { db, svc } = await setup();
    const s = await svc.start(choose('h1', at('2026-09-28T22:10:00')), at('2026-09-29T07:10:00'));
    expect(s.current).toMatchObject({ id: 'id-1', status: 'running' });
    expect(s.awarded).toEqual([]);
    expect(await listChallenges(db, USER)).toEqual([s.current]);
    expect(await listOutbox(db)).toContainEqual(expect.objectContaining({ tableName: 'challenges', rowId: 'id-1' }));
  });

  it('refuses a second start on the same Dilato day and writes nothing', async () => {
    const { db, svc } = await setup();
    await svc.start(choose('h1', at('2026-09-28T22:10:00')), at('2026-09-29T07:10:00'));
    await svc.interrupt(at('2026-09-29T07:30:00'));
    await expect(svc.start(choose('m30', at('2026-09-28T22:10:00')), at('2026-09-29T09:00:00'))).rejects.toThrow(
      DomainError,
    );
    expect(await listChallenges(db, USER)).toHaveLength(1);
  });

  it('awards threshold badges when the goal is reached, not again on finish', async () => {
    const { db, svc } = await setup();
    await svc.start(choose('h1', at('2026-09-28T22:10:00')), at('2026-09-29T07:10:00'));
    expect(ids((await svc.open(at('2026-09-29T08:15:00'))).awarded)).toEqual(['t_15m', 't_30m', 't_45m', 't_1h']);
    const done = await svc.finishForToday(at('2026-09-29T08:30:00'));
    expect(done.awarded).toEqual([]);
    expect(done.current).toMatchObject({ status: 'completed', resultMinutes: 60 });
    expect((await listEarned(db, USER)).map((b) => b.badgeId)).toContain('t_1h');
  });

  it('on reopen days later: closes at the goal, awards the record, asks to confirm, keeps the best value', async () => {
    const { db, svc } = await withRecordCandidate();
    const evening = await svc.open(at('2026-09-30T23:00:00'));
    expect(evening.current?.status).toBe('achieved');
    expect(evening.bestSmokeFreeMinutes).toBe(1490);

    const next = await svc.open(at('2026-10-01T05:00:00'));
    expect(next.challenges.find((c) => c.id === 'id-1')).toMatchObject({ status: 'completed', resultMinutes: 60 });
    expect(next.awarded).toEqual([{ badgeId: 'new_record', challengeId: 'id-1' }]);
    expect(next.pendingConfirmation?.id).toBe('id-1');
    expect(next.bestSmokeFreeMinutes).toBe(1490);
    expect((await listChallenges(db, USER))[1].status).toBe('completed');
    expect((await getProfile(db, USER))?.bestSmokeFreeMinutes).toBe(1490);
  });

  it('writes nothing when a reopen finds nothing new', async () => {
    const { db, svc } = await withRecordCandidate();
    await svc.open(at('2026-10-01T05:00:00'));
    const before = await db.all('SELECT id, updated_at FROM challenges ORDER BY id');
    const profileBefore = await db.get('SELECT updated_at FROM profiles');
    const again = await svc.open(at('2026-10-01T06:00:00'));
    expect(again.awarded).toEqual([]);
    expect(await db.all('SELECT id, updated_at FROM challenges ORDER BY id')).toEqual(before);
    expect(await db.get('SELECT updated_at FROM profiles')).toEqual(profileBefore);
  });

  it('awards each badge once when two opens race', async () => {
    const { db, svc } = await withRecordCandidate();
    const now = at('2026-10-01T05:00:00');
    const [first, second] = await Promise.all([svc.open(now), svc.open(now)]);
    expect(ids(first.awarded)).toContain('new_record');
    expect(second.awarded).toEqual([]);
    expect((await listEarned(db, USER)).find((b) => b.badgeId === 'new_record')?.times).toBe(1);
  });

  it('"smoked earlier" after a record keeps every badge and does not award the record again', async () => {
    const { db, svc } = await withRecordCandidate();
    await svc.open(at('2026-10-01T05:00:00'));
    const s = await svc.confirmSmokedEarlier(at('2026-09-30T07:50:00'), at('2026-10-01T07:00:00'));
    expect(s.challenges.find((c) => c.id === 'id-1')).toMatchObject({ status: 'interrupted', resultMinutes: 40 });
    expect(s.awarded).toEqual([]);
    expect(s.pendingConfirmation).toBeNull();
    const earned = await listEarned(db, USER);
    expect(earned.find((b) => b.badgeId === 'new_record')?.times).toBe(1);
    expect(earned.map((b) => b.badgeId)).toContain('t_1h');
  });

  it('does not mark the challenge seen while "Nadal trwa?" is unanswered', async () => {
    const { db, svc } = await setup();
    await svc.start(choose('h1', at('2026-09-28T22:10:00')), at('2026-09-29T07:10:00'));
    await svc.markSeen(at('2026-09-29T09:00:00'));
    expect((await listChallenges(db, USER))[0].lastSeenAt).toEqual(at('2026-09-29T07:10:00'));
    expect((await svc.confirmSucceeded(at('2026-09-29T09:01:00'))).pendingConfirmation).toBeNull();
    await svc.markSeen(at('2026-09-29T09:02:00'));
    expect((await listChallenges(db, USER))[0].lastSeenAt).toEqual(at('2026-09-29T09:02:00'));
  });

  it('rejects a transition on a challenge that rollover closed, and writes nothing', async () => {
    const { db, svc } = await setup();
    await svc.start(choose('h1', at('2026-09-28T22:10:00')), at('2026-09-29T07:10:00'));
    const before = await listOutbox(db);
    await expect(svc.interrupt(at('2026-10-02T09:00:00'))).rejects.toThrow('invalid_transition');
    expect((await listChallenges(db, USER))[0].status).toBe('running');
    expect(await listOutbox(db)).toEqual(before);
  });

  it('awards extra_time when an overtime block completes', async () => {
    const { svc } = await setup();
    await svc.start(choose('h1', at('2026-09-28T22:10:00')), at('2026-09-29T07:10:00'));
    await svc.addOvertime(30, at('2026-09-29T08:20:00'));
    expect(ids((await svc.open(at('2026-09-29T08:50:00'))).awarded)).toContain('extra_time');
  });

  it('records craving help on the challenge and tracks the session', async () => {
    const { db, svc } = await setup();
    await svc.start(choose('h1', at('2026-09-28T22:10:00')), at('2026-09-29T07:10:00'));
    const during = await svc.startCraving('breathing', at('2026-09-29T07:30:00'));
    expect(during.current?.usedCravingHelp).toBe(true);
    expect(during.activeCraving).toEqual({
      id: 'id-2',
      challengeId: 'id-1',
      startedAt: at('2026-09-29T07:30:00'),
      endedAt: null,
      technique: 'breathing',
    });
    const after = await svc.endCraving(at('2026-09-29T07:35:00'));
    expect(after.activeCraving).toBeNull();
    expect(await db.get('SELECT ended_at FROM craving_sessions')).toEqual({ ended_at: at('2026-09-29T07:35:00').toISOString() });
  });

  it('keeps one outbox entry per row with its latest state', async () => {
    const { db, svc } = await setup();
    await svc.start(choose('h1', at('2026-09-28T22:10:00')), at('2026-09-29T07:10:00'));
    await svc.interrupt(at('2026-09-29T07:30:00'));
    const entries = (await listOutbox(db)).filter((e) => e.tableName === 'challenges');
    expect(entries).toHaveLength(1);
    expect(entries[0].payload).toMatchObject({ id: 'id-1', status: 'interrupted' });
  });
});
