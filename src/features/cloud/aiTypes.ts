/**
 * AI client contract (plan section 10). OWNER: Cloud. Quests and Finish code against these
 * types through `useAi()` from '@/features/cloud/slots'. The reply language follows the
 * current i18n language inside the client; callers never pass it.
 */
import type { Difficulty, Priority } from '@/domain/types';

export type AiStatus =
  /** Not signed in: AI needs an account. */
  | 'guest'
  /** Signed in, but the server has no AI key configured. */
  | 'unconfigured'
  /** No network. */
  | 'offline'
  /** The per-user daily request limit is used up. */
  | 'limit_reached'
  | 'ready';

export interface AiStepSuggestion {
  title: string;
  guessMinutes: number;
  /** Can be done without a timer. */
  quick: boolean;
}

export interface AiQuestSuggestion {
  title: string;
  notes?: string;
  priority: Priority;
  difficulty: Difficulty;
  guessMinutes: number;
  steps: AiStepSuggestion[];
}

export interface AiMetaSuggestion {
  priority: Priority;
  difficulty: Difficulty;
  guessMinutes: number;
}

export interface AiClient {
  status: AiStatus;
  /** True only when `status` is `ready`. Every method throws AiUnavailableError otherwise. */
  available: boolean;
  /** "Break it down": 3 to 7 tiny steps, the first under 5 minutes. */
  breakDown(input: { title: string; notes?: string }): Promise<AiStepSuggestion[]>;
  /** "I'm stuck": splits one step into smaller ones. */
  splitStep(input: {
    questTitle: string;
    stepTitle: string;
    guessMinutes?: number;
  }): Promise<AiStepSuggestion[]>;
  /** Auto priority, difficulty and time guess for a new quest (always overridable). */
  suggestMeta(input: { title: string; notes?: string }): Promise<AiMetaSuggestion>;
  /** Light classification of manual steps: one `quick` flag per step, same order. */
  classifyQuick(input: {
    steps: { title: string; guessMinutes: number | null }[];
  }): Promise<boolean[]>;
  /** Brain dump: a messy list becomes separate quests with steps, for review before saving. */
  brainDump(input: { text: string }): Promise<AiQuestSuggestion[]>;
  /** One-line reason for the "What should I do now?" pick. `reasons` are already-translated phrases. */
  explainPick(input: { questTitle: string; reasons: string[] }): Promise<string>;
}

/** Thrown by every AiClient method when AI is not available; carries the reason. */
export class AiUnavailableError extends Error {
  constructor(public readonly status: Exclude<AiStatus, 'ready'>) {
    super(`AI is not available: ${status}`);
    this.name = 'AiUnavailableError';
  }
}

/** A client whose every method rejects with AiUnavailableError(status). */
export function unavailableAiClient(status: Exclude<AiStatus, 'ready'>): AiClient {
  const reject = () => Promise.reject(new AiUnavailableError(status));
  return {
    status,
    available: false,
    breakDown: reject,
    splitStep: reject,
    suggestMeta: reject,
    classifyQuick: reject,
    brainDump: reject,
    explainPick: reject,
  };
}

/** localStorage flag that switches on the deterministic mock (for e2e tests of AI flows). */
export const AI_MOCK_FLAG = 'ql.ai.mock';

export function isAiMockEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(AI_MOCK_FLAG) === '1';
  } catch {
    return false;
  }
}
