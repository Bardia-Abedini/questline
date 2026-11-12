import { useTranslation } from 'react-i18next';
import { EmptyState, Page } from '@/ui';

/** Backlog / Inbox / Done / Archive. OWNER: Quests package (replace this placeholder). */
export function QuestsPage() {
  const { t } = useTranslation('quests');
  return (
    <Page title={t('title')} subtitle={t('subtitle')}>
      <EmptyState icon="quests" title={t('empty.title')}>
        {t('empty.body')}
      </EmptyState>
    </Page>
  );
}
