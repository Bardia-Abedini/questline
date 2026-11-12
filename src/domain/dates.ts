/**
 * Calendar-day helpers.
 *
 * A `LocalDate` is a calendar day in the user's own time zone written as `YYYY-MM-DD`.
 * Day arithmetic works on the string itself (through UTC), so it never drifts across
 * daylight-saving changes. Only `toLocalDate` and `localDateTimeToMs` look at the
 * time zone, and they use the runtime's zone (the user's device).
 */

/** A calendar day, `YYYY-MM-DD`, in the user's time zone. */
export type LocalDate = string;

/** Milliseconds since the Unix epoch. Every domain function takes "now" as one of these. */
export type EpochMs = number;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function parse(day: LocalDate): number {
  const m = LOCAL_DATE_RE.exec(day);
  if (!m) throw new RangeError(`Not a LocalDate: ${day}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function format(utcMs: number): LocalDate {
  const d = new Date(utcMs);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The calendar day an instant falls on, in the device's time zone. */
export function toLocalDate(ms: EpochMs): LocalDate {
  const d = new Date(ms);
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The instant of a local wall-clock time on a day, in the device's time zone.
 * `time` is `HH:mm`; without it the start of the day is used.
 */
export function localDateTimeToMs(day: LocalDate, time?: string | null): EpochMs {
  const utc = new Date(parse(day));
  let hours = 0;
  let minutes = 0;
  if (time) {
    const m = /^(\d{2}):(\d{2})$/.exec(time);
    if (!m) throw new RangeError(`Not a HH:mm time: ${time}`);
    hours = Number(m[1]);
    minutes = Number(m[2]);
  }
  return new Date(
    utc.getUTCFullYear(),
    utc.getUTCMonth(),
    utc.getUTCDate(),
    hours,
    minutes,
    0,
    0,
  ).getTime();
}

/** The first instant of the following day (exclusive end of `day`), local time. */
export function endOfLocalDateMs(day: LocalDate): EpochMs {
  return localDateTimeToMs(addDays(day, 1));
}

export function addDays(day: LocalDate, days: number): LocalDate {
  return format(parse(day) + days * DAY_MS);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((parse(b) - parse(a)) / DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(day: LocalDate): number {
  return new Date(parse(day)).getUTCDay();
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxLocalDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

/** The first day of the week containing `day`. `weekStartsOn`: 0 = Sunday, 1 = Monday, 6 = Saturday. */
export function startOfWeek(day: LocalDate, weekStartsOn: number): LocalDate {
  const offset = (dayOfWeek(day) - weekStartsOn + 7) % 7;
  return addDays(day, -offset);
}
