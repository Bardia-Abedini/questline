import { DAY_MS, HOUR_MS, type EpochMs } from './dates';
import { dueAtMs, isOpenStatus, PRIORITY_RANK, type DueFields } from './quests';
import type { Difficulty, EnergyLevel, Priority, QuestStatus } from './types';

/**
 * Local "What should I do now?" scoring (plan sections 10 and 13). Works without AI.
 * The AI version may add a one-line reason, but the pick is made by the same rule offline.
 */

export interface SuggestCandidate extends DueFields {
  id: string;
  status: QuestStatus;
  priority: Priority;
  difficulty: Difficulty;
  /** The quest's time guess in minutes, if any. */
  guess_minutes: number | null;
  /** Guess of the next unfinished step, if known (smaller next steps suit low energy). */
  next_step_guess_minutes?: number | null;
  next_step_quick?: boolean;
}

export type SuggestReason =
  | 'overdue'
  | 'due_today'
  | 'due_soon'
  | 'high_priority'
  | 'already_active'
  | 'quick_start'
  | 'fits_low_energy'
  | 'fits_high_energy';

export interface ScoredSuggestion<T> {
  quest: T;
  score: number;
  /** Most important first; feed to i18n as `insights:reason.<code>`. */
  reasons: SuggestReason[];
}

const DIFFICULTY_WEIGHT: Readonly<Record<Difficulty, number>> = {
  E: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  S: 5,
};

export const SUGGEST_WEIGHTS = Object.freeze({
  overdue: 40,
  dueWithin24h: 30,
  dueWithin3d: 15,
  dueWithin7d: 6,
  priority: { high: 20, medium: 10, low: 0 } as Record<Priority, number>,
  active: 8,
  quickStart: 6,
  energyFit: 10,
});

function effectiveGuess(c: SuggestCandidate): number | null {
  return c.next_step_guess_minutes ?? c.guess_minutes ?? null;
}

export function scoreQuest<T extends SuggestCandidate>(
  c: T,
  now: EpochMs,
  energy: EnergyLevel | null,
): ScoredSuggestion<T> {
  const reasons: Array<{ code: SuggestReason; weight: number }> = [];
  const due = dueAtMs(c);
  if (due !== null) {
    const until = due - now;
    if (until <= 0) reasons.push({ code: 'overdue', weight: SUGGEST_WEIGHTS.overdue });
    else if (until <= DAY_MS)
      reasons.push({
        code: until <= 12 * HOUR_MS ? 'due_today' : 'due_soon',
        weight: SUGGEST_WEIGHTS.dueWithin24h,
      });
    else if (until <= 3 * DAY_MS)
      reasons.push({ code: 'due_soon', weight: SUGGEST_WEIGHTS.dueWithin3d });
    else if (until <= 7 * DAY_MS)
      reasons.push({ code: 'due_soon', weight: SUGGEST_WEIGHTS.dueWithin7d });
  }
  // Priority always counts; only high priority is worth naming as a reason.
  let unnamed = 0;
  if (c.priority === 'high')
    reasons.push({ code: 'high_priority', weight: SUGGEST_WEIGHTS.priority.high });
  else unnamed += SUGGEST_WEIGHTS.priority[c.priority];
  if (c.status === 'active')
    reasons.push({ code: 'already_active', weight: SUGGEST_WEIGHTS.active });

  const guess = effectiveGuess(c);
  const quick = c.next_step_quick ?? (guess !== null && guess <= 5);
  if (quick) reasons.push({ code: 'quick_start', weight: SUGGEST_WEIGHTS.quickStart });

  if (energy === 'low') {
    // Prefer small and easy: full points for <= 10 min and E/D, fading to 0 for big/hard ones.
    const size = guess === null ? 0.5 : Math.max(0, 1 - Math.max(0, guess - 10) / 50);
    const ease = 1 - DIFFICULTY_WEIGHT[c.difficulty] / 5;
    const fit = (size + ease) / 2;
    if (fit > 0) reasons.push({ code: 'fits_low_energy', weight: SUGGEST_WEIGHTS.energyFit * fit });
  } else if (energy === 'high') {
    const size = guess === null ? 0.5 : Math.min(1, guess / 60);
    const hard = DIFFICULTY_WEIGHT[c.difficulty] / 5;
    const fit = (size + hard) / 2;
    if (fit > 0)
      reasons.push({ code: 'fits_high_energy', weight: SUGGEST_WEIGHTS.energyFit * fit });
  }

  const score = reasons.reduce((sum, r) => sum + r.weight, unnamed);
  const ordered = reasons
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .map((r) => r.code)
    .filter((code, i, arr) => arr.indexOf(code) === i);
  return { quest: c, score: Math.round(score * 100) / 100, reasons: ordered };
}

/**
 * Ranks open quests (inbox excluded: it is unsorted). Ties fall back to priority, then
 * due date, then id, so the result is stable.
 */
export function rankSuggestions<T extends SuggestCandidate>(
  candidates: readonly T[],
  now: EpochMs,
  energy: EnergyLevel | null,
): ScoredSuggestion<T>[] {
  return candidates
    .filter((c) => isOpenStatus(c.status) && c.status !== 'inbox')
    .map((c) => scoreQuest(c, now, energy))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const p = PRIORITY_RANK[a.quest.priority] - PRIORITY_RANK[b.quest.priority];
      if (p !== 0) return p;
      const da = dueAtMs(a.quest) ?? Infinity;
      const db = dueAtMs(b.quest) ?? Infinity;
      if (da !== db) return da - db;
      return a.quest.id < b.quest.id ? -1 : a.quest.id > b.quest.id ? 1 : 0;
    });
}

/** The single best pick, or null when there is nothing open. */
export function suggestNext<T extends SuggestCandidate>(
  candidates: readonly T[],
  now: EpochMs,
  energy: EnergyLevel | null,
): ScoredSuggestion<T> | null {
  return rankSuggestions(candidates, now, energy)[0] ?? null;
}
