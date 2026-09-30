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
  id: string;
  day: string;
  ladderKey: LadderKey | 'custom';
  targetKind: TargetKind;
  targetMinutes: number;
  lastCigaretteAt: Date;
  startedAt: Date;
  targetAt: Date;
  status: ChallengeStatus;
  /** When the goal (or the most recent overtime block) was reached. */
  achievedAt: Date | null;
  overtimeBlockStartedAt: Date | null;
  overtimeBlockMinutes: OvertimeBlock | null;
  overtimeMinutes: number;
  overtimeBlocksCompleted: number;
  endedAt: Date | null;
  resultMinutes: number | null;
  firstCigaretteAt: Date | null;
  usedCravingHelp: boolean;
  lastSeenAt: Date;
  confirmedAt: Date | null;
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

export function isClosed(ch: Challenge): boolean {
  return ch.status === 'completed' || ch.status === 'interrupted';
}

/** Applies time-derived transitions (goal reached, overtime block reached). */
export function refresh(ch: Challenge, now: Date): Challenge {
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

function complete(ch: Challenge, endedAt: Date): Challenge {
  return {
    ...ch,
    status: 'completed',
    endedAt,
    firstCigaretteAt: endedAt,
    resultMinutes: ch.targetMinutes + ch.overtimeMinutes,
    overtimeBlockStartedAt: null,
    overtimeBlockMinutes: null,
  };
}

function withPartialOvertime(ch: Challenge, now: Date): Challenge {
  const partial = ch.overtimeBlockStartedAt
    ? Math.max(0, minutesBetween(ch.overtimeBlockStartedAt, now))
    : 0;
  return { ...ch, overtimeMinutes: ch.overtimeMinutes + partial };
}

export function addOvertime(ch: Challenge, block: OvertimeBlock, now: Date): Challenge {
  const c = refresh(ch, now);
  if (c.status !== 'achieved') throw new DomainError('invalid_transition');
  return { ...c, status: 'overtime', overtimeBlockStartedAt: now, overtimeBlockMinutes: block, lastSeenAt: now };
}

/** "Na dziś wystarczy". */
export function finishForToday(ch: Challenge, now: Date): Challenge {
  const c = refresh(ch, now);
  if (c.status !== 'achieved') throw new DomainError('invalid_transition');
  return { ...complete(c, now), lastSeenAt: now };
}

/** "Tym razem się nie udało". */
export function interrupt(ch: Challenge, now: Date): Challenge {
  const c = refresh(ch, now);
  switch (c.status) {
    case 'running':
      return {
        ...c,
        status: 'interrupted',
        endedAt: now,
        firstCigaretteAt: now,
        resultMinutes: Math.max(0, minutesBetween(c.startedAt, now)),
        lastSeenAt: now,
      };
    case 'achieved':
      return { ...complete(c, now), lastSeenAt: now };
    case 'overtime':
      return { ...complete(withPartialOvertime(c, now), now), lastSeenAt: now };
    default:
      throw new DomainError('invalid_transition');
  }
}

/** Closes what the previous Dilato day left open. Running challenges (e.g. 24 h) continue. */
export function rollover(ch: Challenge, now: Date): Challenge {
  if (dilatoDay(now) === ch.day) return ch;
  const c = refresh(ch, now);
  if (c.status === 'achieved') return complete(c, c.achievedAt ?? now);
  if (c.status === 'overtime') return complete(withPartialOvertime(c, now), now);
  return c;
}

export function markSeen(ch: Challenge, now: Date): Challenge {
  return { ...ch, lastSeenAt: now };
}

export function markCravingHelpUsed(ch: Challenge): Challenge {
  return { ...ch, usedCravingHelp: true };
}

export function needsConfirmation(ch: Challenge, now: Date): boolean {
  const c = refresh(ch, now);
  return (
    (c.status === 'achieved' || c.status === 'completed') &&
    c.confirmedAt === null &&
    c.lastSeenAt.getTime() < c.targetAt.getTime()
  );
}

export function confirmSucceeded(ch: Challenge, now: Date): Challenge {
  return { ...ch, confirmedAt: now };
}

/** "Zapaliłem(-am) wcześniej": the goal was not actually reached. */
export function confirmSmokedEarlier(ch: Challenge, smokedAt: Date, now: Date): Challenge {
  const c = refresh(ch, now);
  if (c.status !== 'achieved' && c.status !== 'completed') throw new DomainError('invalid_transition');
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
    resultMinutes: minutesBetween(c.startedAt, smokedAt),
    confirmedAt: now,
  };
}

/** Minutes the challenge is worth right now (target + overtime once reached). */
export function liveResultMinutes(ch: Challenge, now: Date): number {
  const c = refresh(ch, now);
  switch (c.status) {
    case 'running':
      return Math.max(0, minutesBetween(c.startedAt, now));
    case 'achieved':
      return c.targetMinutes + c.overtimeMinutes;
    case 'overtime':
      return (
        c.targetMinutes +
        c.overtimeMinutes +
        (c.overtimeBlockStartedAt ? Math.max(0, minutesBetween(c.overtimeBlockStartedAt, now)) : 0)
      );
    default:
      return c.resultMinutes ?? 0;
  }
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
    const c = rollover(ch, now);
    return isClosed(c) && c.day !== today;
  });
}
