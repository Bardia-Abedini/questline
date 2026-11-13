import { LIMITS } from '../../../supabase/functions/_shared/ai.ts';
import type { AiQuestSuggestion } from './aiTypes';

/** Without AI: one quest per line (bullets and numbers removed). */
export function splitLines(text: string): AiQuestSuggestion[] {
  return text
    .split(/\r?\n|;|؛/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 50)
    .map((title) => ({
      title: title.slice(0, LIMITS.title),
      priority: 'medium' as const,
      difficulty: 'C' as const,
      guessMinutes: 30,
      steps: [],
    }));
}
