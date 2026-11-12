import { useTranslation } from 'react-i18next';
import { EmptyState, Page } from '@/ui';

/** Stats and weekly recap. OWNER: Finish package (replace this placeholder). */
export function StatsPage() {
  const { t } = useTranslation('stats');
  return (
    <Page title={t('title')} subtitle={t('subtitle')}>
      <EmptyState icon="stats" title={t('empty.title')}>
        {t('empty.body')}
      </EmptyState>
    </Page>
  );
}
