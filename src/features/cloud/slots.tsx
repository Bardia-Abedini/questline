/**
 * Public API of the Cloud package: components mounted by the shell and the AI client hook.
 * OWNER: Cloud. Keep the export names and types; replace the bodies.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createMockAiClient } from './aiMock';
import { isAiMockEnabled, unavailableAiClient, type AiClient } from './aiTypes';

export {
  AiUnavailableError,
  AI_MOCK_FLAG,
  type AiClient,
  type AiMetaSuggestion,
  type AiQuestSuggestion,
  type AiStatus,
  type AiStepSuggestion,
} from './aiTypes';

/** Small sync indicator for the header (guest / syncing / synced / offline). */
export function SyncStatusSlot() {
  return null;
}

/**
 * The AI client. Placeholder until Cloud lands: status `guest` (unavailable), or the
 * deterministic mock when localStorage['ql.ai.mock'] === '1'. Check `available` before
 * showing AI buttons; every method throws AiUnavailableError when it is false.
 */
export function useAi(): AiClient {
  const { i18n } = useTranslation();
  // Re-created on language change so replies follow the current language.
  return useMemo(
    () => (isAiMockEnabled() ? createMockAiClient() : unavailableAiClient('guest')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language],
  );
}
