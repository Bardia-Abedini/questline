import { useTranslation } from 'react-i18next';
import { EmptyState, Page } from '@/ui';

/** Shop: My Rewards, Cosmetics, Power-ups. OWNER: Game package (replace this placeholder). */
export function ShopPage() {
  const { t } = useTranslation('game');
  return (
    <Page title={t('shop.title')} subtitle={t('shop.subtitle')}>
      <EmptyState icon="shop" title={t('shop.empty.title')}>
        {t('shop.empty.body')}
      </EmptyState>
    </Page>
  );
}
