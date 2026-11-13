/**
 * Public API of the Cloud package: components mounted by the shell and the AI client hook.
 * OWNER: Cloud.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { aiStatusFrom, createRealAiClient } from './aiClient';
import { createMockAiClient } from './aiMock';
import { isAiMockEnabled, type AiClient } from './aiTypes';
import { AccountChoiceDialog } from './components/AccountChoiceDialog';
import { SyncBadge } from './components/SyncBadge';
import { useCloud } from './store';

export {
  AiUnavailableError,
  AI_MOCK_FLAG,
  type AiClient,
  type AiMetaSuggestion,
  type AiQuestSuggestion,
  type AiStatus,
  type AiStepSuggestion,
} from './aiTypes';

/**
 * Small sync indicator for the header: guest / syncing / synced / offline / error (retry).
 * Also hosts the one-time Merge / Keep account / Keep device question after sign-in.
 */
export function SyncStatusSlot() {
  return (
    <>
      <SyncBadge />
      <AccountChoiceDialog />
    </>
  );
}

/**
 * The AI client. `status` is `guest` (not signed in), `offline`, `unconfigured` (no AI key on
 * the server), `limit_reached` (daily allowance used) or `ready`. With
 * localStorage['ql.ai.mock'] === '1' it is the deterministic mock (tests). Check `available`
 * before showing AI buttons; every method throws AiUnavailableError when it is false.
 */
export function useAi(): AiClient {
  const { i18n } = useTranslation();
  const status = useCloud(aiStatusFrom);
  return useMemo(
    () => (isAiMockEnabled() ? createMockAiClient() : createRealAiClient(status)),
    // Re-created on language change so replies follow the current language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, i18n.language],
  );
}
