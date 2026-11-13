import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { updateSettings, useSettings } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Button, buttonClass, Card, Input, Section, Select, Toggle, ToggleChip } from '@/ui';
import { AmbienceControls } from './components/Sheets';
import {
  notificationPermission,
  requestNotificationPermission,
  type PermissionState,
} from './engine/notify';
import { clampMinutes, DEFAULT_PRESETS } from './logic/machine';
import { HISTORY_PATH } from './paths';

const BREAK_PRESETS = [3, 5, 10, 15];
const AWAY_OPTIONS = [30, 60, 120, 300];
const IDLE_OPTIONS = [0, 5, 10, 20, 30];

/** Focus settings: lengths, pledge, nudges, check-in, notifications, ambience, history. */
export function SettingsSection() {
  const { t } = useTranslation('focus');
  const { number } = useFormat();
  const s = useSettings();
  const [perm, setPerm] = useState<PermissionState>(() => notificationPermission());
  if (!s) return null;
  const nudgeOn = s.away_threshold_seconds > 0;
  const minutesLabel = (m: number) => t('settings.minutes', { value: number(m) });
  const awayLabel = (sec: number) =>
    sec < 60
      ? t('settings.seconds', { value: number(sec) })
      : t('settings.minutes_after', { count: sec / 60, value: number(sec / 60) });

  return (
    <Section title={t('settings.title')} description={t('settings.description')}>
      <Card className="flex flex-col gap-6">
        <LengthPicker
          label={t('settings.focus_length')}
          presets={s.focus_presets?.length ? s.focus_presets : DEFAULT_PRESETS}
          value={s.focus_minutes}
          format={minutesLabel}
          onChange={(focus_minutes) => void updateSettings({ focus_minutes })}
        />
        <LengthPicker
          label={t('settings.break_length')}
          presets={BREAK_PRESETS}
          value={s.break_minutes}
          format={minutesLabel}
          onChange={(break_minutes) => void updateSettings({ break_minutes })}
        />
        <Toggle
          label={t('settings.pledge')}
          description={t('settings.pledge_hint')}
          checked={s.pledge_enabled}
          onChange={(pledge_enabled) => void updateSettings({ pledge_enabled })}
        />
        <div className="flex flex-col gap-3">
          <Toggle
            label={t('settings.nudge')}
            description={t('settings.nudge_hint')}
            checked={nudgeOn}
            onChange={(on) => void updateSettings({ away_threshold_seconds: on ? 60 : 0 })}
          />
          {nudgeOn && (
            <Select
              label={t('settings.nudge_after')}
              value={String(s.away_threshold_seconds)}
              options={[...new Set([...AWAY_OPTIONS, s.away_threshold_seconds])]
                .sort((a, b) => a - b)
                .map((v) => ({ value: String(v), label: awayLabel(v) }))}
              onChange={(e) =>
                void updateSettings({ away_threshold_seconds: Number(e.target.value) })
              }
            />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-bold text-text">{t('settings.notifications')}</p>
          <p className="text-sm text-muted">{t(`settings.notifications_${perm}`)}</p>
          {perm === 'default' && (
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => void requestNotificationPermission().then(setPerm)}
            >
              {t('settings.notifications_allow')}
            </Button>
          )}
        </div>
        <Select
          label={t('settings.idle')}
          hint={t('settings.idle_hint')}
          value={String(s.idle_checkin_minutes)}
          options={[...new Set([...IDLE_OPTIONS, s.idle_checkin_minutes])]
            .sort((a, b) => a - b)
            .map((v) => ({
              value: String(v),
              label: v === 0 ? t('settings.idle_off') : minutesLabel(v),
            }))}
          onChange={(e) => void updateSettings({ idle_checkin_minutes: Number(e.target.value) })}
        />
        <div className="flex flex-col gap-2">
          <p className="font-bold text-text">{t('settings.ambience')}</p>
          <AmbienceControls track={s.ambience} volume={s.ambience_volume} />
        </div>
        <Link to={HISTORY_PATH} className={buttonClass('secondary', 'md', 'self-start')}>
          {t('settings.history')}
        </Link>
      </Card>
    </Section>
  );
}

function LengthPicker({
  label,
  presets,
  value,
  format,
  onChange,
}: {
  label: string;
  presets: readonly number[];
  value: number;
  format: (m: number) => string;
  onChange: (minutes: number) => void;
}) {
  const { t } = useTranslation('focus');
  const [custom, setCustom] = useState('');
  const isPreset = presets.includes(value);
  const commit = () => {
    const n = Number(custom.trim());
    if (/^\d+$/.test(custom.trim()) && n >= 1) {
      onChange(clampMinutes(n));
      setCustom('');
    }
  };
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 font-bold text-text">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {[...presets, ...(isPreset ? [] : [value])].map((m) => (
          <ToggleChip key={m} selected={m === value} onChange={() => onChange(m)}>
            {format(m)}
          </ToggleChip>
        ))}
      </div>
      <Input
        label={t('settings.custom')}
        inputMode="numeric"
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        wrapperClassName="max-w-48"
      />
    </fieldset>
  );
}
