import { DomainError } from '../errors';
import {
  LADDER,
  availableSteps,
  getStep,
  isValidCustomMinutes,
  resolveTargetMinutes,
  stepAbove,
  stepBelow,
  stepForMinutes,
} from '../ladder';

const keysAt = (iso: string) => availableSteps(new Date(iso)).map((s) => s.key);

describe('ladder', () => {
  it('starts at 15 minutes and keeps the spec order', () => {
    expect(LADDER[0]).toEqual({ key: 'm15', targetKind: 'minutes', minutes: 15 });
    expect(LADDER.map((s) => s.key)).toEqual([
      'm15', 'm30', 'm45', 'h1', 'h1_5', 'h2', 'h3', 'noon', 'evening', 'h24',
    ]);
  });

  it('moves one step up and down, clamped at the ends', () => {
    expect(stepAbove('m30')).toBe('m45');
    expect(stepAbove('h3')).toBe('noon');
    expect(stepAbove('h24')).toBe('h24');
    expect(stepBelow('m30')).toBe('m15');
    expect(stepBelow('m15')).toBe('m15');
  });

  it('resolves fixed and until-time targets', () => {
    const start = new Date('2026-09-29T07:10:00');
    expect(resolveTargetMinutes(getStep('h1'), start)).toBe(60);
    expect(resolveTargetMinutes(getStep('noon'), start)).toBe(290);
    expect(resolveTargetMinutes(getStep('evening'), start)).toBe(770);
  });

  it('resolves noon after midnight to the same calendar date', () => {
    // 01:00 still belongs to the previous Dilato day, noon is 11 h ahead
    expect(resolveTargetMinutes(getStep('noon'), new Date('2026-09-30T01:00:00'))).toBe(660);
  });

  it('hides noon and evening when fewer than 15 minutes remain', () => {
    expect(keysAt('2026-09-29T11:45:00')).toContain('noon');
    expect(keysAt('2026-09-29T11:46:00')).not.toContain('noon');
    expect(keysAt('2026-09-29T13:00:00')).not.toContain('noon');
    expect(keysAt('2026-09-29T19:50:00')).not.toContain('evening');
    expect(keysAt('2026-09-29T19:50:00')).toContain('h24');
  });

  it('validates custom minutes: 15–1440 in steps of 5', () => {
    expect(isValidCustomMinutes(15)).toBe(true);
    expect(isValidCustomMinutes(20)).toBe(true);
    expect(isValidCustomMinutes(1440)).toBe(true);
    expect(isValidCustomMinutes(10)).toBe(false);
    expect(isValidCustomMinutes(17)).toBe(false);
    expect(isValidCustomMinutes(1445)).toBe(false);
    expect(isValidCustomMinutes(22.5)).toBe(false);
  });

  it('maps minutes to the nearest fixed step at or below', () => {
    expect(stepForMinutes(10)).toBe('m15');
    expect(stepForMinutes(50)).toBe('m45');
    expect(stepForMinutes(100)).toBe('h1_5');
    expect(stepForMinutes(500)).toBe('h3');
    expect(stepForMinutes(1440)).toBe('h24');
  });
});

describe('DomainError', () => {
  it('carries its code as message and property', () => {
    const e = new DomainError('step_unavailable');
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('step_unavailable');
    expect(e.message).toBe('step_unavailable');
  });
});
