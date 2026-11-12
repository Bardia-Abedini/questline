import { describe, expect, it } from 'vitest';
import { detectLanguage, LANGUAGE_DIR, NAMESPACES } from './config';
import {
  formatDate,
  formatDuration,
  formatNumber,
  formatTimer,
  localizeDigits,
  toJalali,
} from './format';
import { resources } from './resources';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('translations', () => {
  it.each(NAMESPACES)('Persian has exactly the English keys in "%s"', (ns) => {
    expect(keys(resources.fa[ns]).sort()).toEqual(keys(resources.en[ns]).sort());
  });

  it.each(NAMESPACES)('no empty strings in "%s"', (ns) => {
    for (const lang of ['en', 'fa'] as const) {
      const flat = keys(resources[lang][ns]);
      for (const k of flat) {
        const value = k
          .split('.')
          .reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], resources[lang][ns]);
        expect(typeof value === 'string' && value.trim().length > 0, `${lang}:${ns}.${k}`).toBe(
          true,
        );
      }
    }
  });
});

describe('language config', () => {
  it('maps directions', () => {
    expect(LANGUAGE_DIR).toEqual({ en: 'ltr', fa: 'rtl' });
  });
  it('detects from the browser', () => {
    expect(detectLanguage({ languages: ['fa-IR', 'en'], language: 'fa-IR' })).toBe('fa');
    expect(detectLanguage({ languages: ['de-DE'], language: 'de-DE' })).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
  });
});

describe('formatting', () => {
  it('numbers use Persian digits in Persian', () => {
    expect(formatNumber(1234, 'en')).toBe('1,234');
    expect(formatNumber(1234, 'fa')).toBe('۱٬۲۳۴');
    expect(localizeDigits('12:05', 'fa')).toBe('۱۲:۰۵');
    expect(localizeDigits('12:05', 'en')).toBe('12:05');
  });

  it('dates use the Jalali calendar in Persian', () => {
    // 2026-03-21 is Nowruz: 1 Farvardin 1405.
    expect(toJalali('2026-03-21')).toEqual({ year: 1405, month: 1, day: 1 });
    expect(toJalali('2026-11-12')).toEqual({ year: 1405, month: 8, day: 21 });
    expect(formatDate('2026-03-21', 'fa', 'dayMonth')).toContain('فروردین');
    expect(formatDate('2026-03-21', 'en', 'medium')).toBe('Mar 21, 2026');
    expect(formatDate('2026-11-12', 'fa', 'long')).toBe('پنجشنبه ۲۱ آبان ۱۴۰۵');
    expect(formatDate('2026-11-12', 'fa', 'monthYear')).toBe('آبان ۱۴۰۵');
  });

  it('timer and durations', () => {
    expect(formatTimer(25 * 60_000, 'en')).toBe('25:00');
    expect(formatTimer(59_001, 'en')).toBe('1:00');
    expect(formatTimer(3_725_000, 'en')).toBe('1:02:05');
    expect(formatTimer(-5, 'en')).toBe('0:00');
    expect(formatTimer(25 * 60_000, 'fa')).toBe('۲۵:۰۰');
    expect(formatDuration(45 * 60_000, 'en')).toBe('45 min');
    expect(formatDuration(90 * 60_000, 'en')).toBe('1 hr 30 min');
    expect(formatDuration(45 * 60_000, 'fa')).toContain('۴۵');
  });
});
