import {
  finishForToday,
  interrupt,
  markCravingHelpUsed,
  startChallenge,
  type Challenge,
} from '../challenge';
import type { LadderKey } from '../ladder';
import { addMinutes } from '../time';

export interface ClosedChallengeOptions {
  id: string;
  /** Dilato day, YYYY-MM-DD; the challenge starts at 07:10 local that day. */
  day: string;
  ladderKey?: LadderKey;
  outcome: 'completed' | 'interrupted';
  interruptedAfterMinutes?: number;
  usedCravingHelp?: boolean;
}

/** Closed challenge started 07:10 local with the last cigarette 9 h earlier (22:10). */
export function closedChallenge(opts: ClosedChallengeOptions): Challenge {
  const now = new Date(`${opts.day}T07:10:00`);
  let c = startChallenge({
    id: opts.id,
    now,
    lastCigaretteAt: addMinutes(now, -540),
    choice: { ladderKey: opts.ladderKey ?? 'm30' },
  });
  if (opts.usedCravingHelp) c = markCravingHelpUsed(c);
  if (opts.outcome === 'interrupted') {
    return interrupt(c, addMinutes(now, opts.interruptedAfterMinutes ?? 10));
  }
  return finishForToday(c, c.targetAt);
}
