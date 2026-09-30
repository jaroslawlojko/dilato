import { FIRST_SUGGESTION, STARTING_LADDERS, successesToStepUp } from '../profile';
import { suggestNext, type ClosedChallengeSummary } from '../suggestion';
import type { LadderKey } from '../ladder';

const ok = (ladderKey: LadderKey | 'custom', targetMinutes = 0): ClosedChallengeSummary => ({
  ladderKey, targetMinutes, status: 'completed',
});
const fail = (ladderKey: LadderKey | 'custom', targetMinutes = 0): ClosedChallengeSummary => ({
  ladderKey, targetMinutes, status: 'interrupted',
});

describe('profiles', () => {
  it('starts every profile at 30 minutes with its own step sizes', () => {
    expect(FIRST_SUGGESTION).toBe('m30');
    expect(STARTING_LADDERS).toEqual({
      wake: ['m30', 'm45', 'h1', 'h1_5'],
      coffee: ['m30', 'm45', 'h1', 'h2'],
      situation: ['m30', 'h1', 'h2', 'h3'],
      later: ['m30', 'h1', 'h2', 'evening'],
    });
  });

  it('needs 3 successes above 20 cigarettes a day, otherwise 2', () => {
    expect(successesToStepUp(20)).toBe(2);
    expect(successesToStepUp(21)).toBe(3);
  });
});

describe('suggestNext', () => {
  it('suggests 30 minutes with no history', () => {
    expect(suggestNext([], 15)).toEqual({ primary: 'm30', lowerAlternative: null });
  });

  it('keeps the same step after one success', () => {
    expect(suggestNext([ok('m45')], 15).primary).toBe('m45');
  });

  it('steps up after two successes at the same step', () => {
    expect(suggestNext([ok('m45'), ok('m45')], 15)).toEqual({ primary: 'h1', lowerAlternative: null });
  });

  it('does not keep climbing every day after a step up', () => {
    expect(suggestNext([ok('m30'), ok('m30'), ok('m45')], 15).primary).toBe('m45');
  });

  it('needs three successes at the same step for heavier habits', () => {
    expect(suggestNext([ok('m45'), ok('m45')], 25).primary).toBe('m45');
    expect(suggestNext([ok('m45'), ok('m45'), ok('m45')], 25).primary).toBe('h1');
  });

  it('keeps the step and offers one lower after an interruption', () => {
    expect(suggestNext([ok('h1'), fail('h1')], 15)).toEqual({ primary: 'h1', lowerAlternative: 'm45' });
  });

  it('offers 15 minutes as the lower alternative after an interrupted 30', () => {
    expect(suggestNext([fail('m30')], 15)).toEqual({ primary: 'm30', lowerAlternative: 'm15' });
  });

  it('never suggests below 30 minutes by default', () => {
    expect(suggestNext([ok('m15')], 15).primary).toBe('m30');
    expect(suggestNext([ok('m15'), ok('m15')], 15).primary).toBe('m30');
    expect(suggestNext([fail('m15')], 15)).toEqual({ primary: 'm30', lowerAlternative: 'm15' });
  });

  it('treats custom targets as the nearest step at or below', () => {
    expect(suggestNext([ok('custom', 50)], 15).primary).toBe('m45');
    expect(suggestNext([ok('custom', 50), ok('custom', 55)], 15).primary).toBe('h1');
  });

  it('steps from noon to evening and caps at 24 h', () => {
    expect(suggestNext([ok('noon'), ok('noon')], 15).primary).toBe('evening');
    expect(suggestNext([ok('h24'), ok('h24')], 15).primary).toBe('h24');
  });

  it('uses the plan for tomorrow when one was set', () => {
    expect(suggestNext([fail('h1')], 15, 'm15')).toEqual({ primary: 'm15', lowerAlternative: null });
  });
});
