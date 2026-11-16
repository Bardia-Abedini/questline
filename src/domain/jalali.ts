import type { LocalDate } from './dates';

/**
 * Jalali (Persian solar) calendar conversion, for the Persian date picker. Arithmetic
 * algorithm by Borkowski as used by the widely used jalaali-js library; valid for Jalali
 * years -61 to 3177. Dates are stored as Gregorian `LocalDate`s everywhere; only the
 * picker works in Jalali.
 */

export interface JalaliDate {
  jy: number;
  /** 1..12 (1 = Farvardin). */
  jm: number;
  jd: number;
}

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
];

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0]!;
  let jump = 0;
  if (jy < jp || jy >= BREAKS[BREAKS.length - 1]!) throw new RangeError(`Jalali year ${jy}`);
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): JalaliDate {
  const { gy } = d2g(jdn);
  let jy = gy - 621;
  const r = jalCal(jy);
  const start = g2d(gy, 3, r.march);
  let k = jdn - start;
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function isJalaliLeapYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

export function localDateToJalali(day: LocalDate): JalaliDate {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return d2j(g2d(y, m, d));
}

export function jalaliToLocalDate({ jy, jm, jd }: JalaliDate): LocalDate {
  const { gy, gm, gd } = d2g(j2d(jy, jm, jd));
  return `${pad(gy, 4)}-${pad(gm)}-${pad(gd)}`;
}

/** Moves a Jalali month by `delta` months (day clamped to the new month's length). */
export function addJalaliMonths(date: JalaliDate, delta: number): JalaliDate {
  const index = date.jy * 12 + (date.jm - 1) + delta;
  const jy = Math.floor(index / 12);
  const jm = (((index % 12) + 12) % 12) + 1;
  return { jy, jm, jd: Math.min(date.jd, jalaliMonthLength(jy, jm)) };
}
