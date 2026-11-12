import { describe, expect, it } from 'vitest';
import type { TimerState } from '@/domain/timer';
import {
  AWAITING_TTL_MS,
  closeAway,
  continueMinutes,
  decideArrival,
  endingPatch,
  groupByDay,
  idleCheckinDue,
  isFirstStep,
  liveAwaiting,
  minuteMarkCrossed,
  naturalEndAt,
  nextOpenStep,
  nudgeDue,
  openAway,
  openAwayStart,
  questGuessAndActual,
  restoreTarget,
  selectablePreset,
  timerEndReason,
  viewFor,
} from './machine';

const MIN = 60_000;
const T0 = Date.parse('2026-03-10T09:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

const state = (over: Partial<TimerState> = {}): TimerState => ({
  startedAt: T0,
  plannedMs: 25 * MIN,
  pauses: [],
  away: [],
  endedAt: null,
  ...over,
});

const session = (over: Record<string, unknown> = {}) => ({
  kind: 'focus' as const,
  ended_at: null as string | null,
  end_reason: null as never,
  deleted_at: null as string | null,
  ...over,
});

describe('viewFor (session state machine)', () => {
  it('missing or deleted sessions lead nowhere', () => {
    expect(viewFor(null, null, null)).toEqual({ kind: 'missing' });
    expect(viewFor(session({ deleted_at: iso(T0) }), null, null)).toEqual({ kind: 'missing' });
  });
  it('open sessions show the running timer or the break', () => {
    expect(viewFor(session(), { done_at: null }, null)).toEqual({ kind: 'timer' });
    expect(viewFor(session({ kind: 'break' }), null, null)).toEqual({ kind: 'break' });
  });
  it('an ended break offers to go back', () => {
    expect(
      viewFor(session({ kind: 'break', ended_at: iso(T0), end_reason: 'timer_done' }), null, null),
    ).toEqual({ kind: 'break_over' });
  });
  it('a timer that ran out offers the choices, noting when it ended while away', () => {
    const s = session({ ended_at: iso(T0), end_reason: 'timer_done' });
    expect(viewFor(s, { done_at: null }, null)).toEqual({ kind: 'time_up', whileAway: false });
    const away = session({ ended_at: iso(T0), end_reason: 'ended_while_away' });
    expect(viewFor(away, { done_at: null }, null)).toEqual({ kind: 'time_up', whileAway: true });
  });
  it('a done step shows the summary, and the finish screen when the quest is done', () => {
    const s = session({ ended_at: iso(T0), end_reason: 'step_done' });
    expect(viewFor(s, { done_at: iso(T0) }, { status: 'active' })).toEqual({
      kind: 'step_done',
      questDone: false,
    });
    expect(viewFor(s, { done_at: iso(T0) }, { status: 'done' })).toEqual({
      kind: 'step_done',
      questDone: true,
    });
    // Done after the timer ran out counts too.
    const t = session({ ended_at: iso(T0), end_reason: 'timer_done' });
    expect(viewFor(t, { done_at: iso(T0) }, { status: 'active' }).kind).toBe('step_done');
  });
  it('stopped and abandoned sessions show the calm "saved" screen', () => {
    for (const end_reason of ['stopped', 'abandoned']) {
      expect(viewFor(session({ ended_at: iso(T0), end_reason }), { done_at: null }, null)).toEqual({
        kind: 'stopped',
      });
    }
  });
});

describe('arriving and restoring', () => {
  const step = { id: 's1', done_at: null, deleted_at: null };
  const base = { minutes: null, awaiting: null, now: T0 };

  it('a step link with nothing open starts a session (no extra tap)', () => {
    expect(decideArrival({ ...base, requestedStepId: 's1', open: null, step })).toEqual({
      kind: 'start',
      stepId: 's1',
      minutes: null,
    });
    expect(
      decideArrival({ ...base, minutes: 5, requestedStepId: 's1', open: null, step }),
    ).toMatchObject({ kind: 'start', minutes: 5 });
  });
  it('an open session is resumed, never replaced', () => {
    const open = { id: 'f1', step_id: 's1' };
    expect(decideArrival({ ...base, requestedStepId: 's1', open, step })).toEqual({
      kind: 'resume',
      sessionId: 'f1',
      otherStepId: null,
    });
    expect(decideArrival({ ...base, requestedStepId: 's2', open, step })).toEqual({
      kind: 'resume',
      sessionId: 'f1',
      otherStepId: 's2',
    });
    expect(decideArrival({ ...base, requestedStepId: null, open, step: null })).toMatchObject({
      kind: 'resume',
      otherStepId: null,
    });
  });
  it('bad or finished steps are reported gently', () => {
    expect(decideArrival({ ...base, requestedStepId: 'x', open: null, step: null })).toEqual({
      kind: 'unknown_step',
    });
    expect(
      decideArrival({
        ...base,
        requestedStepId: 's1',
        open: null,
        step: { ...step, deleted_at: iso(T0) },
      }),
    ).toEqual({ kind: 'unknown_step' });
    expect(
      decideArrival({
        ...base,
        requestedStepId: 's1',
        open: null,
        step: { ...step, done_at: 'x' },
      }),
    ).toEqual({ kind: 'step_already_done', stepId: 's1' });
  });
  it('plain /focus restores a pending timer end, or shows the empty room', () => {
    const awaiting = { session_id: 'f9', at: iso(T0 - MIN) };
    expect(
      decideArrival({ ...base, awaiting, requestedStepId: null, open: null, step: null }),
    ).toEqual({ kind: 'restore', sessionId: 'f9' });
    expect(decideArrival({ ...base, requestedStepId: null, open: null, step: null })).toEqual({
      kind: 'empty',
    });
  });
  it('a pending choice expires after a while', () => {
    const awaiting = { session_id: 'f9', at: iso(T0) };
    expect(liveAwaiting(awaiting, T0 + AWAITING_TTL_MS)).toEqual(awaiting);
    expect(liveAwaiting(awaiting, T0 + AWAITING_TTL_MS + 1)).toBeNull();
    expect(liveAwaiting({ session_id: 'x', at: 'nonsense' }, T0)).toBeNull();
    expect(restoreTarget({ id: 'open' }, awaiting, T0)).toBe('open');
    expect(restoreTarget(null, awaiting, T0 + 1)).toBe('f9');
    expect(restoreTarget(null, awaiting, T0 + AWAITING_TTL_MS + 1)).toBeNull();
  });
});

describe('ending', () => {
  it('a timer that ran out ends at the moment it reached zero, not later', () => {
    const s = state();
    expect(naturalEndAt(s, T0 + 10 * MIN)).toBeNull();
    expect(naturalEndAt(s, T0 + 40 * MIN)).toBe(T0 + 25 * MIN);
    const paused = state({ pauses: [{ start: T0 + MIN, end: T0 + 3 * MIN }] });
    expect(naturalEndAt(paused, T0 + 60 * MIN)).toBe(T0 + 27 * MIN);
    const pausedNow = state({ pauses: [{ start: T0 + MIN, end: null }] });
    expect(naturalEndAt(pausedNow, T0 + 60 * MIN)).toBeNull();
  });
  it('watched versus missed timer ends', () => {
    const s = state();
    const now = T0 + 25 * MIN + 500;
    expect(timerEndReason(s, now, now)).toBe('timer_done');
    // Reopened later: last seen unknown.
    expect(timerEndReason(s, T0 + 90 * MIN, null)).toBe('ended_while_away');
    // Looked away before the end.
    expect(timerEndReason(s, now, T0 + 20 * MIN)).toBe('ended_while_away');
    // Tab hidden over the end, even if "seen" counts were refreshed.
    const away = state({ away: [{ start: T0 + 24 * MIN, end: null }] });
    expect(timerEndReason(away, now, now)).toBe('ended_while_away');
  });
  it('closes open pauses and away periods and fills the totals', () => {
    const s = {
      pauses: [{ start: iso(T0 + 5 * MIN), end: iso(T0 + 7 * MIN) }],
      away: [
        { start: iso(T0 + MIN), end: iso(T0 + 2 * MIN) },
        { start: iso(T0 + 20 * MIN), end: null },
      ],
    };
    const ts = state({
      pauses: [{ start: T0 + 5 * MIN, end: T0 + 7 * MIN }],
      away: [
        { start: T0 + MIN, end: T0 + 2 * MIN },
        { start: T0 + 20 * MIN, end: null },
      ],
    });
    const patch = endingPatch(ts, s, T0 + 22 * MIN, 'stopped');
    expect(patch.ended_at).toBe(iso(T0 + 22 * MIN));
    expect(patch.end_reason).toBe('stopped');
    expect(patch.away[1]).toEqual({ start: iso(T0 + 20 * MIN), end: iso(T0 + 22 * MIN) });
    expect(patch.focused_ms).toBe(20 * MIN); // 22 min minus 2 min paused; away is not subtracted
    expect(patch.paused_ms).toBe(2 * MIN);
    expect(patch.away_ms).toBe(3 * MIN);
  });
  it('focused time is capped at the planned length', () => {
    const patch = endingPatch(state(), { pauses: [], away: [] }, T0 + 25 * MIN, 'timer_done');
    expect(patch.focused_ms).toBe(25 * MIN);
  });
});

describe('away tracking', () => {
  it('opens one period at a time and closes it', () => {
    const a = openAway([], iso(T0));
    expect(a).toEqual([{ start: iso(T0), end: null }]);
    expect(openAway(a, iso(T0 + MIN))).toEqual(a);
    expect(openAwayStart(a)).toBe(T0);
    const closed = closeAway(a, iso(T0 + 2 * MIN));
    expect(closed).toEqual([{ start: iso(T0), end: iso(T0 + 2 * MIN) }]);
    expect(openAwayStart(closed)).toBeNull();
    expect(openAway(closed, iso(T0 + 3 * MIN))).toHaveLength(2);
  });
  it('never closes a period before it started', () => {
    expect(closeAway([{ start: iso(T0), end: null }], iso(T0 - MIN))).toEqual([
      { start: iso(T0), end: iso(T0) },
    ]);
  });
  it('nudges once after the threshold while running', () => {
    const base = { awayStart: T0, thresholdSeconds: 60, running: true, alreadyNudged: false };
    expect(nudgeDue({ ...base, now: T0 + 59_999 })).toBe(false);
    expect(nudgeDue({ ...base, now: T0 + 60_000 })).toBe(true);
    expect(nudgeDue({ ...base, now: T0 + MIN, alreadyNudged: true })).toBe(false);
    expect(nudgeDue({ ...base, now: T0 + MIN, running: false })).toBe(false);
    expect(nudgeDue({ ...base, now: T0 + MIN, thresholdSeconds: 0 })).toBe(false);
    expect(nudgeDue({ ...base, now: T0 + MIN, awayStart: null })).toBe(false);
  });
});

describe('idle check-in', () => {
  it('is due after the set minutes with no input since the timer ended', () => {
    const base = { endedAt: T0, lastInputAt: null, minutes: 10 };
    expect(idleCheckinDue({ ...base, now: T0 + 9 * MIN })).toBe(false);
    expect(idleCheckinDue({ ...base, now: T0 + 10 * MIN })).toBe(true);
    expect(idleCheckinDue({ ...base, lastInputAt: T0 + 5 * MIN, now: T0 + 12 * MIN })).toBe(false);
    expect(idleCheckinDue({ ...base, minutes: 0, now: T0 + 99 * MIN })).toBe(false);
  });
});

describe('lengths', () => {
  it('keeps going with the same length, or the normal one after "just start"', () => {
    expect(continueMinutes(45 * MIN, 25)).toBe(45);
    expect(continueMinutes(5 * MIN, 25)).toBe(25);
    expect(continueMinutes(2 * MIN, 30)).toBe(30);
  });
  it('only offers lengths longer than what already ran', () => {
    expect(selectablePreset(10, 9 * MIN)).toBe(true);
    expect(selectablePreset(10, 10 * MIN)).toBe(false);
  });
});

describe('announcements', () => {
  it('announces every five minutes and the last minute, once per crossing', () => {
    expect(minuteMarkCrossed(25 * MIN, 24 * MIN + 59_000)).toBeNull();
    expect(minuteMarkCrossed(20 * MIN + 500, 19 * MIN + 999)).toBe(20);
    expect(minuteMarkCrossed(15 * MIN + 1, 15 * MIN)).toBe(15);
    expect(minuteMarkCrossed(MIN + 1, MIN)).toBe(1);
    expect(minuteMarkCrossed(2 * MIN + 1, 2 * MIN - 1)).toBeNull();
    expect(minuteMarkCrossed(MIN + 500, MIN - 500)).toBe(1);
    expect(minuteMarkCrossed(10 * MIN, 11 * MIN)).toBeNull();
    // A big jump (device slept) announces just one mark.
    expect(minuteMarkCrossed(24 * MIN, 3 * MIN)).toBe(20);
  });
});

describe('history and steps', () => {
  it('groups by day, newest first', () => {
    const rows = [
      { id: 'a', started_at: '2026-03-10T08:00:00.000Z' },
      { id: 'b', started_at: '2026-03-11T08:00:00.000Z' },
      { id: 'c', started_at: '2026-03-10T10:00:00.000Z' },
    ];
    const groups = groupByDay(rows, (s) => s.slice(0, 10));
    expect(groups.map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
      ['2026-03-11', ['b']],
      ['2026-03-10', ['c', 'a']],
    ]);
  });
  it('finds the next open step, and the first step', () => {
    const steps = [
      { id: 'a', position: 1, done_at: 'x' },
      { id: 'b', position: 2, done_at: null },
      { id: 'c', position: 3, done_at: null },
    ];
    expect(nextOpenStep(steps, 'b')?.id).toBe('c');
    expect(nextOpenStep(steps, 'c')?.id).toBe('b');
    expect(nextOpenStep([steps[1]!], 'b')).toBeNull();
    expect(isFirstStep(steps, 'a')).toBe(false); // something is done already
    expect(
      isFirstStep(
        steps.map((s) => ({ ...s, done_at: null })),
        'a',
      ),
    ).toBe(true);
    expect(isFirstStep(steps, 'b')).toBe(false);
  });
  it('quest guess falls back to the sum of step guesses', () => {
    const steps = [
      { guess_minutes: 5, actual_ms: 4 * MIN },
      { guess_minutes: 10, actual_ms: 12 * MIN },
    ];
    expect(questGuessAndActual({ guess_minutes: null }, steps)).toEqual({
      guessMinutes: 15,
      actualMs: 16 * MIN,
    });
    expect(questGuessAndActual({ guess_minutes: 30 }, steps).guessMinutes).toBe(30);
    expect(
      questGuessAndActual({ guess_minutes: null }, [{ guess_minutes: null, actual_ms: 0 }]),
    ).toEqual({ guessMinutes: null, actualMs: 0 });
  });
});
