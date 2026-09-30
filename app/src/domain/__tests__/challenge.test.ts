import {
  addOvertime,
  canStartToday,
  clockProgress,
  confirmSmokedEarlier,
  confirmSucceeded,
  finishForToday,
  interrupt,
  liveResultMinutes,
  markCravingHelpUsed,
  markSeen,
  needsConfirmation,
  refresh,
  rollover,
  startChallenge,
  type StartInput,
} from '../challenge';

const t = (hhmmss: string) => new Date(`2026-09-29T${hhmmss}`);
const nextDay = (hhmmss: string) => new Date(`2026-09-30T${hhmmss}`);

const start = (over: Partial<StartInput> = {}) =>
  startChallenge({
    id: 'c1',
    now: t('07:10:00'),
    lastCigaretteAt: new Date('2026-09-28T22:05:00'),
    choice: { ladderKey: 'h1' },
    ...over,
  });

describe('startChallenge', () => {
  it('creates a running challenge with derived target', () => {
    const c = start();
    expect(c).toMatchObject({
      id: 'c1',
      day: '2026-09-29',
      ladderKey: 'h1',
      targetKind: 'minutes',
      targetMinutes: 60,
      status: 'running',
      overtimeMinutes: 0,
      overtimeBlocksCompleted: 0,
      resultMinutes: null,
      usedCravingHelp: false,
      confirmedAt: null,
    });
    expect(c.targetAt).toEqual(t('08:10:00'));
    expect(c.lastSeenAt).toEqual(t('07:10:00'));
  });

  it('accepts a valid custom target', () => {
    const c = start({ choice: { customMinutes: 50 } });
    expect(c.ladderKey).toBe('custom');
    expect(c.targetAt).toEqual(t('08:00:00'));
  });

  it('resolves noon at start time', () => {
    const c = start({ choice: { ladderKey: 'noon' } });
    expect(c.targetKind).toBe('until_noon');
    expect(c.targetMinutes).toBe(290);
  });

  it('rejects invalid custom minutes', () => {
    expect(() => start({ choice: { customMinutes: 12 } })).toThrow('invalid_custom_minutes');
  });

  it('rejects noon after the cutoff', () => {
    expect(() => start({ now: t('11:50:00'), choice: { ladderKey: 'noon' } })).toThrow('step_unavailable');
  });

  it('rejects a last cigarette in the future', () => {
    expect(() => start({ lastCigaretteAt: t('08:00:00') })).toThrow('last_cigarette_in_future');
  });
});

describe('refresh and live values', () => {
  it('stays running before the target', () => {
    const c = start();
    expect(refresh(c, t('07:47:12'))).toBe(c);
    expect(liveResultMinutes(c, t('07:47:12'))).toBe(37);
  });

  it('becomes achieved at target time even when read much later', () => {
    const c = refresh(start(), t('09:30:00'));
    expect(c.status).toBe('achieved');
    expect(c.achievedAt).toEqual(t('08:10:00'));
    expect(liveResultMinutes(c, t('09:30:00'))).toBe(60);
  });

  it('reports clock progress clamped to 0..1', () => {
    const c = start();
    expect(clockProgress(c, t('07:40:00'))).toBe(0.5);
    expect(clockProgress(c, t('07:00:00'))).toBe(0);
    expect(clockProgress(c, t('09:00:00'))).toBe(1);
  });

  it('lasts real minutes across the DST change', () => {
    // 01:00 CEST = 23:00Z; +180 min = 02:00Z = 03:00 CET
    const c = start({
      now: new Date('2026-10-25T01:00:00'),
      lastCigaretteAt: new Date('2026-10-24T22:00:00'),
      choice: { ladderKey: 'h3' },
    });
    expect(c.day).toBe('2026-10-24');
    expect(c.targetAt).toEqual(new Date('2026-10-25T02:00:00Z'));
    expect(refresh(c, new Date('2026-10-25T01:59:00Z')).status).toBe('running');
    expect(refresh(c, new Date('2026-10-25T02:00:00Z')).status).toBe('achieved');
  });

  it('does not mutate the input', () => {
    const c = start();
    interrupt(c, t('07:51:00'));
    expect(c.status).toBe('running');
  });
});

describe('interrupt', () => {
  it('records elapsed minutes and the first cigarette', () => {
    const c = interrupt(start(), t('07:51:00'));
    expect(c).toMatchObject({ status: 'interrupted', resultMinutes: 41 });
    expect(c.endedAt).toEqual(t('07:51:00'));
    expect(c.firstCigaretteAt).toEqual(t('07:51:00'));
    expect(c.lastSeenAt).toEqual(t('07:51:00'));
  });

  it('completes a challenge whose goal was already reached', () => {
    const c = interrupt(start(), t('08:30:00'));
    expect(c).toMatchObject({ status: 'completed', resultMinutes: 60 });
    expect(c.endedAt).toEqual(t('08:30:00'));
  });

  it('rejects a closed challenge', () => {
    const c = interrupt(start(), t('07:51:00'));
    expect(() => interrupt(c, t('07:55:00'))).toThrow('invalid_transition');
  });
});

describe('finishForToday', () => {
  it('completes an achieved challenge at the tap', () => {
    const c = finishForToday(start(), t('08:30:00'));
    expect(c).toMatchObject({ status: 'completed', resultMinutes: 60 });
    expect(c.endedAt).toEqual(t('08:30:00'));
    expect(c.firstCigaretteAt).toEqual(t('08:30:00'));
  });

  it('rejects a running challenge', () => {
    expect(() => finishForToday(start(), t('07:30:00'))).toThrow('invalid_transition');
  });
});

describe('overtime', () => {
  it('starts at the tap, returns to achieved when reached, and counts partial blocks', () => {
    let c = addOvertime(start(), 30, t('08:20:00'));
    expect(c.status).toBe('overtime');
    expect(c.overtimeBlockStartedAt).toEqual(t('08:20:00'));
    expect(liveResultMinutes(c, t('08:35:00'))).toBe(75);

    c = refresh(c, t('08:50:00'));
    expect(c).toMatchObject({ status: 'achieved', overtimeMinutes: 30, overtimeBlocksCompleted: 1 });
    expect(c.achievedAt).toEqual(t('08:50:00'));

    c = addOvertime(c, 15, t('09:00:00'));
    c = interrupt(c, t('09:07:00'));
    expect(c).toMatchObject({ status: 'completed', overtimeMinutes: 37, resultMinutes: 97 });
    expect(c.endedAt).toEqual(t('09:07:00'));
  });

  it('rejects overtime before the goal', () => {
    expect(() => addOvertime(start(), 15, t('07:30:00'))).toThrow('invalid_transition');
  });
});

describe('rollover', () => {
  it('leaves a challenge alone on the same Dilato day', () => {
    const c = start();
    expect(rollover(c, t('23:00:00'))).toBe(c);
  });

  it('auto-completes an untouched achieved challenge at its goal time', () => {
    const c = rollover(start(), nextDay('05:00:00'));
    expect(c).toMatchObject({ status: 'completed', resultMinutes: 60 });
    expect(c.endedAt).toEqual(t('08:10:00'));
  });

  it('counts a finished overtime block before auto-completing', () => {
    const c = rollover(addOvertime(start(), 30, t('08:20:00')), nextDay('05:00:00'));
    expect(c).toMatchObject({ status: 'completed', resultMinutes: 90 });
    expect(c.endedAt).toEqual(t('08:50:00'));
  });

  it('lets an overtime block that spans 04:00 run to its end, whenever it is read', () => {
    const late = start({
      now: t('23:00:00'),
      lastCigaretteAt: t('20:00:00'),
      choice: { ladderKey: 'm30' },
    });
    const inOvertime = addOvertime(late, 60, nextDay('03:30:00'));

    // Block still in flight just after the day boundary: nothing is cut.
    expect(rollover(inOvertime, nextDay('04:10:00'))).toMatchObject({ status: 'overtime', overtimeMinutes: 0 });

    // Block reached at 04:30 on the new day: back to achieved, not closed yet.
    const reached = rollover(inOvertime, nextDay('04:40:00'));
    expect(reached).toMatchObject({ status: 'achieved', overtimeMinutes: 60, overtimeBlocksCompleted: 1 });
    expect(reached.achievedAt).toEqual(nextDay('04:30:00'));

    // Left untouched until the following rollover: closed at the block end.
    const closed = rollover(inOvertime, new Date('2026-10-01T05:00:00'));
    expect(closed).toMatchObject({ status: 'completed', overtimeMinutes: 60, resultMinutes: 90 });
    expect(closed.endedAt).toEqual(nextDay('04:30:00'));
  });

  it('keeps a 24 h challenge running into the next day', () => {
    const c = start({ choice: { ladderKey: 'h24' } });
    expect(rollover(c, nextDay('05:00:00')).status).toBe('running');
  });

  it('keeps a goal reached on a later Dilato day open until the following rollover', () => {
    const c = start({ choice: { ladderKey: 'h24' } });
    const reached = rollover(c, nextDay('07:30:00'));
    expect(reached.status).toBe('achieved');
    expect(reached.achievedAt).toEqual(nextDay('07:10:00'));
    expect(addOvertime(reached, 60, nextDay('07:35:00')).status).toBe('overtime');

    const closed = rollover(c, new Date('2026-10-01T05:00:00'));
    expect(closed).toMatchObject({ status: 'completed', resultMinutes: 1440 });
    expect(closed.endedAt).toEqual(nextDay('07:10:00'));
  });

  it('closes a long-abandoned challenge at its goal time', () => {
    const c = rollover(start(), new Date('2026-10-03T12:00:00'));
    expect(c).toMatchObject({ status: 'completed', resultMinutes: 60 });
    expect(c.endedAt).toEqual(t('08:10:00'));
  });
});

describe('confirmation ("Nadal trwa?")', () => {
  it('asks when the goal was reached without the app being opened', () => {
    expect(needsConfirmation(start(), t('09:00:00'))).toBe(true);
    expect(needsConfirmation(markSeen(start(), t('07:30:00')), t('09:00:00'))).toBe(true);
  });

  it('does not ask when the app was seen after the goal or already confirmed', () => {
    expect(needsConfirmation(markSeen(start(), t('08:15:00')), t('09:00:00'))).toBe(false);
    expect(needsConfirmation(confirmSucceeded(start(), t('09:00:00')), t('09:05:00'))).toBe(false);
    expect(needsConfirmation(finishForToday(start(), t('08:30:00')), t('09:00:00'))).toBe(false);
  });

  it('does not ask while still running', () => {
    expect(needsConfirmation(start(), t('07:30:00'))).toBe(false);
  });

  it('asks after an unattended rollover auto-complete', () => {
    expect(needsConfirmation(rollover(start(), nextDay('05:00:00')), nextDay('07:00:00'))).toBe(true);
  });

  it('turns the challenge into an interruption at the reported time', () => {
    const withOvertime = refresh(addOvertime(start(), 30, t('08:20:00')), t('09:00:00'));
    const c = confirmSmokedEarlier(withOvertime, t('07:40:00'), t('09:05:00'));
    expect(c).toMatchObject({
      status: 'interrupted',
      resultMinutes: 30,
      overtimeMinutes: 0,
      overtimeBlocksCompleted: 0,
    });
    expect(c.endedAt).toEqual(t('07:40:00'));
    expect(c.firstCigaretteAt).toEqual(t('07:40:00'));
    expect(c.confirmedAt).toEqual(t('09:05:00'));
  });

  it('rejects a smoke time outside the challenge window', () => {
    expect(() => confirmSmokedEarlier(start(), t('08:20:00'), t('09:00:00'))).toThrow('smoked_at_out_of_range');
  });

  it('rejects correcting a challenge that is still running', () => {
    expect(() => confirmSmokedEarlier(start(), t('07:20:00'), t('07:30:00'))).toThrow('invalid_transition');
  });
});

describe('misc', () => {
  it('marks craving help', () => {
    expect(markCravingHelpUsed(start()).usedCravingHelp).toBe(true);
  });

  it('allows one challenge per Dilato day and none while one is open', () => {
    expect(canStartToday([], t('07:00:00'))).toBe(true);
    expect(canStartToday([start()], t('07:30:00'))).toBe(false);
    expect(canStartToday([interrupt(start(), t('07:51:00'))], t('12:00:00'))).toBe(false);
    expect(canStartToday([interrupt(start(), t('07:51:00'))], nextDay('07:00:00'))).toBe(true);
    // yesterday's untouched achieved challenge is auto-completed by rollover
    expect(canStartToday([start()], nextDay('07:00:00'))).toBe(true);
    // a 24 h challenge still running blocks the next day
    expect(canStartToday([start({ choice: { ladderKey: 'h24' } })], nextDay('06:00:00'))).toBe(false);
    // a 24 h challenge whose goal was reached today stays open until the user closes it
    expect(canStartToday([start({ choice: { ladderKey: 'h24' } })], nextDay('08:00:00'))).toBe(false);
  });
});
