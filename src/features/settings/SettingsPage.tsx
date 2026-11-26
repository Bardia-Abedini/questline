import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { setPreferences, usePreferences } from '@/app/preferences/preferences';
import { SettingsSection as CloudSettings } from '@/features/cloud/settings';
import { SettingsSection as FocusSettings } from '@/features/focus/settings';
import { SettingsSection as GameSettings } from '@/features/game/settings';
import { useReplayOnboarding } from '@/features/onboarding/slots';
import { SettingsSection as QuestsSettings } from '@/features/quests/settings';
import { useFormat } from '@/i18n/useFormat';
import { Button, Card, Input, Page, Section, SegmentedControl, Toggle } from '@/ui';
import { version } from '../../../package.json';

/** Lower-case, with Arabic and Persian letter forms folded, so searches match either keyboard. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').trim();
}

/**
 * Settings, in groups: Appearance, Language, Sound and vibration, then each package's own
 * sections (Quests, Focus, Rewards, Account, AI, Calendar, Reminders, Data), then About.
 * The search box hides groups whose text does not match, including the packages' sections.
 */
export function SettingsPage() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const { digits } = useFormat();
  const replay = useReplayOnboarding();
  const prefs = usePreferences();
  const save = (patch: Parameters<typeof setPreferences>[0]) => void setPreferences(patch);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(-1);

  // Filter by the rendered text of each group, so package sections are searchable too.
  useLayoutEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const q = normalize(query);
    const apply = () => {
      let count = 0;
      for (const group of Array.from(root.children) as HTMLElement[]) {
        const match = !q || normalize(group.textContent ?? '').includes(q);
        group.hidden = !match;
        if (match) count++;
      }
      setVisible(count);
    };
    apply();
    if (!q) return;
    // Package sections load their data a moment later; filter again when their text appears.
    const observer = new MutationObserver(apply);
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [query]);

  return (
    <Page title={t('title')} subtitle={t('subtitle')}>
      <div role="search">
        <Input
          type="search"
          label={t('search.label')}
          hideLabel
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      {query && visible === 0 && (
        <p role="status" className="text-muted">
          {t('search.none', { query })}
        </p>
      )}

      <div ref={listRef} className="flex flex-col gap-8">
        <Group>
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
            </Card>
          </Section>
        </Group>

        <Group>
          <Section title={t('language.title')}>
            <Card>
              <SegmentedControl
                label={t('language.label')}
                value={prefs.language}
                onChange={(language) => save({ language })}
                options={[
                  { value: 'en', label: <span lang="en">English</span> },
                  { value: 'fa', label: <span lang="fa">فارسی</span> },
                ]}
              />
            </Card>
          </Section>
        </Group>

        <Group>
          <Section title={t('sound.title')} description={t('sound.description')}>
            <Card className="flex flex-col gap-5">
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
        </Group>

        <Group>
          <QuestsSettings />
        </Group>
        <Group>
          <FocusSettings />
        </Group>
        <Group>
          <GameSettings />
        </Group>
        <Group>
          <div className="flex flex-col gap-8">
            <CloudSettings />
          </div>
        </Group>

        <Group>
          <Section title={t('about.title')}>
            <Card className="flex flex-col gap-3" data-testid="settings-about">
              <p className="font-bold text-text">
                {tc('app_name')} · {t('about.version', { version: digits(version) })}
              </p>
              <p className="text-sm text-muted">{t('about.body')}</p>
              <div className="flex flex-col gap-1">
                <div>
                  <Button variant="secondary" icon="sparkle" onClick={replay}>
                    {t('about.replay')}
                  </Button>
                </div>
                <p className="text-sm text-muted">{t('about.replay_hint')}</p>
              </div>
              <p className="text-sm text-faint">{t('about.made_with')}</p>
            </Card>
          </Section>
        </Group>
      </div>
    </Page>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}
