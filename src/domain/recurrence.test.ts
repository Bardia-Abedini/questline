import { describe, expect, it } from 'vitest';
import {
  isOccurrenceMissed,
  isValidPattern,
  nextOccurrenceOnOrAfter,
  occursOn,
  planNextOccurrence,
  type RecurrencePattern,
} from './recurrence';

// 2026-03-02 is a Monday.
const MON = '2026-03-02';

describe('occursOn', () => {
  it('daily: every day from the anchor', () => {
    const p: RecurrencePattern = { kind: 'daily', anchorDate: MON };
    expect(occursOn(p, '2026-03-01')).toBe(false);
    expect(occursOn(p, MON)).toBe(true);
    expect(occursOn(p, '2026-04-17')).toBe(true);
  });
  it('weekly: same weekday as the anchor', () => {
    const p: RecurrencePattern = { kind: 'weekly', anchorDate: MON };
    expect(occursOn(p, '2026-03-09')).toBe(true);
    expect(occursOn(p, '2026-03-10')).toBe(false);
  });
  it('weekly with interval 2: every other week', () => {
    const p: RecurrencePattern = { kind: 'weekly', anchorDate: MON, interval: 2 };
    expect(occursOn(p, '2026-03-09')).toBe(false);
    expect(occursOn(p, '2026-03-16')).toBe(true);
  });
  it('weekdays: chosen days only', () => {
    const p: RecurrencePattern = { kind: 'weekdays', anchorDate: MON, weekdays: [1, 3, 5] };
    expect(
      ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-06', '2026-03-07'].map((d) =>
        occursOn(p, d),
      ),
    ).toEqual([true, false, true, true, false]);
  });
  it('every N days from the anchor', () => {
    const p: RecurrencePattern = { kind: 'every_n_days', anchorDate: MON, interval: 3 };
    expect(occursOn(p, '2026-03-05')).toBe(true);
    expect(occursOn(p, '2026-03-06')).toBe(false);
    expect(occursOn(p, '2026-03-08')).toBe(true);
  });
  it('respects the end date', () => {
    const p: RecurrencePattern = { kind: 'daily', anchorDate: MON, endDate: '2026-03-04' };
    expect(occursOn(p, '2026-03-04')).toBe(true);
    expect(occursOn(p, '2026-03-05')).toBe(false);
  });
});

describe('isValidPattern', () => {
  it('rejects weekdays with no valid day and end before anchor', () => {
    expect(isValidPattern({ kind: 'weekdays', anchorDate: MON, weekdays: [] })).toBe(false);
    expect(isValidPattern({ kind: 'weekdays', anchorDate: MON, weekdays: [9] })).toBe(false);
    expect(isValidPattern({ kind: 'daily', anchorDate: MON, endDate: '2026-03-01' })).toBe(false);
    expect(isValidPattern({ kind: 'daily', anchorDate: MON })).toBe(true);
  });
});

describe('nextOccurrenceOnOrAfter', () => {
  it('starts no earlier than the anchor', () => {
    expect(nextOccurrenceOnOrAfter({ kind: 'daily', anchorDate: MON }, '2026-02-01')).toBe(MON);
  });
  it('finds the next chosen weekday, wrapping the week', () => {
    const p: RecurrencePattern = { kind: 'weekdays', anchorDate: MON, weekdays: [1] };
    expect(nextOccurrenceOnOrAfter(p, '2026-03-03')).toBe('2026-03-09');
  });
  it('returns null when the series has ended or is invalid', () => {
    expect(
      nextOccurrenceOnOrAfter(
        { kind: 'daily', anchorDate: MON, endDate: '2026-03-03' },
        '2026-03-04',
      ),
    ).toBeNull();
    expect(
      nextOccurrenceOnOrAfter({ kind: 'weekdays', anchorDate: MON, weekdays: [] }, MON),
    ).toBeNull();
  });
  it('treats an interval below 1 as 1', () => {
    expect(
      nextOccurrenceOnOrAfter({ kind: 'every_n_days', anchorDate: MON, interval: 0 }, '2026-03-05'),
    ).toBe('2026-03-05');
  });
  it('handles large intervals', () => {
    const p: RecurrencePattern = { kind: 'every_n_days', anchorDate: MON, interval: 30 };
    expect(nextOccurrenceOnOrAfter(p, '2026-03-03')).toBe('2026-04-01');
  });
});

describe('planNextOccurrence', () => {
  const daily: RecurrencePattern = { kind: 'daily', anchorDate: MON };

  it('finished on its day: the next one is tomorrow', () => {
    expect(planNextOccurrence(daily, '2026-03-05', '2026-03-05')).toBe('2026-03-06');
  });

  it('finished early: the occurrence after it', () => {
    const weekly: RecurrencePattern = { kind: 'weekly', anchorDate: MON };
    expect(planNextOccurrence(weekly, '2026-03-09', '2026-03-06')).toBe('2026-03-16');
  });

  it('missed occurrences never pile up: skips straight to today', () => {
    expect(planNextOccurrence(daily, '2026-03-02', '2026-03-10')).toBe('2026-03-10');
  });

  it('missed weekday occurrences jump to the next chosen day from today', () => {
    const p: RecurrencePattern = { kind: 'weekdays', anchorDate: MON, weekdays: [1, 4] };
    // Missed Mon 2 and Thu 5; today is Sat 7 -> next is Mon 9.
    expect(planNextOccurrence(p, MON, '2026-03-07')).toBe('2026-03-09');
  });

  it('every N days keeps its rhythm after a gap', () => {
    const p: RecurrencePattern = { kind: 'every_n_days', anchorDate: MON, interval: 4 };
    // Occurrences: 2, 6, 10, 14 ... Missed the 2nd; today is the 7th -> 10th.
    expect(planNextOccurrence(p, MON, '2026-03-07')).toBe('2026-03-10');
  });

  it('returns null past the end date', () => {
    expect(
      planNextOccurrence({ ...daily, endDate: '2026-03-05' }, '2026-03-05', '2026-03-05'),
    ).toBeNull();
  });

  it('crosses month and year ends', () => {
    expect(
      planNextOccurrence({ kind: 'daily', anchorDate: '2025-12-01' }, '2025-12-31', '2025-12-31'),
    ).toBe('2026-01-01');
  });
});

describe('isOccurrenceMissed', () => {
  it('is missed only once its day has passed', () => {
    expect(isOccurrenceMissed('2026-03-09', '2026-03-10')).toBe(true);
    expect(isOccurrenceMissed('2026-03-10', '2026-03-10')).toBe(false);
    expect(isOccurrenceMissed('2026-03-11', '2026-03-10')).toBe(false);
  });
});
