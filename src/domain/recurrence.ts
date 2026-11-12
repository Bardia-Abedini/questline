import { addDays, dayOfWeek, diffDays, maxLocalDate, type LocalDate } from './dates';

/**
 * Recurring quests (plan section 1). One open occurrence exists at a time. The next one is
 * planned when the current one is finished or its day passes, and it is always today or
 * later, so missed occurrences never pile up.
 */

export type RecurrenceKind = 'daily' | 'weekly' | 'weekdays' | 'every_n_days';

export interface RecurrencePattern {
  kind: RecurrenceKind;
  /** First day of the series. `weekly` repeats on this day's weekday; `every_n_days` counts from it. */
  anchorDate: LocalDate;
  /** For `every_n_days`: N (>= 1). For `weekly`: every N weeks (default 1). Ignored otherwise. */
  interval?: number;
  /** For `weekdays`: chosen days, 0 = Sunday ... 6 = Saturday. */
  weekdays?: readonly number[];
  /** Optional last day of the series (inclusive). */
  endDate?: LocalDate | null;
}

function intervalOf(p: RecurrencePattern): number {
  return Math.max(1, Math.floor(p.interval ?? 1));
}

/** Whether the pattern has an occurrence on `day`. */
export function occursOn(p: RecurrencePattern, day: LocalDate): boolean {
  if (day < p.anchorDate) return false;
  if (p.endDate && day > p.endDate) return false;
  switch (p.kind) {
    case 'daily':
      return true;
    case 'weekly':
      return diffDays(p.anchorDate, day) % (7 * intervalOf(p)) === 0;
    case 'weekdays': {
      const set = new Set(p.weekdays ?? []);
      return set.has(dayOfWeek(day));
    }
    case 'every_n_days':
      return diffDays(p.anchorDate, day) % intervalOf(p) === 0;
  }
}

/** True when the pattern can produce at least one occurrence at all. */
export function isValidPattern(p: RecurrencePattern): boolean {
  if (p.kind === 'weekdays') {
    const days = p.weekdays ?? [];
    if (!days.some((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return false;
  }
  if (p.endDate && p.endDate < p.anchorDate) return false;
  return true;
}

/** The first occurrence on or after `from`, or null when the series has ended. */
export function nextOccurrenceOnOrAfter(p: RecurrencePattern, from: LocalDate): LocalDate | null {
  if (!isValidPattern(p)) return null;
  let day = maxLocalDate(from, p.anchorDate);
  // Any pattern repeats within 7 x interval days, so this bound is always enough.
  const limit = 7 * intervalOf(p) + 7;
  for (let i = 0; i <= limit; i++) {
    if (p.endDate && day > p.endDate) return null;
    if (occursOn(p, day)) return day;
    day = addDays(day, 1);
  }
  return null;
}

/**
 * The date of the next occurrence once the current one is finished or its day has passed:
 * the first occurrence strictly after `currentOccurrence` and not before `today`.
 * Finishing early (before the occurrence day) moves to the occurrence after it;
 * coming back after several missed days skips straight to today or later.
 */
export function planNextOccurrence(
  p: RecurrencePattern,
  currentOccurrence: LocalDate,
  today: LocalDate,
): LocalDate | null {
  return nextOccurrenceOnOrAfter(p, maxLocalDate(addDays(currentOccurrence, 1), today));
}

/** An open occurrence whose day is before today has been missed and should be moved forward. */
export function isOccurrenceMissed(occurrence: LocalDate, today: LocalDate): boolean {
  return occurrence < today;
}
