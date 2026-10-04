import type { BadgeId } from '../badges';
import { advance, confirmSmokedEarlier, markSeen, startChallenge } from '../challenge';
import type { LadderKey } from '../ladder';
import { reconcile, type ReconcileInput, type SavingsProfile } from '../reconcile';
import { closedChallenge } from '../testing/fixtures';

const profile: SavingsProfile = { cigsPerDay: 20, packPrice: 18, packSize: 20, currency: 'PLN' };
const at = (iso: string) => new Date(iso);
const input = (over: Partial<ReconcileInput>): ReconcileInput => ({
  stored: [],
  earned: new Set<BadgeId>(),
  profile,
  bestSmokeFreeMinutes: 0,
  ...over,
});
/** Started at `startIso` (local), last cigarette 9 h earlier. */
const start = (id: string, startIso: string, ladderKey: LadderKey = 'h1') =>
  startChallenge({
    id,
    now: at(startIso),
    lastCigaretteAt: new Date(at(startIso).getTime() - 540 * 60_000),
    choice: { ladderKey },
  });

describe('reconcile', () => {
  it('is empty without challenges and keeps the stored best', () => {
    expect(reconcile(input({ bestSmokeFreeMinutes: 42 }), at('2026-09-29T07:00:00'))).toEqual({
      challenges: [],
      changed: [],
      awards: [],
      bestSmokeFreeMinutes: 42,
      pendingConfirmation: null,
      current: null,
    });
  });

  it('changes nothing while nothing happened', () => {
    const c = start('b', '2026-09-29T07:10:00');
    const r = reconcile(input({ stored: [c] }), at('2026-09-29T07:30:00'));
    expect(r.changed).toEqual([]);
    expect(r.challenges[0]).toBe(c);
    expect(r.current).toBe(c);
  });

  it('persists a proposed challenge and makes it current', () => {
    const c = start('b', '2026-09-29T07:10:00');
    const r = reconcile(input({ proposed: c }), at('2026-09-29T07:10:00'));
    expect(r.changed).toEqual([c]);
    expect(r.current).toBe(c);
  });

  it('orders challenges oldest first', () => {
    const first = closedChallenge({ id: 'a', day: '2026-09-29', outcome: 'completed' });
    const second = start('b', '2026-09-30T07:10:00');
    const r = reconcile(input({ stored: [second, first] }), at('2026-09-30T07:20:00'));
    expect(r.challenges.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('closes by rollover and awards the new record once', () => {
    const first = closedChallenge({ id: 'a', day: '2026-09-29', outcome: 'completed' }); // 30 min
    const second = start('b', '2026-09-30T07:10:00'); // h1, untouched
    const now = at('2026-10-01T05:00:00');
    const r = reconcile(input({ stored: [first, second] }), now);
    expect(r.changed).toEqual([expect.objectContaining({ id: 'b', status: 'completed', resultMinutes: 60 })]);
    expect(r.awards).toContainEqual({ badgeId: 'new_record', challengeId: 'b' });

    const again = reconcile(input({ stored: r.challenges }), now);
    expect(again.changed).toEqual([]);
    expect(again.awards.filter((a) => a.badgeId === 'new_record')).toEqual([]);
  });

  it('does not award a record again when "smoked earlier" corrects a closed challenge', () => {
    const first = closedChallenge({ id: 'a', day: '2026-09-29', outcome: 'completed' }); // 30 min
    const second = advance(start('b', '2026-09-30T07:10:00'), at('2026-10-01T05:00:00')); // completed 60
    const corrected = confirmSmokedEarlier(second, at('2026-09-30T07:50:00'), at('2026-10-01T07:00:00')); // 40 > 30
    const r = reconcile(input({ stored: [first, second], proposed: corrected }), at('2026-10-01T07:00:00'));
    expect(r.changed).toEqual([corrected]);
    expect(r.awards.map((a) => a.badgeId)).not.toContain('new_record');
  });

  it('awards what is not yet earned, attributed to the latest challenge', () => {
    const c = closedChallenge({ id: 'a', day: '2026-09-29', outcome: 'completed' }); // 30 min
    const r = reconcile(input({ stored: [c], earned: new Set<BadgeId>(['t_15m']) }), at('2026-09-29T12:00:00'));
    expect(r.awards).toEqual([{ badgeId: 't_30m', challengeId: 'a' }]);
  });

  it('feeds the profile savings into piggy_bank', () => {
    const c = closedChallenge({ id: 'a', day: '2026-09-29', outcome: 'completed' }); // 30 min ≈ 250 PLN below
    const rich: SavingsProfile = { cigsPerDay: 80, packPrice: 100, packSize: 1, currency: 'PLN' };
    const r = reconcile(input({ stored: [c], profile: rich }), at('2026-09-29T12:00:00'));
    expect(r.awards.map((a) => a.badgeId)).toContain('piggy_bank');
  });

  it('never lowers the best smoke-free value', () => {
    const c = start('b', '2026-09-29T07:10:00'); // last cigarette 22:10
    expect(reconcile(input({ stored: [c] }), at('2026-09-29T07:40:00')).bestSmokeFreeMinutes).toBe(570);
    expect(
      reconcile(input({ stored: [c], bestSmokeFreeMinutes: 5000 }), at('2026-09-29T07:40:00')).bestSmokeFreeMinutes,
    ).toBe(5000);
  });

  it('reports the latest challenge waiting for "Nadal trwa?"', () => {
    const c = start('b', '2026-09-29T07:10:00');
    expect(reconcile(input({ stored: [c] }), at('2026-09-29T09:00:00')).pendingConfirmation?.id).toBe('b');
    const seen = markSeen(c, at('2026-09-29T08:15:00'));
    expect(reconcile(input({ stored: [seen] }), at('2026-09-29T09:00:00')).pendingConfirmation).toBeNull();
  });

  it('makes the latest challenge current while it is open or from today', () => {
    const closed = closedChallenge({ id: 'a', day: '2026-09-29', outcome: 'completed' });
    expect(reconcile(input({ stored: [closed] }), at('2026-09-29T12:00:00')).current?.id).toBe('a');
    expect(reconcile(input({ stored: [closed] }), at('2026-09-30T09:00:00')).current).toBeNull();
    const day = start('b', '2026-09-29T07:10:00', 'h24');
    expect(reconcile(input({ stored: [day] }), at('2026-09-30T05:00:00')).current?.id).toBe('b');
  });
});
