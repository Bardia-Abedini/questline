import { useId } from 'react';
import { usePreferences } from '@/app/preferences/preferences';
import { useSettings } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Button, Card, Section, SegmentedControl } from '@/ui';
import { playSound, setFxPrefs, useFxPrefs } from './effects/sounds';
import { useGameT } from './ui/hooks';

/** Game settings: reward sound volume and how big celebrations are. OWNER: Game. */
export function SettingsSection() {
  const { t } = useGameT();
  const { percent } = useFormat();
  const prefs = useFxPrefs();
  const sound = usePreferences((s) => s.sound);
  const settings = useSettings();
  const id = useId();

  return (
    <Section title={t('settings.title')}>
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="font-bold">
            {t('settings.volume')}
          </label>
          <p id={`${id}-hint`} className="text-sm text-muted">
            {t('settings.volume_hint')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={id}
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.volume}
              disabled={!sound}
              aria-describedby={`${id}-hint`}
              aria-valuetext={percent(prefs.volume)}
              onChange={(e) => setFxPrefs({ volume: Number(e.target.value) })}
              className="min-w-0 flex-1 accent-[var(--ql-primary)]"
            />
            <span className="w-12 shrink-0 text-end text-sm font-bold">
              {percent(prefs.volume)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon="volume"
              disabled={!sound}
              onClick={() => playSound('level', (settings?.sound_volume ?? 0.7) * prefs.volume)}
            >
              {t('settings.test_sound')}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <SegmentedControl
            label={t('settings.celebrations')}
            showLabel
            value={prefs.celebrations}
            onChange={(celebrations) => setFxPrefs({ celebrations })}
            options={[
              { value: 'full', label: t('settings.celebrations_full') },
              { value: 'calm', label: t('settings.celebrations_calm') },
            ]}
          />
          <p className="text-sm text-muted">{t('settings.celebrations_hint')}</p>
        </div>
      </Card>
    </Section>
  );
}
