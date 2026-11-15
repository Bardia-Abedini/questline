/**
 * Number, date and duration formatting for the current language. Persian gets Persian
 * digits and the Jalali (Persian) calendar through Intl. Always format user-visible
 * numbers and dates with these helpers (or `useFormat()`), never with toString().
 */
import { localDateTimeToMs, type LocalDate } from '@/domain/dates';
import { INTL_LOCALE, type Language } from './config';

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();

function numberFormat(lang: Language, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `n|${lang}|${JSON.stringify(options)}`;
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(INTL_LOCALE[lang], options);
    cache.set(key, f);
  }
  return f;
}

function dateFormat(lang: Language, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d|${lang}|${JSON.stringify(options)}`;
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = new Intl.DateTimeFormat(INTL_LOCALE[lang], options);
    cache.set(key, f);
  }
  return f;
}

/** 1234 -> "1,234" / "۱٬۲۳۴". */
export function formatNumber(
  value: number,
  lang: Language,
  options?: Intl.NumberFormatOptions,
): string {
  return numberFormat(lang, options).format(value);
}

/** Compact: 12500 -> "12.5K" / "۱۲٫۵ هزار". */
export function formatCompact(value: number, lang: Language): string {
  return numberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** 0.42 -> "42%" / "۴۲٪". */
export function formatPercent(ratio: number, lang: Language): string {
  return numberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(ratio);
}

/** Converts Latin digits in a string to the language's digits (for pre-built strings like "12:05"). */
export function localizeDigits(text: string, lang: Language): string {
  if (lang !== 'fa') return text;
  return text.replace(/[0-9]/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
}

export type DateInput = Date | number | LocalDate;

function toDate(input: DateInput): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  return new Date(localDateTimeToMs(input));
}

export type DateStyle =
  | 'short'
  | 'medium'
  | 'long'
  | 'weekday'
  | 'weekdayShort'
  | 'dayMonth'
  | 'dayShort'
  | 'monthYear';

const DATE_STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { year: 'numeric', month: 'numeric', day: 'numeric' },
  medium: { year: 'numeric', month: 'short', day: 'numeric' },
  long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  weekday: { weekday: 'long' },
  weekdayShort: { weekday: 'short' },
  dayMonth: { month: 'long', day: 'numeric' },
  dayShort: { month: 'short', day: 'numeric' },
  monthYear: { month: 'long', year: 'numeric' },
};

/** A calendar date. In Persian this is a Jalali date, e.g. "۲۱ آبان ۱۴۰۵". */
export function formatDate(input: DateInput, lang: Language, style: DateStyle = 'medium'): string {
  const date = toDate(input);
  if (lang === 'fa' && (style === 'long' || style === 'monthYear')) {
    // ICU orders these patterns oddly for the Persian calendar ("۱۴۰۵ آبان ۲۱, پنجشنبه");
    // build the natural Persian order instead: "پنجشنبه ۲۱ آبان ۱۴۰۵".
    const parts = dateFormat(lang, DATE_STYLES[style]).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    return style === 'long'
      ? `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}`
      : `${get('month')} ${get('year')}`;
  }
  return dateFormat(lang, DATE_STYLES[style]).format(date);
}

/** Clock time, e.g. "9:05 AM" / "۹:۰۵". */
export function formatTime(input: Date | number, lang: Language): string {
  return dateFormat(lang, { hour: 'numeric', minute: '2-digit' }).format(toDate(input));
}

/** Jalali year/month/day numbers for a date (Persian calendar), e.g. for a date picker. */
export function toJalali(input: DateInput): { year: number; month: number; day: number } {
  const parts = dateFormat('fa', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(toDate(input));
  const num = (type: string) => {
    const raw = parts.find((p) => p.type === type)?.value ?? '0';
    return Number(raw.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)));
  };
  return { year: num('year'), month: num('month'), day: num('day') };
}

/** "today" / "tomorrow" / "in 3 days" / "2 days ago", in the language. */
export function formatRelativeDays(days: number, lang: Language): string {
  const key = `r|${lang}`;
  let f = cache.get(key) as Intl.RelativeTimeFormat | undefined;
  if (!f) {
    f = new Intl.RelativeTimeFormat(INTL_LOCALE[lang].split('-u-')[0], { numeric: 'auto' });
    cache.set(key, f);
  }
  return f.format(days, 'day');
}

/**
 * Timer display: "25:00", "1:05:09". Uses the language's digits. Seconds are rounded up,
 * so a timer shows 0:00 only when it has really ended.
 */
export function formatTimer(ms: number, lang: Language): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const text =
    h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
  return localizeDigits(text, lang);
}

/** Durations for people: "45 min", "1 h 30 min" / "۴۵ دقیقه". */
export function formatDuration(ms: number, lang: Language): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const unit = (value: number, u: 'hour' | 'minute') =>
    numberFormat(lang, { style: 'unit', unit: u, unitDisplay: 'short' }).format(value);
  if (h === 0) return unit(m, 'minute');
  if (m === 0) return unit(h, 'hour');
  return `${unit(h, 'hour')} ${unit(m, 'minute')}`;
}
