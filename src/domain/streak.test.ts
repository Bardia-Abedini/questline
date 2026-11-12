import { describe, expect, it } from 'vitest';
import { computeStreak, missedDaysSince, streakAfterActivity } from './streak';

const T = '2026-03-10';

describe('computeStreak', () => {
  it('is new with no active days', () => {
    expect(computeStreak({ activeDays: [], today: T })).toEqual({
      current: 0,
      best: 0,
      status: 'new',
      lastActiveDay: null,
      restingDays: 0,
      restDaysLeft: 2,
    });
  });

  it('counts consecutive days and is active today', () => {
    const r = computeStreak({ activeDays: ['2026-03-08', '2026-03-09', '2026-03-10'], today: T });
    expect(r).toMatchObject({ current: 3, best: 3, status: 'active', lastActiveDay: T });
  });

  it('ignores duplicates, order and future days', () => {
    const r = computeStreak({
      activeDays: ['2026-03-10', '2026-03-09', '2026-03-09', '2026-03-12'],
      today: T,
    });
    expect(r.current).toBe(2);
  });

  it('rests (does not break) when today has no activity yet', () => {
    const r = computeStreak({ activeDays: ['2026-03-08', '2026-03-09'], today: T });
    expect(r).toMatchObject({ current: 2, status: 'resting', restingDays: 0, restDaysLeft: 2 });
  });

  it('a missed day rests the streak and it resumes on return', () => {
    const r = computeStreak({ activeDays: ['2026-03-07', '2026-03-08', '2026-03-10'], today: T });
    expect(r).toMatchObject({ current: 3, best: 3, status: 'active' });
  });

  it('forgives up to two missed days in a row by default', () => {
    expect(
      computeStreak({ activeDays: ['2026-03-06', '2026-03-07', '2026-03-10'], today: T }).current,
    ).toBe(3);
    expect(
      computeStreak({ activeDays: ['2026-03-05', '2026-03-06', '2026-03-10'], today: T }).current,
    ).toBe(1);
  });

  it('never shows zero once started, even after a long gap', () => {
    const r = computeStreak({ activeDays: ['2026-01-01', '2026-01-02'], today: T });
    expect(r).toMatchObject({ current: 2, status: 'faded', restDaysLeft: 0 });
    expect(r.current).toBeGreaterThan(0);
  });

  it('starts a new run at 1 after a faded gap and keeps the best', () => {
    const r = computeStreak({
      activeDays: ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-03-10'],
      today: T,
    });
    expect(r).toMatchObject({ current: 1, best: 4, status: 'active' });
  });

  it('reports resting days and rest days left', () => {
    const r = computeStreak({ activeDays: ['2026-03-08'], today: T });
    expect(r).toMatchObject({ status: 'resting', restingDays: 1, restDaysLeft: 1 });
  });

  it('rest tokens cover missed days on top of the free rests', () => {
    const active = ['2026-03-01', '2026-03-02', '2026-03-10'];
    expect(computeStreak({ activeDays: active, today: T }).current).toBe(1);
    const covered = computeStreak({
      activeDays: active,
      today: T,
      protectedDays: ['2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07'],
    });
    expect(covered.current).toBe(3);
  });

  it('protected days outside a gap change nothing', () => {
    const r = computeStreak({
      activeDays: ['2026-03-09', '2026-03-10'],
      today: T,
      protectedDays: ['2026-02-01'],
    });
    expect(r.current).toBe(2);
  });

  it('supports a custom allowance, including zero', () => {
    const days = ['2026-03-08', '2026-03-10'];
    expect(computeStreak({ activeDays: days, today: T, freeRestDays: 0 }).current).toBe(1);
    expect(computeStreak({ activeDays: days, today: T, freeRestDays: 5 }).current).toBe(2);
    expect(computeStreak({ activeDays: ['2026-03-08'], today: T, freeRestDays: 0 }).status).toBe(
      'faded',
    );
  });

  it('works across month and year boundaries', () => {
    const r = computeStreak({
      activeDays: ['2025-12-30', '2025-12-31', '2026-01-01'],
      today: '2026-01-01',
    });
    expect(r.current).toBe(3);
  });
});

describe('streakAfterActivity', () => {
  it('shows what the streak becomes after acting today', () => {
    expect(streakAfterActivity({ activeDays: ['2026-03-09'], today: T }).current).toBe(2);
    expect(streakAfterActivity({ activeDays: [], today: T })).toMatchObject({
      current: 1,
      best: 1,
      status: 'active',
    });
  });
});

describe('missedDaysSince', () => {
  it('counts the days in between', () => {
    expect(missedDaysSince('2026-03-09', T)).toBe(0);
    expect(missedDaysSince('2026-03-05', T)).toBe(4);
    expect(missedDaysSince(T, T)).toBe(0);
  });
});
