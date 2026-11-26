import type { EpochMs } from './dates';

/**
 * Timer math from stored timestamps (plan section 3). Nothing counts down in memory:
 * every value is computed from when the session started, its pauses and `now`, so a
 * session survives closing the app and restores on another device.
 *
 * Inputs are epoch milliseconds. The data layer stores ISO strings; convert with
 * `Date.parse` at the boundary (see `src/data/timestamps.ts`).
 */

export interface TimeSpan {
  start: EpochMs;
  /** null while still open. */
  end: EpochMs | null;
}

export interface TimerState {
  startedAt: EpochMs;
  /** Planned focus (or break) length. */
  plannedMs: number;
  pauses: readonly TimeSpan[];
  /** Periods the app was hidden or unfocused. Recorded, never penalized. */
  away: readonly TimeSpan[];
  /** Set once the session is over (done, stopped, or ended after the timer ran out). */
  endedAt: EpochMs | null;
}

export type TimerPhase = 'running' | 'paused' | 'finished' | 'ended';

/** The end of the window we measure: the session end, or now while it is open. */
function windowEnd(s: TimerState, now: EpochMs): EpochMs {
  return Math.max(s.startedAt, s.endedAt ?? now);
}

/** Total length of `spans` that falls inside [from, to]. Open spans run to `to`. Overlaps count once. */
export function overlapMs(spans: readonly TimeSpan[], from: EpochMs, to: EpochMs): number {
  if (to <= from) return 0;
  const clipped = spans
    .map((s) => [Math.max(from, s.start), Math.min(to, s.end ?? to)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let curStart = -Infinity;
  let curEnd = -Infinity;
  for (const [a, b] of clipped) {
    if (a > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = a;
      curEnd = b;
    } else {
      curEnd = Math.max(curEnd, b);
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

export function isPaused(s: TimerState): boolean {
  return s.endedAt === null && s.pauses.some((p) => p.end === null);
}

/** Time spent paused so far. */
export function pausedMs(s: TimerState, now: EpochMs): number {
  return overlapMs(s.pauses, s.startedAt, windowEnd(s, now));
}

/** Time the clock has been running (not paused), uncapped. */
export function runningMs(s: TimerState, now: EpochMs): number {
  const end = windowEnd(s, now);
  return Math.max(0, end - s.startedAt - overlapMs(s.pauses, s.startedAt, end));
}

/** Time left on the timer, never below zero. */
export function remainingMs(s: TimerState, now: EpochMs): number {
  return Math.max(0, s.plannedMs - runningMs(s, now));
}

/**
 * The instant the timer reaches (or reached) zero, assuming no further pauses.
 * While paused, this is where it would end if resumed `now`.
 */
export function timerEndsAt(s: TimerState, now: EpochMs): EpochMs {
  if (isPaused(s)) return now + remainingMs(s, now);
  const paused = overlapMs(s.pauses, s.startedAt, windowEnd(s, now));
  return s.startedAt + s.plannedMs + paused;
}

/** Focused time: running time capped at the planned length. Used for the focus bonus. */
export function focusedMs(s: TimerState, now: EpochMs): number {
  return Math.min(s.plannedMs, runningMs(s, now));
}

/** Time away from the app during the running part of the session (pauses excluded). */
export function awayMs(s: TimerState, now: EpochMs): number {
  const end = Math.min(windowEnd(s, now), timerEndsAt(s, now));
  const awayTotal = overlapMs(s.away, s.startedAt, end);
  // Remove away time that happened while paused, so it is not double counted.
  const both = intersectionMs(s.away, s.pauses, s.startedAt, end);
  return Math.max(0, awayTotal - both);
}

function intersectionMs(
  a: readonly TimeSpan[],
  b: readonly TimeSpan[],
  from: EpochMs,
  to: EpochMs,
): number {
  const spans: TimeSpan[] = [];
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(x.start, y.start, from);
      const end = Math.min(x.end ?? to, y.end ?? to, to);
      if (end > start) spans.push({ start, end });
    }
  }
  return overlapMs(spans, from, to);
}

export function timerPhase(s: TimerState, now: EpochMs): TimerPhase {
  if (s.endedAt !== null) return 'ended';
  if (isPaused(s)) return 'paused';
  return remainingMs(s, now) <= 0 ? 'finished' : 'running';
}

/** How long ago the timer ran out (0 if it has not). */
export function overrunMs(s: TimerState, now: EpochMs): number {
  if (timerPhase(s, now) !== 'finished') return 0;
  return Math.max(0, now - timerEndsAt(s, now));
}

/**
 * "Your timer ended while you were away": the timer ran out and the player was not looking
 * at that moment. `lastSeenAt` is the last time the app was visible and focused (null if
 * unknown, e.g. on another device or after a reload). The player also counts as away when
 * an open away period covers the end.
 */
export function endedWhileAway(s: TimerState, now: EpochMs, lastSeenAt: EpochMs | null): boolean {
  if (timerPhase(s, now) !== 'finished') return false;
  const end = timerEndsAt(s, now);
  if (lastSeenAt === null || lastSeenAt < end) return true;
  return s.away.some((a) => a.start <= end && (a.end === null || a.end >= end));
}
