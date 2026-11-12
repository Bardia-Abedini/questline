import { useTranslation } from 'react-i18next';
import { EmptyState, Page } from '@/ui';

/** Avatar and cottage. OWNER: Game package (replace this placeholder). */
export function HomePage() {
  const { t } = useTranslation('game');
  return (
    <Page title={t('home.title')} subtitle={t('home.subtitle')}>
      <EmptyState icon="home" title={t('home.empty.title')}>
        {t('home.empty.body')}
      </EmptyState>
    </Page>
  );
}
