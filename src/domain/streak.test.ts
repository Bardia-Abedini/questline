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
    });
  });

  it('counts consecutive days and is active today', () => {
    const r = computeStreak({ activeDays: ['2026-03-08', '2026-03-09', '2026-03-10'], today: T });
    expect(r).toEqual({ current: 3, best: 3, status: 'active', lastActiveDay: T, restingDays: 0 });
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
    expect(r).toMatchObject({ current: 2, status: 'resting', restingDays: 0 });
  });

  it('a missed day rests the streak and it resumes on return', () => {
    const r = computeStreak({ activeDays: ['2026-03-07', '2026-03-08', '2026-03-10'], today: T });
    expect(r).toMatchObject({ current: 3, best: 3, status: 'active' });
  });

  it('never resets, whatever the gap', () => {
    const r = computeStreak({
      activeDays: ['2025-01-01', '2025-01-02', '2025-06-30', '2026-03-10'],
      today: T,
    });
    expect(r).toMatchObject({ current: 4, best: 4, status: 'active' });
  });

  it('never drops while resting, even after a long time away', () => {
    const r = computeStreak({ activeDays: ['2026-01-01', '2026-01-02'], today: T });
    expect(r).toMatchObject({ current: 2, best: 2, status: 'resting', restingDays: 66 });
  });

  it('reports resting days', () => {
    expect(computeStreak({ activeDays: ['2026-03-08'], today: T }).restingDays).toBe(1);
  });

  it('best always equals current', () => {
    for (const days of [[], ['2026-03-01'], ['2026-02-01', '2026-03-09', '2026-03-10']]) {
      const r = computeStreak({ activeDays: days, today: T });
      expect(r.best).toBe(r.current);
    }
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
    expect(streakAfterActivity({ activeDays: ['2026-03-01'], today: T }).current).toBe(2);
    expect(streakAfterActivity({ activeDays: [], today: T })).toMatchObject({
      current: 1,
      best: 1,
      status: 'active',
    });
    expect(streakAfterActivity({ activeDays: [T], today: T }).current).toBe(1);
  });
});

describe('missedDaysSince', () => {
  it('counts the days in between', () => {
    expect(missedDaysSince('2026-03-09', T)).toBe(0);
    expect(missedDaysSince('2026-03-05', T)).toBe(4);
    expect(missedDaysSince(T, T)).toBe(0);
  });
});
