import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareLocalDates,
  dayOfWeek,
  diffDays,
  endOfLocalDateMs,
  isLocalDate,
  localDateTimeToMs,
  maxLocalDate,
  startOfWeek,
  toLocalDate,
} from './dates';

// Tests run with TZ=UTC (see vite.config.ts), so local time equals UTC here.

describe('LocalDate helpers', () => {
  it('validates format and real calendar days', () => {
    expect(isLocalDate('2026-03-10')).toBe(true);
    expect(isLocalDate('2024-02-29')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-3-10')).toBe(false);
    expect(isLocalDate(20260310)).toBe(false);
  });

  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-10', 0)).toBe('2026-03-10');
  });

  it('diffs days', () => {
    expect(diffDays('2026-03-01', '2026-03-10')).toBe(9);
    expect(diffDays('2026-03-10', '2026-03-01')).toBe(-9);
    expect(diffDays('2025-12-31', '2026-01-01')).toBe(1);
  });

  it('knows weekdays (0 = Sunday)', () => {
    expect(dayOfWeek('2026-03-08')).toBe(0);
    expect(dayOfWeek('2026-03-14')).toBe(6);
  });

  it('finds the start of the week for Sunday, Monday and Saturday weeks', () => {
    expect(startOfWeek('2026-03-11', 0)).toBe('2026-03-08');
    expect(startOfWeek('2026-03-11', 1)).toBe('2026-03-09');
    expect(startOfWeek('2026-03-11', 6)).toBe('2026-03-07');
    expect(startOfWeek('2026-03-07', 6)).toBe('2026-03-07');
  });

  it('converts between instants and local days', () => {
    expect(toLocalDate(Date.parse('2026-03-10T23:59:59.000Z'))).toBe('2026-03-10');
    expect(localDateTimeToMs('2026-03-10')).toBe(Date.parse('2026-03-10T00:00:00.000Z'));
    expect(localDateTimeToMs('2026-03-10', '14:30')).toBe(Date.parse('2026-03-10T14:30:00.000Z'));
    expect(endOfLocalDateMs('2026-03-10')).toBe(Date.parse('2026-03-11T00:00:00.000Z'));
  });

  it('rejects bad input', () => {
    expect(() => addDays('nope', 1)).toThrow(RangeError);
    expect(() => localDateTimeToMs('2026-03-10', '2pm')).toThrow(RangeError);
  });

  it('compares and picks the later day', () => {
    expect(compareLocalDates('2026-03-01', '2026-03-02')).toBe(-1);
    expect(compareLocalDates('2026-03-02', '2026-03-02')).toBe(0);
    expect(compareLocalDates('2026-03-03', '2026-03-02')).toBe(1);
    expect(maxLocalDate('2026-03-01', '2026-02-28')).toBe('2026-03-01');
  });
});
