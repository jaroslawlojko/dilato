import { DomainError } from './errors';
import {
  getStep,
  isStepAvailable,
  isValidCustomMinutes,
  resolveTargetMinutes,
  type LadderKey,
  type TargetKind,
} from './ladder';
import { addMinutes, dilatoDay, minutesBetween } from './time';

export type ChallengeStatus = 'running' | 'achieved' | 'overtime' | 'completed' | 'interrupted';
export type OvertimeBlock = 15 | 30 | 60;
export const OVERTIME_BLOCKS: readonly OvertimeBlock[] = [15, 30, 60];

export interface Challenge {
  readonly id: string;
  readonly day: string;
  readonly ladderKey: LadderKey | 'custom';
  readonly targetKind: TargetKind;
  readonly targetMinutes: number;
  readonly lastCigaretteAt: Date;
  readonly startedAt: Date;
  readonly targetAt: Date;
  readonly status: ChallengeStatus;
  /** When the goal (or the most recent overtime block) was reached. */
  readonly achievedAt: Date | null;
  readonly overtimeBlockStartedAt: Date | null;
  readonly overtimeBlockMinutes: OvertimeBlock | null;
  readonly overtimeMinutes: number;
  readonly overtimeBlocksCompleted: number;
  readonly endedAt: Date | null;
  readonly resultMinutes: number | null;
  readonly firstCigaretteAt: Date | null;
  readonly usedCravingHelp: boolean;
  readonly lastSeenAt: Date;
  readonly confirmedAt: Date | null;
}

export type ChallengeChoice = { ladderKey: LadderKey } | { customMinutes: number };

export interface StartInput {
  id: string;
  now: Date;
  lastCigaretteAt: Date;
  choice: ChallengeChoice;
}

export function startChallenge({ id, now, lastCigaretteAt, choice }: StartInput): Challenge {
  let ladderKey: LadderKey | 'custom';
  let targetKind: TargetKind;
  let targetMinutes: number;

  if ('customMinutes' in choice) {
    if (!isValidCustomMinutes(choice.customMinutes)) throw new DomainError('invalid_custom_minutes');
    ladderKey = 'custom';
    targetKind = 'minutes';
    targetMinutes = choice.customMinutes;
  } else {
    const step = getStep(choice.ladderKey);
    if (!isStepAvailable(step, now)) throw new DomainError('step_unavailable');
    ladderKey = step.key;
    targetKind = step.targetKind;
    targetMinutes = resolveTargetMinutes(step, now);
  }

  if (lastCigaretteAt.getTime() > now.getTime()) throw new DomainError('last_cigarette_in_future');

  return {
    id,
    day: dilatoDay(now),
    ladderKey,
    targetKind,
    targetMinutes,
    lastCigaretteAt,
    startedAt: now,
    targetAt: addMinutes(now, targetMinutes),
    status: 'running',
    achievedAt: null,
    overtimeBlockStartedAt: null,
    overtimeBlockMinutes: null,
    overtimeMinutes: 0,
    overtimeBlocksCompleted: 0,
    endedAt: null,
    resultMinutes: null,
    firstCigaretteAt: null,
    usedCravingHelp: false,
    lastSeenAt: now,
    confirmedAt: null,
  };
}

/** A closed challenge always carries its end, result and first cigarette. */
export type ClosedChallenge = Challenge & {
  readonly status: 'completed' | 'interrupted';
  readonly endedAt: Date;
  readonly resultMinutes: number;
  readonly firstCigaretteAt: Date;
};

export function isClosed(ch: Challenge): ch is ClosedChallenge {
  return ch.status === 'completed' || ch.status === 'interrupted';
}

/** Time-derived transitions: goal reached, overtime block reached. */
function refresh(ch: Challenge, now: Date): Challenge {
  if (ch.status === 'running' && now.getTime() >= ch.targetAt.getTime()) {
    return { ...ch, status: 'achieved', achievedAt: ch.targetAt };
  }
  if (ch.status === 'overtime' && ch.overtimeBlockStartedAt && ch.overtimeBlockMinutes) {
    const blockEnd = addMinutes(ch.overtimeBlockStartedAt, ch.overtimeBlockMinutes);
    if (now.getTime() >= blockEnd.getTime()) {
      return {
        ...ch,
        status: 'achieved',
        achievedAt: blockEnd,
        overtimeMinutes: ch.overtimeMinutes + ch.overtimeBlockMinutes,
        overtimeBlocksCompleted: ch.overtimeBlocksCompleted + 1,
        overtimeBlockStartedAt: null,
        overtimeBlockMinutes: null,
      };
    }
  }
  return ch;
}

/**
 * Closes what an earlier Dilato day left open: an `achieved` challenge is completed once a day
 * rollover has passed since its goal (or last overtime block) was reached. Running challenges
 * (e.g. 24 h) continue, and an in-flight overtime block always runs to its end.
 */
function rollover(ch: Challenge, now: Date): Challenge {
  if (dilatoDay(now) === ch.day) return ch;
  const c = refresh(ch, now);
  if (c.status === 'achieved' && c.achievedAt && dilatoDay(now) !== dilatoDay(c.achievedAt)) {
    return closeAt(c, c.achievedAt);
  }
  return c;
}

/**
 * The challenge as it stands at `now`: closed by rollover once a day boundary has passed since
 * its goal, then time-derived transitions. Returns `ch` itself when nothing changed.
 */
export function advance(ch: Challenge, now: Date): Challenge {
  return refresh(rollover(ch, now), now);
}

function elapsedMinutes(ch: Challenge, at: Date): number {
  return Math.max(0, minutesBetween(ch.startedAt, at));
}

/** Completed overtime plus the elapsed part of a block in progress. */
function overtimeMinutesAt(ch: Challenge, at: Date): number {
  const partial = ch.overtimeBlockStartedAt ? Math.max(0, minutesBetween(ch.overtimeBlockStartedAt, at)) : 0;
  return ch.overtimeMinutes + partial;
}

/** Closes an open challenge at `endedAt`: `completed` once its goal was reached, `interrupted` before. */
function closeAt(ch: Challenge, endedAt: Date): ClosedChallenge {
  const reached = ch.status !== 'running';
  const overtimeMinutes = overtimeMinutesAt(ch, endedAt);
  return {
    ...ch,
    status: reached ? 'completed' : 'interrupted',
    endedAt,
    firstCigaretteAt: endedAt,
    overtimeMinutes,
    resultMinutes: reached ? ch.targetMinutes + overtimeMinutes : elapsedMinutes(ch, endedAt),
    overtimeBlockStartedAt: null,
    overtimeBlockMinutes: null,
  };
}

export function addOvertime(ch: Challenge, block: OvertimeBlock, now: Date): Challenge {
  const c = advance(ch, now);
  if (c.status !== 'achieved') throw new DomainError('invalid_transition');
  return { ...c, status: 'overtime', overtimeBlockStartedAt: now, overtimeBlockMinutes: block, lastSeenAt: now };
}

/** "Na dziś wystarczy". */
export function finishForToday(ch: Challenge, now: Date): ClosedChallenge {
  const c = advance(ch, now);
  if (c.status !== 'achieved') throw new DomainError('invalid_transition');
  return { ...closeAt(c, now), lastSeenAt: now };
}

/** "Tym razem się nie udało": interrupted before the goal, completed after it. */
export function interrupt(ch: Challenge, now: Date): ClosedChallenge {
  const c = advance(ch, now);
  if (isClosed(c)) throw new DomainError('invalid_transition');
  return { ...closeAt(c, now), lastSeenAt: now };
}

export function markSeen(ch: Challenge, now: Date): Challenge {
  return now.getTime() > ch.lastSeenAt.getTime() ? { ...ch, lastSeenAt: now } : ch;
}

export function markCravingHelpUsed(ch: Challenge): Challenge {
  return { ...ch, usedCravingHelp: true };
}

export function needsConfirmation(ch: Challenge, now: Date): boolean {
  const c = advance(ch, now);
  return (
    (c.status === 'achieved' || c.status === 'completed') &&
    c.confirmedAt === null &&
    c.lastSeenAt.getTime() < c.targetAt.getTime()
  );
}

export function confirmSucceeded(ch: Challenge, now: Date): Challenge {
  const c = advance(ch, now);
  if (!needsConfirmation(c, now)) throw new DomainError('invalid_transition');
  return { ...c, confirmedAt: now };
}

/** "Zapaliłem(-am) wcześniej": the goal was not actually reached. */
export function confirmSmokedEarlier(ch: Challenge, smokedAt: Date, now: Date): ClosedChallenge {
  const c = advance(ch, now);
  if (!needsConfirmation(c, now)) throw new DomainError('invalid_transition');
  if (smokedAt.getTime() < c.startedAt.getTime() || smokedAt.getTime() > c.targetAt.getTime()) {
    throw new DomainError('smoked_at_out_of_range');
  }
  return {
    ...c,
    status: 'interrupted',
    achievedAt: null,
    overtimeBlockStartedAt: null,
    overtimeBlockMinutes: null,
    overtimeMinutes: 0,
    overtimeBlocksCompleted: 0,
    endedAt: smokedAt,
    firstCigaretteAt: smokedAt,
    resultMinutes: elapsedMinutes(c, smokedAt),
    confirmedAt: now,
  };
}

/** Minutes the challenge is worth right now: its result if it were closed at `now`. */
export function liveResultMinutes(ch: Challenge, now: Date): number {
  const c = advance(ch, now);
  return (isClosed(c) ? c : closeAt(c, now)).resultMinutes;
}

/** Sun position on the horizon arc, 0..1. */
export function clockProgress(ch: Challenge, now: Date): number {
  const total = ch.targetAt.getTime() - ch.startedAt.getTime();
  const elapsed = now.getTime() - ch.startedAt.getTime();
  return Math.min(1, Math.max(0, elapsed / total));
}

export function canStartToday(challenges: readonly Challenge[], now: Date): boolean {
  const today = dilatoDay(now);
  return challenges.every((ch) => {
    const c = advance(ch, now);
    return isClosed(c) && c.day !== today;
  });
}
