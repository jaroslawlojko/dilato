import { addOvertime, interrupt, startChallenge, type Challenge } from '../../domain';
import {
  challengeFromRow,
  challengeToRow,
  cravingFromRow,
  cravingToRow,
  earnedBadgeFromRow,
  earnedBadgeToRow,
  profileFromRow,
  profileToRow,
} from '../rows';
import { USER, testProfile } from '../testing/fixtures';
import type { CravingSession, EarnedBadge } from '../types';

const t = (hhmm: string) => new Date(`2026-09-29T${hhmm}:00`);
const stamps = { created_at: '2026-09-29T05:00:00.000Z', updated_at: '2026-09-29T05:00:00.000Z', deleted_at: null };

const running = startChallenge({
  id: 'c1',
  now: t('07:10'),
  lastCigaretteAt: new Date('2026-09-28T22:10:00'),
  choice: { ladderKey: 'h1' },
});
const inOvertime = addOvertime(running, 30, t('08:20'));
const closed = interrupt(inOvertime, t('08:40'));
const stored = (ch: Challenge) => ({ ...challengeToRow(ch, USER), ...stamps });

describe('challenge rows', () => {
  it.each([
    ['running', running],
    ['overtime', inOvertime],
    ['closed', closed],
  ])('round-trips a %s challenge', (_, ch) => {
    expect(challengeFromRow(stored(ch))).toEqual(ch);
  });

  it('stores instants as UTC ISO strings', () => {
    expect(challengeToRow(running, USER)).toMatchObject({ started_at: '2026-09-29T05:10:00.000Z', used_craving_help: 0 });
  });

  it.each([
    ['status', 'paused'],
    ['ladder_key', 'm5'],
    ['target_kind', 'until_dawn'],
    ['target_minutes', 10],
    ['target_minutes', 1.5],
    ['day', '2026-9-29'],
    ['started_at', '2026-09-29 07:10'],
    ['started_at', '2026-13-45T07:10:00.000Z'],
    ['last_seen_at', null],
    ['used_craving_help', 2],
    ['overtime_minutes', -1],
    ['overtime_block_minutes', 45],
    ['id', 42],
  ])('rejects challenges.%s = %p', (column, value) => {
    expect(() => challengeFromRow({ ...stored(running), [column]: value })).toThrow(`challenges.${column}:`);
  });

  it('rejects a closed challenge without its result', () => {
    expect(() => challengeFromRow({ ...stored(closed), result_minutes: null })).toThrow('challenges.result_minutes:');
  });

  it('rejects an overtime challenge without its block start', () => {
    expect(() => challengeFromRow({ ...stored(inOvertime), overtime_block_started_at: null })).toThrow(
      'challenges.overtime_block_started_at:',
    );
  });
});

describe('profile rows', () => {
  const consented = { ...testProfile, healthConsentAt: new Date('2026-09-28T18:00:00.000Z') };

  it.each([
    ['without consents', testProfile],
    ['with consents', consented],
  ])('round-trips a profile %s', (_, p) => {
    expect(profileFromRow({ ...profileToRow(p, USER), ...stamps })).toEqual(p);
  });

  it.each([
    ['locale', 'de'],
    ['habit_profile', 'night'],
    ['cigs_per_day', 0],
    ['cigs_per_day', 81],
    ['pack_price', -1],
    ['pack_size', 0],
    ['currency', 'CHF'],
    ['usual_time', '7:10'],
    ['reminder_time', '24:00'],
    ['reminder_mode', 'place'],
    ['reminder_days', 128],
    ['grammar_form', 'x'],
    ['theme', 'sepia'],
    ['best_smoke_free_minutes', -5],
  ])('rejects profiles.%s = %p', (column, value) => {
    expect(() => profileFromRow({ ...profileToRow(testProfile, USER), [column]: value })).toThrow(`profiles.${column}:`);
  });
});

describe('badge and craving rows', () => {
  const badge: EarnedBadge = {
    id: 'b1',
    badgeId: 'new_record',
    firstEarnedAt: new Date('2026-09-29T06:00:00.000Z'),
    lastEarnedAt: new Date('2026-09-30T06:00:00.000Z'),
    times: 2,
    challengeId: 'c1',
  };
  const craving: CravingSession = {
    id: 'k1',
    challengeId: 'c1',
    startedAt: new Date('2026-09-29T05:30:00.000Z'),
    endedAt: null,
    technique: 'breathing',
  };

  it('round-trips both', () => {
    expect(earnedBadgeFromRow({ ...earnedBadgeToRow(badge, USER), ...stamps })).toEqual(badge);
    expect(cravingFromRow({ ...cravingToRow(craving, USER), ...stamps })).toEqual(craving);
  });

  it('rejects unknown badges, zero times and unknown techniques', () => {
    expect(() => earnedBadgeFromRow({ ...earnedBadgeToRow(badge, USER), badge_id: 'golden' })).toThrow(
      'badges_earned.badge_id:',
    );
    expect(() => earnedBadgeFromRow({ ...earnedBadgeToRow(badge, USER), times: 0 })).toThrow('badges_earned.times:');
    expect(() => cravingFromRow({ ...cravingToRow(craving, USER), technique: 'smoking' })).toThrow(
      'craving_sessions.technique:',
    );
  });
});
