import type { Uuid } from '@/data';
import type { QuestWithSteps } from '../hooks';

export function questPath(id: Uuid): string {
  return `/quests/${id}`;
}

export function stepProgress(steps: QuestWithSteps['steps']) {
  const done = steps.filter((s) => s.done_at !== null).length;
  return { done, total: steps.length, next: steps.find((s) => s.done_at === null) ?? null };
}
