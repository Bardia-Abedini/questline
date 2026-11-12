import { useTranslation } from 'react-i18next';
import { AiUnavailableError } from '@/features/cloud/slots';
import { showToast } from '@/ui';

/** A gentle message when an AI call cannot be made right now; never an error screen. */
export function useAiErrorToast() {
  const { t } = useTranslation('quests');
  return (error: unknown) => {
    const status = error instanceof AiUnavailableError ? error.status : 'failed';
    showToast({
      title: t(`ai.unavailable.${status}`),
      description: t('ai.unavailable.fallback'),
      tone: 'info',
      icon: 'info',
    });
  };
}
