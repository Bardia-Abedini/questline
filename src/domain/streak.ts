import { diffDays, type LocalDate } from './dates';

/**
 * Forgiving streak (plan section 6, owner's rule: "missing a day never resets it; it rests
 * and resumes").
 *
 * - A day counts when at least one step was finished that day ("active day").
 * - The streak is the number of active days. A missed day, or any gap of any length, only
 *   makes it "rest"; the next active day continues from the same number. It never resets
 *   and never drops.
 * - `best` therefore always equals `current`; it is kept as a field for the data contract.
 *
 * Derived from the list of active days, so it never conflicts across devices.
 */

export type StreakStatus =
  /** Never had an active day. */
  | 'new'
  /** Active today. */
  | 'active'
  /** Not active today yet; the streak waits and continues on the next active day. */
  | 'resting';

export interface StreakInput {
  /** Days with at least one finished step. Order and duplicates do not matter. */
  activeDays: readonly LocalDate[];
  today: LocalDate;
}

export interface StreakResult {
  /** Number of active days up to today. 0 only when the status is `new`. */
  current: number;
  /** Highest value ever reached (equal to `current`, since the streak never drops). */
  best: number;
  status: StreakStatus;
  lastActiveDay: LocalDate | null;
  /** Missed days between the last active day and today (today itself not counted). */
  restingDays: number;
}

export function computeStreak(input: StreakInput): StreakResult {
  const days = [...new Set(input.activeDays)].filter((d) => d <= input.today).sort();
  if (days.length === 0) {
    return { current: 0, best: 0, status: 'new', lastActiveDay: null, restingDays: 0 };
  }
  const last = days[days.length - 1]!;
  const current = days.length;
  if (last === input.today) {
    return { current, best: current, status: 'active', lastActiveDay: last, restingDays: 0 };
  }
  return {
    current,
    best: current,
    status: 'resting',
    lastActiveDay: last,
    restingDays: missedDaysSince(last, input.today),
  };
}

/** The value the streak will show after the player is active on `today`. */
export function streakAfterActivity(input: StreakInput): StreakResult {
  return computeStreak({ ...input, activeDays: [...input.activeDays, input.today] });
}

/** Whole days missed between the last active day and today (today not counted). */
export function missedDaysSince(lastActiveDay: LocalDate, today: LocalDate): number {
  return Math.max(0, diffDays(lastActiveDay, today) - 1);
}
