/**
 * The one place the app reads the wall clock. Domain functions take time as a parameter;
 * services and repositories call `clock.now()` so tests can freeze time with `setClock`.
 */
import { toLocalDate, type LocalDate } from '@/domain/dates';
import type { IsoDateTime } from './types';

type NowFn = () => number;

let nowFn: NowFn = () => Date.now();

export const clock = {
  /** Epoch milliseconds. */
  now(): number {
    return nowFn();
  },
  /** Current instant as an ISO string, the format stored in every timestamp column. */
  iso(): IsoDateTime {
    return new Date(nowFn()).toISOString();
  },
  /** Today's calendar day in the device's time zone. */
  today(): LocalDate {
    return toLocalDate(nowFn());
  },
};

/** Tests only: freeze or move time. Pass `null` to return to the real clock. */
export function setClock(fn: NowFn | number | null): void {
  if (fn === null) nowFn = () => Date.now();
  else if (typeof fn === 'number') nowFn = () => fn;
  else nowFn = fn;
}
