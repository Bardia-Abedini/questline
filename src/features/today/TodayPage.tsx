import { useTranslation } from 'react-i18next';
import { DailyQuestsSlot } from '@/features/game/slots';
import { EnergyCheckSlot, WhatNowSlot } from '@/features/insights/slots';
import { useToday } from '@/data/useNow';
import { useFormat } from '@/i18n/useFormat';
import { EmptyState, Page } from '@/ui';

/**
 * Today board. OWNER: Quests package (replace this placeholder).
 * Layout per plan section 2: Active Quests with a big Continue button on the top one,
 * daily quests (Game slot), energy check and "What should I do now?" (Insights slots).
 */
export function TodayPage() {
  const { t } = useTranslation('today');
  const { date } = useFormat();
  const today = useToday();
  return (
    <Page title={t('title')} subtitle={date(today, 'long')}>
      <WhatNowSlot />
      <EnergyCheckSlot />
      <EmptyState icon="lantern" title={t('empty.title')}>
        {t('empty.body')}
      </EmptyState>
      <DailyQuestsSlot />
    </Page>
  );
}
