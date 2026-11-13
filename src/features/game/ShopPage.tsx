import { useSearchParams } from 'react-router';
import { useFormat } from '@/i18n/useFormat';
import { Chip, Page, Tabs } from '@/ui';
import { CosmeticsTab } from './shop/CosmeticsTab';
import { PowerUpsTab } from './shop/PowerUpsTab';
import { RewardsTab } from './shop/RewardsTab';
import { useGameT, useGold } from './ui/hooks';

type ShopTab = 'rewards' | 'cosmetics' | 'powerups';
const TABS: ShopTab[] = ['rewards', 'cosmetics', 'powerups'];

/** Shop: My Rewards, Cosmetics, Power-ups. OWNER: Game. */
export function ShopPage() {
  const { t } = useGameT();
  const { number } = useFormat();
  const gold = useGold();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: ShopTab = TABS.includes(raw as ShopTab) ? (raw as ShopTab) : 'rewards';

  return (
    <Page
      title={t('shop.title')}
      subtitle={t('shop.subtitle')}
      actions={
        <Chip tone="gold" icon="coin" data-testid="shop-balance">
          {t('shop.balance', { gold: number(gold) })}
        </Chip>
      }
    >
      <Tabs
        label={t('shop.tabs_label')}
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        items={[
          { value: 'rewards', label: t('shop.tab_rewards'), icon: 'gift', content: <RewardsTab /> },
          {
            value: 'cosmetics',
            label: t('shop.tab_cosmetics'),
            icon: 'palette',
            content: <CosmeticsTab />,
          },
          {
            value: 'powerups',
            label: t('shop.tab_powerups'),
            icon: 'potion',
            content: <PowerUpsTab />,
          },
        ]}
      />
    </Page>
  );
}
