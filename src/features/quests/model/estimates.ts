/**
 * Turns finished quests into samples for the estimate trainer (plan section 8).
 * Actual time comes from `steps.actual_ms`, which Focus fills in; quests with no focused
 * time are skipped, since there is nothing to compare.
 */
import type { EstimateSample } from '@/domain/estimates';
import type { Quest, Step } from '@/data/types';

/** The quest's own guess, or the sum of its step guesses when it has none. */
export function questGuessMinutes(
  quest: Pick<Quest, 'guess_minutes'>,
  steps: readonly Pick<Step, 'guess_minutes'>[],
): number | null {
  if (quest.guess_minutes && quest.guess_minutes > 0) return quest.guess_minutes;
  const sum = steps.reduce(
    (t, s) => t + (s.guess_minutes && s.guess_minutes > 0 ? s.guess_minutes : 0),
    0,
  );
  return sum > 0 ? sum : null;
}

export function questActualMs(steps: readonly Pick<Step, 'actual_ms'>[]): number {
  return steps.reduce((t, s) => t + (s.actual_ms > 0 ? s.actual_ms : 0), 0);
}

export function estimateSamples(
  quests: readonly Pick<Quest, 'id' | 'status' | 'guess_minutes' | 'category_id'>[],
  stepsByQuest: ReadonlyMap<string, readonly Pick<Step, 'guess_minutes' | 'actual_ms'>[]>,
): EstimateSample[] {
  const samples: EstimateSample[] = [];
  for (const q of quests) {
    if (q.status !== 'done') continue;
    const steps = stepsByQuest.get(q.id) ?? [];
    const guess = questGuessMinutes(q, steps);
    const actualMinutes = questActualMs(steps) / 60_000;
    if (guess === null || actualMinutes <= 0) continue;
    samples.push({ guessMinutes: guess, actualMinutes, categoryId: q.category_id });
  }
  return samples;
}
