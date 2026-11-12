import { useTranslation } from 'react-i18next';
import { setPreferences, usePreferences } from '@/app/preferences/preferences';
import { SettingsSection as CloudSettings } from '@/features/cloud/settings';
import { SettingsSection as FocusSettings } from '@/features/focus/settings';
import { SettingsSection as GameSettings } from '@/features/game/settings';
import { SettingsSection as QuestsSettings } from '@/features/quests/settings';
import { Card, Page, Section, SegmentedControl, Toggle } from '@/ui';

/**
 * Settings. OWNER: Finish package (polish, export/delete data, about).
 * The Language, Appearance and Accessibility sections are wired to the preferences store by
 * Foundation. Other packages add their sections through `src/features/<f>/settings.tsx`.
 */
export function SettingsPage() {
  const { t } = useTranslation('settings');
  const prefs = usePreferences();
  const save = (patch: Parameters<typeof setPreferences>[0]) => void setPreferences(patch);

  return (
    <Page title={t('title')} subtitle={t('subtitle')}>
      <Section title={t('language.title')}>
        <Card>
          <SegmentedControl
            label={t('language.label')}
            value={prefs.language}
            onChange={(language) => save({ language })}
            options={[
              { value: 'en', label: 'English' },
              { value: 'fa', label: 'فارسی' },
            ]}
          />
        </Card>
      </Section>

      <Section title={t('appearance.title')}>
        <Card className="flex flex-col gap-5">
          <SegmentedControl
            label={t('appearance.theme')}
            showLabel
            value={prefs.theme}
            onChange={(theme) => save({ theme })}
            options={[
              { value: 'system', label: t('appearance.theme_system') },
              { value: 'light', label: t('appearance.theme_light'), icon: 'sun' },
              { value: 'dark', label: t('appearance.theme_dark'), icon: 'moon' },
            ]}
          />
          <SegmentedControl
            label={t('appearance.text_size')}
            showLabel
            value={prefs.textSize}
            onChange={(textSize) => save({ textSize })}
            options={[
              { value: 'normal', label: t('appearance.text_normal') },
              { value: 'large', label: t('appearance.text_large') },
              { value: 'larger', label: t('appearance.text_larger') },
            ]}
          />
        </Card>
      </Section>

      <Section title={t('accessibility.title')}>
        <Card className="flex flex-col gap-5">
          <Toggle
            label={t('accessibility.dyslexic_font')}
            description={t('accessibility.dyslexic_font_hint')}
            checked={prefs.font === 'dyslexic'}
            onChange={(on) => save({ font: on ? 'dyslexic' : 'default' })}
          />
          <SegmentedControl
            label={t('accessibility.motion')}
            showLabel
            value={prefs.motion}
            onChange={(motion) => save({ motion })}
            options={[
              { value: 'system', label: t('accessibility.motion_system') },
              { value: 'reduce', label: t('accessibility.motion_reduce') },
              { value: 'full', label: t('accessibility.motion_full') },
            ]}
          />
          <Toggle
            label={t('accessibility.sound')}
            description={t('accessibility.sound_hint')}
            checked={prefs.sound}
            onChange={(sound) => save({ sound })}
          />
          <Toggle
            label={t('accessibility.haptics')}
            description={t('accessibility.haptics_hint')}
            checked={prefs.haptics}
            onChange={(haptics) => save({ haptics })}
          />
        </Card>
      </Section>

      <QuestsSettings />
      <FocusSettings />
      <GameSettings />
      <CloudSettings />
    </Page>
  );
}
