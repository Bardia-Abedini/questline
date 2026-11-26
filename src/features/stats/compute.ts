/**
 * Stats from local data (plan section 13). Pure functions over plain rows, so they are
 * unit tested and the page only renders what comes out. Every number here is a win or a
 * neutral fact: nothing is framed as a miss.
 */
import {
  addDays,
  dayOfWeek,
  diffDays,
  startOfWeek,
  toLocalDate,
  type LocalDate,
} from '@/domain/dates';
import { estimateRatios, type EstimateRatios, type EstimateSample } from '@/domain/estimates';
import { levelFromXp } from '@/domain/levels';
import type { AchievementUnlock, FocusSession, LedgerEvent, Quest, Step } from '@/data/types';

export type StatsRange = '7d' | '30d' | 'all';

export interface StatsInput {
  today: LocalDate;
  weekStartsOn: number;
  sessions: readonly Pick<
    FocusSession,
    'kind' | 'started_at' | 'ended_at' | 'focused_ms' | 'distractions' | 'deleted_at'
  >[];
  steps: readonly Pick<
    Step,
    'quest_id' | 'done_at' | 'guess_minutes' | 'actual_ms' | 'deleted_at'
  >[];
  quests: readonly Pick<
    Quest,
    'id' | 'title' | 'status' | 'completed_at' | 'guess_minutes' | 'category_id' | 'deleted_at'
  >[];
  ledger: readonly Pick<LedgerEvent, 'kind' | 'xp' | 'day' | 'deleted_at'>[];
  achievements?: readonly Pick<AchievementUnlock, 'unlocked_at' | 'deleted_at'>[];
}

/** Six parts of the day, used for "best time of day" and distraction clusters. */
export const DAY_PARTS = ['early', 'morning', 'midday', 'afternoon', 'evening', 'night'] as const;
export type DayPart = (typeof DAY_PARTS)[number];

export function dayPartOf(hour: number): DayPart {
  if (hour >= 5 && hour < 9) return 'early';
  if (hour >= 9 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

export interface Bucket {
  /** First day of the bucket (a day, or a week start when bucketed by week). */
  start: LocalDate;
  focusMs: number;
  steps: number;
  quests: number;
  /** Lifetime XP at the end of the bucket. */
  xpTotal: number;
  /** XP earned inside the bucket. */
  xp: number;
}

export interface GuessVsActual {
  title: string;
  guessMinutes: number;
  actualMinutes: number;
  completedDay: LocalDate;
}

export interface Stats {
  range: StatsRange;
  /** `day` buckets for 7 and 30 days; `week` buckets for long "all" ranges. */
  unit: 'day' | 'week';
  from: LocalDate;
  to: LocalDate;
  buckets: Bucket[];
  totals: { focusMs: number; sessions: number; steps: number; quests: number; xp: number };
  /** Days in the range with at least one finished step. */
  activeDays: number;
  /** All-time active days (the streak, which never resets). */
  streak: number;
  /** Focused minutes by part of the day. */
  byPart: Record<DayPart, number>;
  bestPart: DayPart | null;
  /** The day in range with the most focus (or most steps when there is no focus). */
  bestDay: LocalDate | null;
  distractions: {
    total: number;
    byPart: Record<DayPart, number>;
    /** Index 0 is the first day of the week (see `weekdays`). */
    byWeekday: number[];
    /** Weekday numbers (0 = Sunday) in display order. */
    weekdays: number[];
    topPart: DayPart | null;
    topWeekday: number | null;
  };
  estimates: {
    recent: GuessVsActual[];
    /** All-time ratios (actual / guess), overall and by category. */
    ratios: EstimateRatios;
  };
}

const alive = <T extends { deleted_at: string | null }>(rows: readonly T[]) =>
  rows.filter((r) => r.deleted_at === null);

function emptyParts(): Record<DayPart, number> {
  return { early: 0, morning: 0, midday: 0, afternoon: 0, evening: 0, night: 0 };
}

function argmax<K extends string | number>(entries: Array<[K, number]>): K | null {
  let best: K | null = null;
  let value = 0;
  for (const [k, v] of entries) {
    if (v > value) {
      best = k;
      value = v;
    }
  }
  return best;
}

/** Days are bucketed by week when "all" spans more than this many days. */
export const WEEK_BUCKETS_AFTER_DAYS = 60;

function firstDataDay(input: StatsInput): LocalDate | null {
  const days: LocalDate[] = [];
  for (const s of alive(input.sessions)) days.push(toLocalDate(Date.parse(s.started_at)));
  for (const e of alive(input.ledger)) days.push(e.day);
  for (const st of alive(input.steps))
    if (st.done_at) days.push(toLocalDate(Date.parse(st.done_at)));
  return days.length ? days.sort()[0]! : null;
}

export function rangeBounds(
  range: StatsRange,
  input: StatsInput,
): { from: LocalDate; unit: 'day' | 'week' } {
  const { today } = input;
  if (range === '7d') return { from: addDays(today, -6), unit: 'day' };
  if (range === '30d') return { from: addDays(today, -29), unit: 'day' };
  const first = firstDataDay(input);
  const from = first && first < addDays(today, -6) ? first : addDays(today, -6);
  if (diffDays(from, today) + 1 > WEEK_BUCKETS_AFTER_DAYS) {
    return { from: startOfWeek(from, input.weekStartsOn), unit: 'week' };
  }
  return { from, unit: 'day' };
}

/** Guess for a finished quest: its own guess, else the sum of its step guesses. */
function questGuess(q: StatsInput['quests'][number], steps: StatsInput['steps']): number | null {
  if (q.guess_minutes && q.guess_minutes > 0) return q.guess_minutes;
  const sum = steps.reduce(
    (t, s) => t + (s.guess_minutes && s.guess_minutes > 0 ? s.guess_minutes : 0),
    0,
  );
  return sum > 0 ? sum : null;
}

export function computeStats(input: StatsInput, range: StatsRange): Stats {
  const { today } = input;
  const { from, unit } = rangeBounds(range, input);
  const inRange = (day: LocalDate) => day >= from && day <= today;
  const bucketOf = (day: LocalDate) =>
    unit === 'day' ? day : startOfWeek(day, input.weekStartsOn);

  const starts: LocalDate[] = [];
  for (let d = from; d <= today; d = addDays(d, unit === 'day' ? 1 : 7)) starts.push(d);
  const buckets = new Map<LocalDate, Bucket>(
    starts.map((start) => [start, { start, focusMs: 0, steps: 0, quests: 0, xpTotal: 0, xp: 0 }]),
  );
  const at = (day: LocalDate) => buckets.get(bucketOf(day));

  const totals = { focusMs: 0, sessions: 0, steps: 0, quests: 0, xp: 0 };
  const byPart = emptyParts();
  const focusByDay = new Map<LocalDate, number>();
  const stepsByDay = new Map<LocalDate, number>();
  const dByPart = emptyParts();
  const weekdays = Array.from({ length: 7 }, (_, i) => (input.weekStartsOn + i) % 7);
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  let distractionTotal = 0;

  for (const s of alive(input.sessions)) {
    if (s.kind !== 'focus') continue;
    const startMs = Date.parse(s.started_at);
    const day = toLocalDate(startMs);
    if (!inRange(day)) continue;
    for (const d of s.distractions ?? []) {
      const dms = Date.parse(d.at);
      const dday = toLocalDate(dms);
      if (!inRange(dday)) continue;
      distractionTotal++;
      dByPart[dayPartOf(new Date(dms).getHours())]++;
      byWeekday[weekdays.indexOf(dayOfWeek(dday))]!++;
    }
    if (s.ended_at === null || s.focused_ms <= 0) continue;
    totals.focusMs += s.focused_ms;
    totals.sessions++;
    byPart[dayPartOf(new Date(startMs).getHours())] += s.focused_ms;
    focusByDay.set(day, (focusByDay.get(day) ?? 0) + s.focused_ms);
    const b = at(day);
    if (b) b.focusMs += s.focused_ms;
  }

  const activeInRange = new Set<LocalDate>();
  for (const st of alive(input.steps)) {
    if (!st.done_at) continue;
    const day = toLocalDate(Date.parse(st.done_at));
    if (!inRange(day)) continue;
    totals.steps++;
    activeInRange.add(day);
    stepsByDay.set(day, (stepsByDay.get(day) ?? 0) + 1);
    const b = at(day);
    if (b) b.steps++;
  }

  const stepsByQuest = new Map<string, StatsInput['steps'][number][]>();
  for (const st of alive(input.steps)) {
    const list = stepsByQuest.get(st.quest_id) ?? [];
    list.push(st);
    stepsByQuest.set(st.quest_id, list);
  }
  const samples: EstimateSample[] = [];
  const recent: GuessVsActual[] = [];
  for (const q of alive(input.quests)) {
    if (q.status !== 'done' || !q.completed_at) continue;
    const day = toLocalDate(Date.parse(q.completed_at));
    if (inRange(day)) {
      totals.quests++;
      const b = at(day);
      if (b) b.quests++;
    }
    const steps = stepsByQuest.get(q.id) ?? [];
    const guess = questGuess(q, steps);
    const actualMinutes = steps.reduce((t, s) => t + Math.max(0, s.actual_ms), 0) / 60_000;
    if (guess === null || actualMinutes <= 0) continue;
    samples.push({ guessMinutes: guess, actualMinutes, categoryId: q.category_id });
    if (inRange(day))
      recent.push({ title: q.title, guessMinutes: guess, actualMinutes, completedDay: day });
  }
  recent.sort((a, b) => (a.completedDay < b.completedDay ? 1 : -1));

  // XP: lifetime total at the end of each bucket, so the line only ever climbs.
  const ledger = alive(input.ledger);
  const xpBefore = ledger.filter((e) => e.day < from).reduce((t, e) => t + Math.max(0, e.xp), 0);
  for (const e of ledger) {
    if (!inRange(e.day) || e.xp <= 0) continue;
    totals.xp += e.xp;
    const b = at(e.day);
    if (b) b.xp += e.xp;
  }
  let running = xpBefore;
  const list = [...buckets.values()];
  for (const b of list) {
    running += b.xp;
    b.xpTotal = running;
  }
  const streak = new Set(
    ledger.filter((e) => e.kind === 'step_reward' && e.day <= today).map((e) => e.day),
  ).size;

  const bestDay = argmax([...focusByDay.entries()]) ?? argmax([...stepsByDay.entries()]);

  return {
    range,
    unit,
    from,
    to: today,
    buckets: list,
    totals,
    activeDays: activeInRange.size,
    streak,
    byPart,
    bestPart: argmax(DAY_PARTS.map((p) => [p, byPart[p]] as [DayPart, number])),
    bestDay,
    distractions: {
      total: distractionTotal,
      byPart: dByPart,
      byWeekday,
      weekdays,
      topPart: argmax(DAY_PARTS.map((p) => [p, dByPart[p]] as [DayPart, number])),
      topWeekday: (() => {
        const i = argmax(byWeekday.map((v, idx) => [idx, v] as [number, number]));
        return i === null ? null : weekdays[i]!;
      })(),
    },
    estimates: { recent: recent.slice(0, 8), ratios: estimateRatios(samples) },
  };
}

/* ------------------------------------------------------------- weekly recap */

export interface WeeklyRecap {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  focusMs: number;
  steps: number;
  quests: number;
  bestDay: LocalDate | null;
  /** Levels reached during the week (e.g. [4, 5]). */
  levels: number[];
  badges: number;
  /** Guesses this week were closer to the real time than before (only ever a win). */
  estimatesImproved: boolean;
  /** Anything worth celebrating at all. With nothing, no recap is shown. */
  hasWins: boolean;
}

/** How far a ratio is from a perfect guess, symmetric for over and under. */
function guessError(ratio: number): number {
  return Math.abs(Math.log(ratio));
}

function median(values: number[]): number {
  const s = values.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** The week before the current one (by the player's week start), wins only. */
export function computeWeeklyRecap(input: StatsInput): WeeklyRecap {
  const weekStart = addDays(startOfWeek(input.today, input.weekStartsOn), -7);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = (day: LocalDate) => day >= weekStart && day <= weekEnd;

  let focusMs = 0;
  const perDay = new Map<LocalDate, number>();
  for (const s of alive(input.sessions)) {
    if (s.kind !== 'focus' || s.ended_at === null || s.focused_ms <= 0) continue;
    const day = toLocalDate(Date.parse(s.started_at));
    if (!inWeek(day)) continue;
    focusMs += s.focused_ms;
    perDay.set(day, (perDay.get(day) ?? 0) + s.focused_ms);
  }
  let steps = 0;
  const stepDays = new Map<LocalDate, number>();
  for (const st of alive(input.steps)) {
    if (!st.done_at) continue;
    const day = toLocalDate(Date.parse(st.done_at));
    if (!inWeek(day)) continue;
    steps++;
    stepDays.set(day, (stepDays.get(day) ?? 0) + 1);
  }

  const stepsByQuest = new Map<string, StatsInput['steps'][number][]>();
  for (const st of alive(input.steps)) {
    stepsByQuest.set(st.quest_id, [...(stepsByQuest.get(st.quest_id) ?? []), st]);
  }
  let quests = 0;
  const weekErrors: number[] = [];
  const beforeErrors: number[] = [];
  for (const q of alive(input.quests)) {
    if (q.status !== 'done' || !q.completed_at) continue;
    const day = toLocalDate(Date.parse(q.completed_at));
    if (inWeek(day)) quests++;
    const qs = stepsByQuest.get(q.id) ?? [];
    const guess = questGuess(q, qs);
    const actual = qs.reduce((t, s) => t + Math.max(0, s.actual_ms), 0) / 60_000;
    if (!guess || actual <= 0) continue;
    const err = guessError(Math.min(5, Math.max(0.2, actual / guess)));
    if (inWeek(day)) weekErrors.push(err);
    else if (day < weekStart) beforeErrors.push(err);
  }
  const estimatesImproved =
    weekErrors.length >= 2 &&
    beforeErrors.length >= 3 &&
    median(weekErrors) < median(beforeErrors) - 0.05;

  const ledger = alive(input.ledger);
  const xpBefore = ledger
    .filter((e) => e.day < weekStart)
    .reduce((t, e) => t + Math.max(0, e.xp), 0);
  const xpAfter =
    xpBefore + ledger.filter((e) => inWeek(e.day)).reduce((t, e) => t + Math.max(0, e.xp), 0);
  const levels: number[] = [];
  for (let l = levelFromXp(xpBefore).level + 1; l <= levelFromXp(xpAfter).level; l++)
    levels.push(l);

  const badges = alive(input.achievements ?? []).filter((a) =>
    inWeek(toLocalDate(Date.parse(a.unlocked_at))),
  ).length;

  const bestDay = argmax([...perDay.entries()]) ?? argmax([...stepDays.entries()]);
  return {
    weekStart,
    weekEnd,
    focusMs,
    steps,
    quests,
    bestDay,
    levels,
    badges,
    estimatesImproved,
    hasWins: focusMs > 0 || steps > 0 || quests > 0,
  };
}

/** The recap is offered on Today during the first three days of a new week. */
export function recapOfferOpen(today: LocalDate, weekStartsOn: number): boolean {
  return diffDays(startOfWeek(today, weekStartsOn), today) <= 2;
}
