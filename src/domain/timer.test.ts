import { describe, expect, it } from 'vitest';
import {
  awayMs,
  endedWhileAway,
  focusedMs,
  isPaused,
  overlapMs,
  overrunMs,
  pausedMs,
  remainingMs,
  runningMs,
  timerEndsAt,
  timerPhase,
  type TimerState,
} from './timer';

const MIN = 60_000;
const T0 = 1_700_000_000_000;

const session = (over: Partial<TimerState> = {}): TimerState => ({
  startedAt: T0,
  plannedMs: 25 * MIN,
  pauses: [],
  away: [],
  endedAt: null,
  ...over,
});

describe('overlapMs', () => {
  it('sums spans clipped to the window, merging overlaps', () => {
    const spans = [
      { start: 0, end: 10 },
      { start: 5, end: 15 },
      { start: 20, end: 25 },
      { start: 30, end: null },
    ];
    expect(overlapMs(spans, 0, 40)).toBe(15 + 5 + 10);
    expect(overlapMs(spans, 8, 22)).toBe(7 + 2);
  });
  it('is zero for an empty or inverted window', () => {
    expect(overlapMs([{ start: 0, end: 10 }], 5, 5)).toBe(0);
    expect(overlapMs([{ start: 0, end: 10 }], 10, 0)).toBe(0);
    expect(overlapMs([], 0, 100)).toBe(0);
  });
  it('ignores zero-length and out-of-window spans', () => {
    expect(
      overlapMs(
        [
          { start: 5, end: 5 },
          { start: 50, end: 60 },
        ],
        0,
        40,
      ),
    ).toBe(0);
  });
});

describe('a plain running session', () => {
  const s = session();
  it('counts down from the start timestamp', () => {
    expect(remainingMs(s, T0)).toBe(25 * MIN);
    expect(remainingMs(s, T0 + 10 * MIN)).toBe(15 * MIN);
    expect(runningMs(s, T0 + 10 * MIN)).toBe(10 * MIN);
    expect(timerPhase(s, T0 + 10 * MIN)).toBe('running');
    expect(timerEndsAt(s, T0 + 10 * MIN)).toBe(T0 + 25 * MIN);
  });
  it('finishes at zero and never goes negative', () => {
    expect(remainingMs(s, T0 + 25 * MIN)).toBe(0);
    expect(remainingMs(s, T0 + 90 * MIN)).toBe(0);
    expect(timerPhase(s, T0 + 25 * MIN)).toBe('finished');
    expect(overrunMs(s, T0 + 30 * MIN)).toBe(5 * MIN);
  });
  it('focused time is capped at the planned length', () => {
    expect(focusedMs(s, T0 + 90 * MIN)).toBe(25 * MIN);
  });
  it('a clock that reads earlier than the start counts as zero elapsed', () => {
    expect(remainingMs(s, T0 - 5 * MIN)).toBe(25 * MIN);
    expect(runningMs(s, T0 - 5 * MIN)).toBe(0);
  });
});

describe('pauses', () => {
  const paused = session({ pauses: [{ start: T0 + 5 * MIN, end: null }] });

  it('freezes the remaining time while paused', () => {
    expect(isPaused(paused)).toBe(true);
    expect(timerPhase(paused, T0 + 20 * MIN)).toBe('paused');
    expect(remainingMs(paused, T0 + 6 * MIN)).toBe(20 * MIN);
    expect(remainingMs(paused, T0 + 60 * MIN)).toBe(20 * MIN);
    expect(pausedMs(paused, T0 + 60 * MIN)).toBe(55 * MIN);
  });

  it('timerEndsAt while paused is now + remaining', () => {
    expect(timerEndsAt(paused, T0 + 60 * MIN)).toBe(T0 + 80 * MIN);
  });

  it('a closed pause pushes the end back', () => {
    const resumed = session({ pauses: [{ start: T0 + 5 * MIN, end: T0 + 15 * MIN }] });
    expect(isPaused(resumed)).toBe(false);
    expect(timerEndsAt(resumed, T0 + 20 * MIN)).toBe(T0 + 35 * MIN);
    expect(remainingMs(resumed, T0 + 20 * MIN)).toBe(15 * MIN);
    expect(pausedMs(resumed, T0 + 20 * MIN)).toBe(10 * MIN);
  });

  it('several pauses add up, overlapping ones count once', () => {
    const s = session({
      pauses: [
        { start: T0 + 1 * MIN, end: T0 + 3 * MIN },
        { start: T0 + 2 * MIN, end: T0 + 4 * MIN },
        { start: T0 + 10 * MIN, end: T0 + 11 * MIN },
      ],
    });
    expect(pausedMs(s, T0 + 20 * MIN)).toBe(4 * MIN);
    expect(remainingMs(s, T0 + 20 * MIN)).toBe(9 * MIN);
  });
});

describe('ended sessions', () => {
  it('freeze at the end time', () => {
    const s = session({ endedAt: T0 + 12 * MIN });
    expect(timerPhase(s, T0 + 60 * MIN)).toBe('ended');
    expect(focusedMs(s, T0 + 60 * MIN)).toBe(12 * MIN);
    expect(remainingMs(s, T0 + 60 * MIN)).toBe(13 * MIN);
    expect(overrunMs(s, T0 + 60 * MIN)).toBe(0);
  });
  it('an open pause on an ended session stops at the end', () => {
    const s = session({ endedAt: T0 + 12 * MIN, pauses: [{ start: T0 + 10 * MIN, end: null }] });
    expect(isPaused(s)).toBe(false);
    expect(pausedMs(s, T0 + 60 * MIN)).toBe(2 * MIN);
    expect(focusedMs(s, T0 + 60 * MIN)).toBe(10 * MIN);
  });
});

describe('time away', () => {
  it('counts away periods during the running part only', () => {
    const s = session({
      away: [
        { start: T0 + 2 * MIN, end: T0 + 4 * MIN },
        { start: T0 + 30 * MIN, end: T0 + 40 * MIN }, // after the timer ended
      ],
    });
    expect(awayMs(s, T0 + 50 * MIN)).toBe(2 * MIN);
  });
  it('does not double count away time during a pause', () => {
    const s = session({
      pauses: [{ start: T0 + 5 * MIN, end: T0 + 10 * MIN }],
      away: [{ start: T0 + 4 * MIN, end: T0 + 8 * MIN }],
    });
    expect(awayMs(s, T0 + 20 * MIN)).toBe(1 * MIN);
  });
  it('an open away period runs to now', () => {
    const s = session({ away: [{ start: T0 + 20 * MIN, end: null }] });
    expect(awayMs(s, T0 + 22 * MIN)).toBe(2 * MIN);
  });
  it('time away is not removed from focused time (never penalized)', () => {
    const s = session({ away: [{ start: T0 + 2 * MIN, end: T0 + 7 * MIN }] });
    expect(focusedMs(s, T0 + 25 * MIN)).toBe(25 * MIN);
  });
});

describe('endedWhileAway', () => {
  const s = session();
  const end = T0 + 25 * MIN;
  it('is false while still running or after ending', () => {
    expect(endedWhileAway(s, end - 1, null)).toBe(false);
    expect(endedWhileAway(session({ endedAt: end }), end + MIN, null)).toBe(false);
  });
  it('is true when the app was not seen since before the end', () => {
    expect(endedWhileAway(s, end + 10 * MIN, end - 5 * MIN)).toBe(true);
    expect(endedWhileAway(s, end + 10 * MIN, null)).toBe(true);
  });
  it('is false when the player was watching when it ended', () => {
    expect(endedWhileAway(s, end + 1000, end + 500)).toBe(false);
  });
  it('is true when an away period covered the end', () => {
    const away = session({ away: [{ start: end - MIN, end: null }] });
    expect(endedWhileAway(away, end + 5 * MIN, end + 4 * MIN)).toBe(true);
    const closed = session({ away: [{ start: end - MIN, end: end + MIN }] });
    expect(endedWhileAway(closed, end + 5 * MIN, end + 4 * MIN)).toBe(true);
    const before = session({ away: [{ start: end - 3 * MIN, end: end - MIN }] });
    expect(endedWhileAway(before, end + 5 * MIN, end + 4 * MIN)).toBe(false);
  });
});
