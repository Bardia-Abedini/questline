import { DAY_MS, endOfLocalDateMs, localDateTimeToMs, type EpochMs, type LocalDate } from './dates';
import type { Difficulty, Priority, QuestStatus } from './types';

/**
 * Quest rules: active ordering and limit (plan section 2), overdue detection (section 9)
 * and boss eligibility (section 6).
 *
 * Inputs use the same snake_case field names as the data rows, so rows can be passed in
 * directly. Timestamps are ISO 8601 strings, as stored.
 */

export const PRIORITY_RANK: Readonly<Record<Priority, number>> = { high: 0, medium: 1, low: 2 };

export const DEFAULT_ACTIVE_LIMIT = 3;
export const MIN_ACTIVE_LIMIT = 1;
export const MAX_ACTIVE_LIMIT = 5;

export function clampActiveLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_ACTIVE_LIMIT;
  return Math.min(MAX_ACTIVE_LIMIT, Math.max(MIN_ACTIVE_LIMIT, Math.round(limit)));
}

/** Whether one more quest can be made active without the swap sheet. */
export function canActivateAnother(activeCount: number, limit: number): boolean {
  return activeCount < clampActiveLimit(limit);
}

export interface DueFields {
  due_date: LocalDate | null;
  /** `HH:mm`, local time. Without it the quest is due at the end of its day. */
  due_time: string | null;
}

/** The instant a quest becomes overdue, or null if it has no due date. */
export function dueAtMs(q: DueFields): EpochMs | null {
  if (!q.due_date) return null;
  return q.due_time ? localDateTimeToMs(q.due_date, q.due_time) : endOfLocalDateMs(q.due_date);
}

export interface OrderingFields extends DueFields {
  id: string;
  priority: Priority;
  last_touched_at: string | null;
  created_at: string;
}

function timeOf(iso: string | null): number {
  if (!iso) return -Infinity;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Active-quest order: priority (high first), then due date (soonest first, none last),
 * then last touched (most recent first), then created, then id for a stable order.
 */
export function compareActiveQuests(a: OrderingFields, b: OrderingFields): number {
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (p !== 0) return p;
  const da = dueAtMs(a);
  const db = dueAtMs(b);
  if (da !== db) {
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  }
  const ta = timeOf(a.last_touched_at);
  const tb = timeOf(b.last_touched_at);
  if (ta !== tb) return tb - ta;
  const ca = timeOf(a.created_at);
  const cb = timeOf(b.created_at);
  if (ca !== cb) return ca - cb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortActiveQuests<T extends OrderingFields>(quests: readonly T[]): T[] {
  return quests.slice().sort(compareActiveQuests);
}

export interface OverdueFields extends DueFields {
  status: QuestStatus;
  overdue_asked_at: string | null;
}

const OPEN_STATUSES: ReadonlySet<QuestStatus> = new Set(['inbox', 'backlog', 'active']);

export function isOpenStatus(status: QuestStatus): boolean {
  return OPEN_STATUSES.has(status);
}

/** Past its due time and still open. */
export function isOverdue(q: OverdueFields, now: EpochMs): boolean {
  const due = dueAtMs(q);
  return due !== null && isOpenStatus(q.status) && now >= due;
}

/**
 * Whether to show the single "Can this still be done?" prompt. Each quest is asked at most
 * once, ever: once `overdue_asked_at` is set it is never asked again, even with a new date.
 */
export function shouldAskOverdue(q: OverdueFields, now: EpochMs): boolean {
  return q.overdue_asked_at === null && isOverdue(q, now);
}

/** A quest untouched for this many days can be turned into a boss. */
export const BOSS_UNTOUCHED_DAYS = 14;

export interface BossFields {
  status: QuestStatus;
  difficulty: Difficulty;
  is_boss: boolean;
  last_touched_at: string | null;
  created_at: string;
}

/** Days since the quest was last touched (or created, if never touched). */
export function daysUntouched(
  q: Pick<BossFields, 'last_touched_at' | 'created_at'>,
  now: EpochMs,
): number {
  const since = timeOf(q.last_touched_at ?? q.created_at);
  if (!Number.isFinite(since)) return 0;
  return Math.max(0, Math.floor((now - since) / DAY_MS));
}

/** Any open S-rank quest, or an open quest untouched for 14+ days, can become a boss. */
export function isBossEligible(q: BossFields, now: EpochMs): boolean {
  if (q.is_boss || !isOpenStatus(q.status)) return false;
  return q.difficulty === 'S' || daysUntouched(q, now) >= BOSS_UNTOUCHED_DAYS;
}

/** Boss health bar: each finished step deals equal damage. */
export function bossHealth(
  totalSteps: number,
  doneSteps: number,
): {
  max: number;
  current: number;
  fraction: number;
} {
  const max = Math.max(1, Math.floor(totalSteps));
  const done = Math.min(max, Math.max(0, Math.floor(doneSteps)));
  const current = max - done;
  return { max, current, fraction: current / max };
}
