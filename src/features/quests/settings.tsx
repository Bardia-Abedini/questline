import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { clampActiveLimit, MAX_ACTIVE_LIMIT, MIN_ACTIVE_LIMIT } from '@/domain/quests';
import { updateSettings, useSettings } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Card, Section, SegmentedControl } from '@/ui';

const LIMITS = Array.from(
  { length: MAX_ACTIVE_LIMIT - MIN_ACTIVE_LIMIT + 1 },
  (_, i) => String(MIN_ACTIVE_LIMIT + i),
);

/** Quests settings: the active limit (1 to 5) and links to categories and templates. OWNER: Quests. */
export function SettingsSection() {
  const { t } = useTranslation('quests');
  const { number } = useFormat();
  const settings = useSettings();
  if (!settings) return null;
  return (
    <Section title={t('settings.title')}>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <SegmentedControl
            label={t('settings.active_limit')}
            showLabel
            value={String(clampActiveLimit(settings.active_limit))}
            onChange={(v) => void updateSettings({ active_limit: clampActiveLimit(Number(v)) })}
            options={LIMITS.map((v) => ({ value: v, label: number(Number(v)) }))}
          />
          <p className="text-sm text-muted">{t('settings.active_limit_hint')}</p>
        </div>
        <nav aria-label={t('manage.label')} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link to="/quests/categories" className="font-bold text-primary hover:underline">
            {t('categories.title')}
          </Link>
          <Link to="/quests/templates" className="font-bold text-primary hover:underline">
            {t('templates.title')}
          </Link>
        </nav>
      </Card>
    </Section>
  );
}
