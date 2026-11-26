/**
 * Focus session state machine and restore decisions. Pure functions: time comes in as
 * `now` (epoch ms), rows come in as plain objects. Everything the focus screens show is
 * derived from stored rows through these functions, so a reload, a closed app or another
 * device always lands on the same screen.
 */
import {
  awayMs,
  endedWhileAway,
  focusedMs,
  pausedMs,
  timerEndsAt,
  timerPhase,
  type TimerState,
} from '@/domain/timer';
import type {
  FocusSession,
  IsoDateTime,
  Quest,
  SessionEndReason,
  Step,
  TimeSpanRow,
} from '@/data/types';

/* ------------------------------------------------------------------ lengths */

export const DEFAULT_FOCUS_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;
export const DEFAULT_PRESETS: readonly number[] = [10, 15, 25, 45];
export const JUST_START_MINUTES = 5;
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 240;
/** "Awaiting a choice" after a timer end is offered for this long, then it quietly expires. */
export const AWAITING_TTL_MS = 12 * 60 * 60 * 1000;

export function clampMinutes(value: number, fallback = DEFAULT_FOCUS_MINUTES): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)));
}

/**
 * Length of the fresh timer after "Keep going": the previous length, except after a short
 * "just start" timer, where the player's normal length follows (the warm-up is done).
 */
export function continueMinutes(previousPlannedMs: number, defaultMinutes: number): number {
  const prev = Math.round(previousPlannedMs / 60_000);
  if (prev <= JUST_START_MINUTES) return clampMinutes(defaultMinutes);
  return clampMinutes(prev, defaultMinutes);
}

/**
 * Presets that can still be picked for a running timer: longer than what has already run,
 * so changing the length never ends the timer by surprise.
 */
export function selectablePreset(minutes: number, runningMsSoFar: number): boolean {
  return minutes * 60_000 > runningMsSoFar;
}

/* -------------------------------------------------------------- the screen */

export type FocusView =
  | { kind: 'missing' }
  | { kind: 'timer' }
  | { kind: 'break' }
  /** The timer ran out. `whileAway`: it ran out while the player was not looking. */
  | { kind: 'time_up'; whileAway: boolean }
  | { kind: 'break_over' }
  /** The session's step is done; `questDone` when that finished the quest. */
  | { kind: 'step_done'; questDone: boolean }
  | { kind: 'stopped' };

type SessionLike = Pick<FocusSession, 'kind' | 'ended_at' | 'end_reason' | 'deleted_at'>;

/** Which focus screen a stored session leads to. */
export function viewFor(
  session: SessionLike | null | undefined,
  step: Pick<Step, 'done_at'> | null | undefined,
  quest: Pick<Quest, 'status'> | null | undefined,
): FocusView {
  if (!session || session.deleted_at !== null) return { kind: 'missing' };
  if (session.ended_at === null) return { kind: session.kind === 'break' ? 'break' : 'timer' };
  if (session.kind === 'break') return { kind: 'break_over' };
  if (step?.done_at) return { kind: 'step_done', questDone: quest?.status === 'done' };
  if (session.end_reason === 'timer_done') return { kind: 'time_up', whileAway: false };
  if (session.end_reason === 'ended_while_away') return { kind: 'time_up', whileAway: true };
  return { kind: 'stopped' };
}

/* ---------------------------------------------------------- arriving, restoring */

export interface Awaiting {
  session_id: string;
  /** When the timer ended (ISO). */
  at: IsoDateTime;
}

/** A pending "what's next?" choice that has not gone stale. */
export function liveAwaiting(awaiting: Awaiting | null | undefined, now: number): Awaiting | null {
  if (!awaiting) return null;
  const at = Date.parse(awaiting.at);
  if (Number.isNaN(at) || now - at > AWAITING_TTL_MS) return null;
  return awaiting;
}

/**
 * Where to bring the player back to: the open session first, then a timer end still
 * waiting for a choice. Null when there is nothing to come back to.
 */
export function restoreTarget(
  open: Pick<FocusSession, 'id'> | null | undefined,
  awaiting: Awaiting | null | undefined,
  now: number,
): string | null {
  if (open) return open.id;
  return liveAwaiting(awaiting, now)?.session_id ?? null;
}

export type ArrivalDecision =
  /** Start a new session for this step. */
  | { kind: 'start'; stepId: string; minutes: number | null }
  /** A session is already open: resume it. `otherStepId` is set when the link asked for a
   * different step; nothing is stopped automatically, the player can switch in one tap. */
  | { kind: 'resume'; sessionId: string; otherStepId: string | null }
  /** The step does not exist (deleted, or a bad link). */
  | { kind: 'unknown_step' }
  /** The step is already done. */
  | { kind: 'step_already_done'; stepId: string }
  /** No step in the link: restore something, or show the quiet empty room. */
  | { kind: 'restore'; sessionId: string }
  | { kind: 'empty' };

/**
 * What arriving at `/focus?step=<id>[&minutes=<n>]` (or plain `/focus`) does.
 * Decision on conflicts: an open session always wins and is resumed, never stopped or
 * replaced silently; a link for another step shows a one-tap "switch" offer instead.
 */
export function decideArrival(input: {
  requestedStepId: string | null;
  minutes: number | null;
  open: Pick<FocusSession, 'id' | 'step_id'> | null;
  awaiting: Awaiting | null;
  step: Pick<Step, 'id' | 'done_at' | 'deleted_at'> | null | undefined;
  now: number;
}): ArrivalDecision {
  const { requestedStepId, open, step } = input;
  if (open) {
    const other = requestedStepId && requestedStepId !== open.step_id ? requestedStepId : null;
    return { kind: 'resume', sessionId: open.id, otherStepId: other };
  }
  if (!requestedStepId) {
    const target = restoreTarget(null, input.awaiting, input.now);
    return target ? { kind: 'restore', sessionId: target } : { kind: 'empty' };
  }
  if (!step || step.deleted_at !== null) return { kind: 'unknown_step' };
  if (step.done_at !== null) return { kind: 'step_already_done', stepId: step.id };
  return { kind: 'start', stepId: step.id, minutes: input.minutes };
}

/* ------------------------------------------------------------ ending a session */

/** How a timer that ran out is recorded: watched (`timer_done`) or missed (`ended_while_away`). */
export function timerEndReason(
  state: TimerState,
  now: number,
  lastSeenAt: number | null,
): Extract<SessionEndReason, 'timer_done' | 'ended_while_away'> {
  return endedWhileAway(state, now, lastSeenAt) ? 'ended_while_away' : 'timer_done';
}

function closeSpans(spans: readonly TimeSpanRow[], at: IsoDateTime): TimeSpanRow[] {
  return spans.map((s) =>
    s.end === null ? { start: s.start, end: s.start > at ? s.start : at } : s,
  );
}

/**
 * The fields to save when a session ends at `endAt`: open pauses and away periods are
 * closed at that moment, and the totals come from the domain timer math.
 */
export function endingPatch(
  state: TimerState,
  session: Pick<FocusSession, 'pauses' | 'away'>,
  endAt: number,
  reason: SessionEndReason,
): Pick<
  FocusSession,
  'ended_at' | 'end_reason' | 'pauses' | 'away' | 'focused_ms' | 'away_ms' | 'paused_ms'
> {
  const endIso = new Date(endAt).toISOString();
  const ended: TimerState = { ...state, endedAt: endAt };
  return {
    ended_at: endIso,
    end_reason: reason,
    pauses: closeSpans(session.pauses, endIso),
    away: closeSpans(session.away, endIso),
    focused_ms: focusedMs(ended, endAt),
    away_ms: awayMs(ended, endAt),
    paused_ms: pausedMs(ended, endAt),
  };
}

/**
 * When a session that is still open in storage should end on its own: the moment its timer
 * ran out (so the saved focused time is exactly the planned time). Null while it still runs
 * or is paused.
 */
export function naturalEndAt(state: TimerState, now: number): number | null {
  if (timerPhase(state, now) !== 'finished') return null;
  return timerEndsAt(state, now);
}

/* ------------------------------------------------------------- time away */

/** Opens an away period at `at` unless one is already open. */
export function openAway(spans: readonly TimeSpanRow[], at: IsoDateTime): TimeSpanRow[] {
  if (spans.some((s) => s.end === null)) return [...spans];
  return [...spans, { start: at, end: null }];
}

/** Closes any open away period at `at`. */
export function closeAway(spans: readonly TimeSpanRow[], at: IsoDateTime): TimeSpanRow[] {
  return closeSpans(spans, at);
}

/** The start of the open away period (epoch ms), if any. */
export function openAwayStart(spans: readonly TimeSpanRow[]): number | null {
  const open = spans.find((s) => s.end === null);
  return open ? Date.parse(open.start) : null;
}

/**
 * Whether the "you left the app" nudge is due: away for at least the threshold while the
 * focus timer is running. A threshold of 0 means the nudge is off. Once per away period.
 */
export function nudgeDue(input: {
  awayStart: number | null;
  now: number;
  thresholdSeconds: number;
  running: boolean;
  alreadyNudged: boolean;
}): boolean {
  if (input.awayStart === null || !input.running || input.alreadyNudged) return false;
  if (!(input.thresholdSeconds > 0)) return false;
  return input.now - input.awayStart >= input.thresholdSeconds * 1000;
}

/** Milliseconds until the nudge would be due (for a timer), or null if it never will be. */
export function msUntilNudge(awayStart: number, now: number, thresholdSeconds: number): number {
  return Math.max(0, awayStart + thresholdSeconds * 1000 - now);
}

/* --------------------------------------------------------------- idle check-in */

/**
 * "Still on it?": the timer ended a while ago and there has been no input since.
 * Measured from the later of the timer end and the last input. 0 minutes = off.
 */
export function idleCheckinDue(input: {
  endedAt: number;
  lastInputAt: number | null;
  now: number;
  minutes: number;
}): boolean {
  if (!(input.minutes > 0)) return false;
  const since = Math.max(input.endedAt, input.lastInputAt ?? 0);
  return input.now - since >= input.minutes * 60_000;
}

/* ------------------------------------------------------------ announcements */

/**
 * Minutes worth announcing to screen readers as the timer runs: every 5 minutes, and the
 * last minute. Returns the minute mark crossed between two readings, or null. Never more
 * than one announcement per crossing, so live regions are not spammed every second.
 */
export function minuteMarkCrossed(prevRemainingMs: number, remainingMs: number): number | null {
  if (remainingMs >= prevRemainingMs) return null;
  const prevMin = Math.ceil(prevRemainingMs / 60_000);
  const min = Math.ceil(remainingMs / 60_000);
  if (min === prevMin || min <= 0) return null;
  for (let m = prevMin - 1; m >= min; m--) {
    if (m === 1 || m % 5 === 0) return m;
  }
  return null;
}

/* ---------------------------------------------------------------- history */

export interface DayGroup<T> {
  day: string;
  items: T[];
}

/**
 * Groups sessions by local day of their start, newest day first and newest session first.
 * `dayOf` turns an ISO timestamp into a LocalDate (device time zone).
 */
export function groupByDay<T extends Pick<FocusSession, 'started_at'>>(
  rows: readonly T[],
  dayOf: (iso: IsoDateTime) => string,
): DayGroup<T>[] {
  const sorted = [...rows].sort((a, b) =>
    a.started_at < b.started_at ? 1 : a.started_at > b.started_at ? -1 : 0,
  );
  const groups: DayGroup<T>[] = [];
  for (const row of sorted) {
    const day = dayOf(row.started_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(row);
    else groups.push({ day, items: [row] });
  }
  return groups;
}

/* ----------------------------------------------------------------- steps */

/** The first open step after `current` in quest order (wrapping to earlier open steps). */
export function nextOpenStep<T extends Pick<Step, 'id' | 'position' | 'done_at'>>(
  steps: readonly T[],
  currentId: string | null,
): T | null {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  const idx = ordered.findIndex((s) => s.id === currentId);
  const after = ordered.slice(idx + 1).find((s) => s.done_at === null && s.id !== currentId);
  if (after) return after;
  return ordered.slice(0, Math.max(0, idx)).find((s) => s.done_at === null) ?? null;
}

/** "Just start" is offered on a quest's first step while nothing has been done on it yet. */
export function isFirstStep<T extends Pick<Step, 'id' | 'position' | 'done_at'>>(
  steps: readonly T[],
  stepId: string | null,
): boolean {
  if (!stepId || steps.length === 0) return false;
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  return ordered[0]!.id === stepId && ordered.every((s) => s.done_at === null);
}

/** Guess versus actual for a quest: its own guess, or the sum of step guesses. */
export function questGuessAndActual(
  quest: Pick<Quest, 'guess_minutes'>,
  steps: readonly Pick<Step, 'guess_minutes' | 'actual_ms'>[],
): { guessMinutes: number | null; actualMs: number } {
  const stepGuesses = steps
    .map((s) => s.guess_minutes)
    .filter((g): g is number => typeof g === 'number');
  const guessMinutes =
    quest.guess_minutes ?? (stepGuesses.length ? stepGuesses.reduce((sum, g) => sum + g, 0) : null);
  const actualMs = steps.reduce((sum, s) => sum + (s.actual_ms || 0), 0);
  return { guessMinutes, actualMs };
}
