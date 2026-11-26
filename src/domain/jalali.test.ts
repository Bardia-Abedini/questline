import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import {
  addJalaliMonths,
  isJalaliLeapYear,
  jalaliMonthLength,
  jalaliToLocalDate,
  localDateToJalali,
} from './jalali';

/** Reference: the browser's own Persian calendar. */
function intlJalali(day: string) {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(Date.UTC(y, m - 1, d)));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value.replace(/\D/g, ''));
  return { jy: n('year'), jm: n('month'), jd: n('day') };
}

describe('jalali', () => {
  it('matches known dates', () => {
    expect(localDateToJalali('2026-03-21')).toEqual({ jy: 1405, jm: 1, jd: 1 });
    expect(localDateToJalali('2026-11-15')).toEqual({ jy: 1405, jm: 8, jd: 24 });
    expect(jalaliToLocalDate({ jy: 1403, jm: 12, jd: 30 })).toBe('2025-03-20');
  });

  it('agrees with the platform calendar every day for six years, both ways', () => {
    for (let day = '2022-01-01'; day < '2028-01-01'; day = addDays(day, 1)) {
      const j = localDateToJalali(day);
      expect(j, day).toEqual(intlJalali(day));
      expect(jalaliToLocalDate(j)).toBe(day);
    }
  });

  it('knows month lengths and leap years', () => {
    expect(isJalaliLeapYear(1403)).toBe(true);
    expect(isJalaliLeapYear(1404)).toBe(false);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    expect(jalaliMonthLength(1404, 1)).toBe(31);
    expect(jalaliMonthLength(1404, 7)).toBe(30);
  });

  it('moves by months and clamps the day', () => {
    expect(addJalaliMonths({ jy: 1404, jm: 6, jd: 31 }, 1)).toEqual({ jy: 1404, jm: 7, jd: 30 });
    expect(addJalaliMonths({ jy: 1404, jm: 12, jd: 5 }, 1)).toEqual({ jy: 1405, jm: 1, jd: 5 });
    expect(addJalaliMonths({ jy: 1405, jm: 1, jd: 5 }, -1)).toEqual({ jy: 1404, jm: 12, jd: 5 });
  });
});
