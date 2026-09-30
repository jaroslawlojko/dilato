import type { LadderKey } from './ladder';

export type HabitProfile = 'wake' | 'coffee' | 'situation' | 'later';

/** The four steps previewed in onboarding (S02b "Twoja pierwsza drabina"). */
export const STARTING_LADDERS: Record<HabitProfile, readonly LadderKey[]> = {
  wake: ['m30', 'm45', 'h1', 'h1_5'],
  coffee: ['m30', 'm45', 'h1', 'h2'],
  situation: ['m30', 'h1', 'h2', 'h3'],
  later: ['m30', 'h1', 'h2', 'evening'],
};

export const FIRST_SUGGESTION: LadderKey = 'm30';
export const HEAVY_HABIT_CIGS = 20;

export function successesToStepUp(cigsPerDay: number): number {
  return cigsPerDay > HEAVY_HABIT_CIGS ? 3 : 2;
}
