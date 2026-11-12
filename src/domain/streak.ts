import { diffDays, type LocalDate } from './dates';

/**
 * Forgiving streak (plan section 6).
 *
 * - A day counts when at least one step was finished that day ("active day").
 * - A missed day does not break the streak: the streak "rests" and resumes when the player
 *   comes back. The number shown never drops to zero once a streak has started.
 * - Up to `freeRestDays` missed days in a row are forgiven automatically. Days covered by a
 *   streak rest token (`protectedDays`) are forgiven on top of that.
 * - A longer gap starts a new run at 1 on the next active day. The best run is always kept.
 *
 * The streak is derived from the list of active days, so it never conflicts across devices.
 */

/** Missed days in a row that are forgiven without a rest token. */
export const DEFAULT_FREE_REST_DAYS = 2;

export type StreakStatus =
  /** Never had an active day. */
  | 'new'
  /** Active today. */
  | 'active'
  /** Not active today yet; the streak continues on the next active day. */
  | 'resting'
  /** The gap is longer than the rests allow; the next active day starts a new run at 1. */
  | 'faded';

export interface StreakInput {
  /** Days with at least one finished step. Order and duplicates do not matter. */
  activeDays: readonly LocalDate[];
  /** Missed days covered by streak rest tokens. */
  protectedDays?: readonly LocalDate[];
  today: LocalDate;
  freeRestDays?: number;
}

export interface StreakResult {
  /** Length of the latest run in active days. 0 only when the status is `new`. */
  current: number;
  /** Longest run ever. */
  best: number;
  status: StreakStatus;
  lastActiveDay: LocalDate | null;
  /** Missed days since the last active day, not counting protected days or today. */
  restingDays: number;
  /** Rest days still forgiven before the run fades (counts only while resting). */
  restDaysLeft: number;
}

/** Missed days strictly between `from` and `to` that are not protected. */
function unprotectedGap(
  from: LocalDate,
  to: LocalDate,
  protectedSet: ReadonlySet<LocalDate>,
): number {
  let covered = 0;
  for (const d of protectedSet) if (d > from && d < to) covered++;
  return Math.max(0, diffDays(from, to) - 1 - covered);
}

export function computeStreak(input: StreakInput): StreakResult {
  const free = Math.max(0, input.freeRestDays ?? DEFAULT_FREE_REST_DAYS);
  const protectedSet = new Set(input.protectedDays ?? []);
  const days = [...new Set(input.activeDays)].filter((d) => d <= input.today).sort();

  if (days.length === 0) {
    return {
      current: 0,
      best: 0,
      status: 'new',
      lastActiveDay: null,
      restingDays: 0,
      restDaysLeft: free,
    };
  }

  let run = 1;
  let best = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = unprotectedGap(days[i - 1]!, days[i]!, protectedSet);
    run = gap <= free ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const last = days[days.length - 1]!;
  if (last === input.today) {
    return {
      current: run,
      best,
      status: 'active',
      lastActiveDay: last,
      restingDays: 0,
      restDaysLeft: free,
    };
  }

  // Days strictly between the last active day and today were missed; today is still open.
  const resting = unprotectedGap(last, input.today, protectedSet);
  const faded = resting > free;
  return {
    current: run,
    best,
    status: faded ? 'faded' : 'resting',
    lastActiveDay: last,
    restingDays: resting,
    restDaysLeft: Math.max(0, free - resting),
  };
}

/** The value the streak will show after the player is active on `today`. */
export function streakAfterActivity(input: StreakInput): StreakResult {
  return computeStreak({ ...input, activeDays: [...input.activeDays, input.today] });
}

/** Days between the last active day and today, used to tell whether a rest token would help. */
export function missedDaysSince(lastActiveDay: LocalDate, today: LocalDate): number {
  return Math.max(0, diffDays(lastActiveDay, today) - 1);
}
