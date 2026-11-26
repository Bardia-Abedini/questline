/** Conversions between stored ISO strings and the epoch-ms numbers the domain engine uses. */
import type { TimeSpan, TimerState } from '@/domain/timer';
import type { FocusSession, IsoDateTime, TimeSpanRow } from './types';

export function toMs(iso: IsoDateTime): number;
export function toMs(iso: IsoDateTime | null): number | null;
export function toMs(iso: IsoDateTime | null): number | null {
  if (iso === null) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new RangeError(`Not an ISO timestamp: ${iso}`);
  return t;
}

export function toIso(ms: number): IsoDateTime {
  return new Date(ms).toISOString();
}

export function spanToMs(span: TimeSpanRow): TimeSpan {
  return { start: toMs(span.start), end: toMs(span.end) };
}

/** A stored focus session as the input of the timer math in src/domain/timer.ts. */
export function sessionToTimerState(
  s: Pick<FocusSession, 'started_at' | 'planned_ms' | 'pauses' | 'away' | 'ended_at'>,
): TimerState {
  return {
    startedAt: toMs(s.started_at),
    plannedMs: s.planned_ms,
    pauses: s.pauses.map(spanToMs),
    away: s.away.map(spanToMs),
    endedAt: toMs(s.ended_at),
  };
}
