import { getStep, isStepAvailable, stepAbove, stepBelow, stepForMinutes, stepIndex, type LadderKey } from './ladder';
import { FIRST_SUGGESTION, successesToStepUp } from './profile';

export interface ClosedChallengeSummary {
  ladderKey: LadderKey | 'custom';
  targetMinutes: number;
  status: 'completed' | 'interrupted';
}

export interface Suggestion {
  primary: LadderKey;
  lowerAlternative: LadderKey | null;
}

export function effectiveKey(c: ClosedChallengeSummary): LadderKey {
  return c.ladderKey === 'custom' ? stepForMinutes(c.targetMinutes) : c.ladderKey;
}

function atLeastFirstSuggestion(key: LadderKey): LadderKey {
  return stepIndex(key) < stepIndex(FIRST_SUGGESTION) ? FIRST_SUGGESTION : key;
}

/** `history`: closed challenges, oldest first. */
export function suggestNext(
  history: readonly ClosedChallengeSummary[],
  cigsPerDay: number,
  plannedForTomorrow: LadderKey | null = null,
): Suggestion {
  if (plannedForTomorrow) return { primary: plannedForTomorrow, lowerAlternative: null };

  const last = history[history.length - 1];
  if (!last) return { primary: FIRST_SUGGESTION, lowerAlternative: null };

  const lastKey = effectiveKey(last);

  if (last.status === 'interrupted') {
    const primary = atLeastFirstSuggestion(lastKey);
    return { primary, lowerAlternative: stepBelow(primary) };
  }

  const needed = successesToStepUp(cigsPerDay);
  const recent = history.slice(-needed);
  const steppedUp =
    recent.length === needed &&
    recent.every((c) => c.status === 'completed' && effectiveKey(c) === lastKey);

  const primary = atLeastFirstSuggestion(steppedUp ? stepAbove(lastKey) : lastKey);
  return { primary, lowerAlternative: null };
}

/**
 * The suggestion as it can be offered at `now`: a step that cannot be started any more
 * (noon / evening past their cutoff) is replaced by the nearest available step below it.
 */
export function availableSuggestion(suggestion: Suggestion, now: Date): Suggestion {
  const nearestAvailable = (key: LadderKey): LadderKey => {
    let k = key;
    while (!isStepAvailable(getStep(k), now)) k = stepBelow(k);
    return k;
  };
  const primary = nearestAvailable(suggestion.primary);
  const lower = suggestion.lowerAlternative ? nearestAvailable(suggestion.lowerAlternative) : null;
  return { primary, lowerAlternative: lower === primary ? null : lower };
}
