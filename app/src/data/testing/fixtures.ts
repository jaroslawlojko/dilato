import type { Profile } from '../types';

export const USER = 'user-1';

export const testProfile: Profile = {
  locale: 'pl',
  habitProfile: 'coffee',
  cigsPerDay: 20,
  packPrice: 18,
  packSize: 20,
  currency: 'PLN',
  momentLabel: 'wyjście z autobusu',
  usualTime: '07:10',
  reminderMode: 'time',
  reminderTime: '07:05',
  reminderDays: 0b0011111,
  grammarForm: 'neutral',
  theme: 'system',
  healthConsentAt: null,
  termsAcceptedAt: null,
  bestSmokeFreeMinutes: 0,
};

/** Deterministic ids: `id-1`, `id-2`, … */
export function sequentialIds(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
