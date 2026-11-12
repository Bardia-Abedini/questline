import type { LocalDate } from './dates';
import { createRng, seedFromString, shuffle, type Rng } from './rng';

/**
 * Daily quests (plan section 6): three small optional goals per day, picked from a pool,
 * with a small gold bonus. Skipping is never penalized. A reroll power-up swaps one goal.
 */

export type DailyQuestKind =
  | 'finish_steps'
  | 'finish_quick_steps'
  | 'focus_minutes'
  | 'focus_sessions'
  | 'finish_quest'
  | 'energy_checkin'
  | 'sort_inbox'
  | 'touch_old_quest';

export interface DailyQuestDef {
  /** Stable pool key, also the i18n key suffix (`game:daily.<key>`). */
  key: string;
  kind: DailyQuestKind;
  target: number;
  rewardGold: number;
}

/** The launch pool. Game may extend it; keys must stay stable once shipped. */
export const DAILY_QUEST_POOL: readonly DailyQuestDef[] = Object.freeze([
  { key: 'steps_1', kind: 'finish_steps', target: 1, rewardGold: 5 },
  { key: 'steps_3', kind: 'finish_steps', target: 3, rewardGold: 10 },
  { key: 'steps_5', kind: 'finish_steps', target: 5, rewardGold: 15 },
  { key: 'quick_2', kind: 'finish_quick_steps', target: 2, rewardGold: 8 },
  { key: 'focus_15', kind: 'focus_minutes', target: 15, rewardGold: 8 },
  { key: 'focus_25', kind: 'focus_minutes', target: 25, rewardGold: 10 },
  { key: 'focus_50', kind: 'focus_minutes', target: 50, rewardGold: 15 },
  { key: 'sessions_2', kind: 'focus_sessions', target: 2, rewardGold: 10 },
  { key: 'quest_1', kind: 'finish_quest', target: 1, rewardGold: 12 },
  { key: 'energy_1', kind: 'energy_checkin', target: 1, rewardGold: 5 },
  { key: 'inbox_3', kind: 'sort_inbox', target: 3, rewardGold: 8 },
  { key: 'old_quest_1', kind: 'touch_old_quest', target: 1, rewardGold: 12 },
]);

export const DAILY_QUESTS_PER_DAY = 3;

/**
 * Picks the day's goals. Deterministic for the same `seed` and `day`, so every device of
 * the same player generates the same set. At most one goal of each kind.
 */
export function generateDailyQuests(
  day: LocalDate,
  seed: string,
  pool: readonly DailyQuestDef[] = DAILY_QUEST_POOL,
  count = DAILY_QUESTS_PER_DAY,
): DailyQuestDef[] {
  const rng = createRng(seedFromString(`${seed}:${day}`));
  return pickDistinctKinds(rng, pool, count, new Set());
}

function pickDistinctKinds(
  rng: Rng,
  pool: readonly DailyQuestDef[],
  count: number,
  excludeKinds: ReadonlySet<DailyQuestKind>,
): DailyQuestDef[] {
  const out: DailyQuestDef[] = [];
  const kinds = new Set(excludeKinds);
  for (const def of shuffle(rng, pool)) {
    if (out.length >= count) break;
    if (kinds.has(def.kind)) continue;
    kinds.add(def.kind);
    out.push(def);
  }
  return out;
}

/**
 * Replaces the goal at `index` with a different one whose kind is not already in the set.
 * Returns the same list when nothing else is available.
 */
export function rerollDailyQuest(
  current: readonly DailyQuestDef[],
  index: number,
  rng: Rng,
  pool: readonly DailyQuestDef[] = DAILY_QUEST_POOL,
): DailyQuestDef[] {
  if (index < 0 || index >= current.length) return current.slice();
  const others = current.filter((_, i) => i !== index);
  const exclude = new Set(others.map((d) => d.kind));
  exclude.add(current[index]!.kind);
  const [replacement] = pickDistinctKinds(rng, pool, 1, exclude);
  if (!replacement) return current.slice();
  const next = current.slice();
  next[index] = replacement;
  return next;
}

/** What happened today, counted by the Game package from the data layer. */
export interface DayActivity {
  stepsFinished: number;
  quickStepsFinished: number;
  focusMinutes: number;
  focusSessions: number;
  questsFinished: number;
  energyCheckins: number;
  inboxSorted: number;
  oldQuestsTouched: number;
}

export const EMPTY_DAY_ACTIVITY: DayActivity = Object.freeze({
  stepsFinished: 0,
  quickStepsFinished: 0,
  focusMinutes: 0,
  focusSessions: 0,
  questsFinished: 0,
  energyCheckins: 0,
  inboxSorted: 0,
  oldQuestsTouched: 0,
});

const KIND_TO_FIELD: Readonly<Record<DailyQuestKind, keyof DayActivity>> = {
  finish_steps: 'stepsFinished',
  finish_quick_steps: 'quickStepsFinished',
  focus_minutes: 'focusMinutes',
  focus_sessions: 'focusSessions',
  finish_quest: 'questsFinished',
  energy_checkin: 'energyCheckins',
  sort_inbox: 'inboxSorted',
  touch_old_quest: 'oldQuestsTouched',
};

export function dailyQuestProgress(
  def: DailyQuestDef,
  activity: DayActivity,
): { progress: number; target: number; done: boolean } {
  const raw = Math.max(0, Math.floor(activity[KIND_TO_FIELD[def.kind]]));
  const progress = Math.min(raw, def.target);
  return { progress, target: def.target, done: raw >= def.target };
}
