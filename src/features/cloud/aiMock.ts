/**
 * Deterministic AI mock (status `ready`). Switched on with localStorage['ql.ai.mock'] = '1'
 * so packages can write e2e tests for AI flows without a server. Results are plausible,
 * derived only from the input, and written in the current language (cloud:ai_mock.*).
 * OWNER: Cloud (keep it for tests when the real client lands).
 */
import i18next from 'i18next';
import { isQuickByRule } from '@/domain/steps';
import type { Difficulty, Priority } from '@/domain/types';
import type { AiClient, AiMetaSuggestion, AiQuestSuggestion, AiStepSuggestion } from './aiTypes';

/** Artificial latency so loading states are visible in tests. */
export const AI_MOCK_DELAY_MS = 150;

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

type MockKey =
  | `break.${'gather' | 'first_bit' | 'main' | 'next' | 'polish' | 'check' | 'wrap'}`
  | `split.${'ready' | 'first_half' | 'finish'}`
  | `explain.${'with_reasons' | 'plain'}`;

/** Translates a mock text in the current language (keys: cloud:ai_mock.*). */
function tr(key: MockKey, options: Record<string, unknown> = {}): string {
  const t = i18next.t as unknown as (k: string, o: Record<string, unknown>) => string;
  return t(`cloud:ai_mock.${key}`, options);
}

const step = (title: string, guessMinutes: number): AiStepSuggestion => ({
  title,
  guessMinutes,
  quick: isQuickByRule(guessMinutes),
});

const URGENT =
  /\b(urgent|exam|test|deadline|due|today|tomorrow)\b|فوری|امتحان|آزمون|مهلت|امروز|فردا/i;
const DIFFICULTY_BY_WORDS: Difficulty[] = ['E', 'D', 'C', 'B', 'A', 'S'];
const MINUTES_BY_DIFFICULTY: Record<Difficulty, number> = {
  E: 10,
  D: 20,
  C: 30,
  B: 45,
  A: 90,
  S: 180,
};

export function mockBreakDown(title: string): AiStepSuggestion[] {
  const all = [
    step(tr('break.gather', { title }), 3),
    step(tr('break.first_bit', { title }), 10),
    step(tr('break.main', { title }), 25),
    step(tr('break.next', { title }), 15),
    step(tr('break.polish', { title }), 10),
    step(tr('break.check', { title }), 5),
    step(tr('break.wrap', { title }), 5),
  ];
  const count = 3 + (title.trim().length % 5); // 3..7, stable for the same title
  return [...all.slice(0, count - 1), all[all.length - 1]!];
}

export function mockSplitStep(stepTitle: string, guessMinutes?: number): AiStepSuggestion[] {
  const total = Math.max(6, guessMinutes ?? 15);
  return [
    step(tr('split.ready', { step: stepTitle }), 2),
    step(tr('split.first_half', { step: stepTitle }), Math.max(3, Math.round(total / 2))),
    step(tr('split.finish', { step: stepTitle }), Math.max(3, total - Math.round(total / 2))),
  ];
}

export function mockSuggestMeta(title: string, notes = ''): AiMetaSuggestion {
  const text = `${title} ${notes}`.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const difficulty = DIFFICULTY_BY_WORDS[Math.min(5, Math.floor(words / 2))]!;
  const priority: Priority = URGENT.test(text) ? 'high' : words <= 2 ? 'low' : 'medium';
  return { priority, difficulty, guessMinutes: MINUTES_BY_DIFFICULTY[difficulty] };
}

export function mockBrainDump(text: string): AiQuestSuggestion[] {
  return text
    .split(/\r?\n|;|؛/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length > 0)
    .map((title) => {
      const meta = mockSuggestMeta(title);
      return { title, ...meta, steps: mockBreakDown(title) };
    });
}

export function createMockAiClient(delayMs = AI_MOCK_DELAY_MS): AiClient {
  return {
    status: 'ready',
    available: true,
    breakDown: ({ title }) => delay(mockBreakDown(title), delayMs),
    splitStep: ({ stepTitle, guessMinutes }) =>
      delay(mockSplitStep(stepTitle, guessMinutes), delayMs),
    suggestMeta: ({ title, notes }) => delay(mockSuggestMeta(title, notes), delayMs),
    classifyQuick: ({ steps }) =>
      delay(
        steps.map((s) => isQuickByRule(s.guessMinutes)),
        delayMs,
      ),
    brainDump: ({ text }) => delay(mockBrainDump(text), delayMs),
    explainPick: ({ questTitle, reasons }) =>
      delay(
        reasons.length
          ? tr('explain.with_reasons', {
              quest: questTitle,
              reasons: reasons.join(i18next.language === 'fa' ? '، ' : ', '),
            })
          : tr('explain.plain', { quest: questTitle }),
        delayMs,
      ),
  };
}
