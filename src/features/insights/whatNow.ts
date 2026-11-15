/**
 * "What should I do now?" (plan sections 10 and 13): picks one quest and its next step with
 * the domain's local scoring rule (due date, priority, guess, current energy). Works
 * offline and for guests; the AI only adds a one-line reason on top.
 *
 * Only Active quests are considered for now: starting a backlog quest must go through the
 * Quests package (active limit and swap sheet), which does not export a public way yet.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { listQuestsByStatus, listSteps, type Quest, type Step } from '@/data';
import { rankSuggestions, type ScoredSuggestion, type SuggestCandidate } from '@/domain/suggest';
import type { EnergyLevel } from '@/domain/types';

export interface PickCandidate extends SuggestCandidate {
  title: string;
  /** The first open step: what Start opens in focus mode. */
  nextStep: Pick<Step, 'id' | 'title' | 'guess_minutes' | 'quick'>;
}

export type QuestPick = ScoredSuggestion<PickCandidate>;

/** Builds scoring candidates from quests and their steps. Quests with no open step are skipped. */
export function toCandidates(
  quests: readonly Quest[],
  stepsByQuest: ReadonlyMap<string, readonly Step[]>,
): PickCandidate[] {
  const out: PickCandidate[] = [];
  for (const q of quests) {
    const steps = (stepsByQuest.get(q.id) ?? []).slice().sort((a, b) => a.position - b.position);
    const next = steps.find((s) => s.done_at === null && s.deleted_at === null);
    if (!next) continue;
    out.push({
      id: q.id,
      title: q.title,
      status: q.status,
      priority: q.priority,
      difficulty: q.difficulty,
      guess_minutes: q.guess_minutes,
      due_date: q.due_date,
      due_time: q.due_time,
      next_step_guess_minutes: next.guess_minutes,
      next_step_quick: next.quick,
      nextStep: {
        id: next.id,
        title: next.title,
        guess_minutes: next.guess_minutes,
        quick: next.quick,
      },
    });
  }
  return out;
}

/** Ranked picks, best first. */
export function rankPicks(
  candidates: readonly PickCandidate[],
  now: number,
  energy: EnergyLevel | null,
): QuestPick[] {
  return rankSuggestions(candidates, now, energy);
}

/**
 * The pick to show after the player said "Not this one" `skips` times. Cycles back to the
 * start once every quest was offered, so the button never dead-ends.
 */
export function pickAt(ranked: readonly QuestPick[], skips: number): QuestPick | null {
  if (ranked.length === 0) return null;
  return ranked[((skips % ranked.length) + ranked.length) % ranked.length]!;
}

export interface PickPool {
  candidates: PickCandidate[];
  /** Quests waiting in the backlog (for the empty state). */
  backlogCount: number;
}

/** Active quests with their next step, live. `undefined` while loading. */
export function usePickPool(): PickPool | undefined {
  return useLiveQuery(async () => {
    const [active, backlog] = await Promise.all([
      listQuestsByStatus('active'),
      listQuestsByStatus('backlog'),
    ]);
    const steps = new Map<string, Step[]>();
    await Promise.all(active.map(async (q) => steps.set(q.id, await listSteps(q.id))));
    return { candidates: toCandidates(active, steps), backlogCount: backlog.length };
  }, []);
}
