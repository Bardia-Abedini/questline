import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '@/app/preferences/preferences';
import { updateSettings, type AmbienceTrack, type FocusSession } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import {
  Button,
  Input,
  Modal,
  SegmentedControl,
  Sheet,
  showToast,
  Textarea,
  ToggleChip,
} from '@/ui';
import { clampMinutes, JUST_START_MINUTES, MAX_MINUTES, selectablePreset } from '../logic/machine';
import { logDistraction, setSessionMinutes } from '../logic/sessions';

/** "I got distracted": park a thought in the Inbox, then straight back to the timer. */
export function DistractionSheet({
  open,
  onClose,
  sessionId,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
}) {
  const { t } = useTranslation('focus');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await logDistraction({ sessionId, text });
      showToast({
        title: r.noteId ? t('distraction.saved') : t('distraction.logged'),
        tone: 'info',
        icon: 'inbox',
        duration: 2500,
      });
      setText('');
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('distraction.title')}
      description={t('distraction.description')}
      dismissOnBackdrop={!text}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('distraction.cancel')}
          </Button>
          <Button type="submit" form="ql-distraction-form" loading={busy}>
            {text.trim() ? t('distraction.save') : t('distraction.log_only')}
          </Button>
        </>
      }
    >
      <form id="ql-distraction-form" onSubmit={submit}>
        <Textarea
          label={t('distraction.label')}
          placeholder={t('distraction.placeholder')}
          value={text}
          rows={2}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
      </form>
    </Sheet>
  );
}

/** Escape or Stop asks first. Warm wording: the time is kept. */
export function StopDialog({
  open,
  onClose,
  onConfirm,
  focusedMs,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  focusedMs: number;
}) {
  const { t } = useTranslation('focus');
  const { duration } = useFormat();
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('stop.title')}
      description={t('stop.body', { time: duration(focusedMs) })}
      size="sm"
      initialFocus={keepRef}
      footer={
        <>
          <Button variant="secondary" ref={keepRef} onClick={onClose}>
            {t('stop.keep')}
          </Button>
          <Button variant="soft" onClick={onConfirm}>
            {t('stop.confirm')}
          </Button>
        </>
      }
    />
  );
}

/** Change the length of the running timer: presets, "just 5 minutes", or a custom value. */
export function LengthSheet({
  open,
  onClose,
  session,
  presets,
  runningSoFar,
  offerJustStart,
}: {
  open: boolean;
  onClose: () => void;
  session: FocusSession;
  presets: readonly number[];
  runningSoFar: number;
  offerJustStart: boolean;
}) {
  const { t } = useTranslation('focus');
  const { number } = useFormat();
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const current = Math.round(session.planned_ms / 60_000);
  const options = [...new Set([...(offerJustStart ? [JUST_START_MINUTES] : []), ...presets])].sort(
    (a, b) => a - b,
  );
  const pick = async (minutes: number) => {
    await setSessionMinutes(session.id, minutes);
    onClose();
  };
  const submitCustom = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(custom.trim());
    if (!/^\d+$/.test(custom.trim()) || n < 1 || n > MAX_MINUTES) {
      setError(t('length.invalid'));
      return;
    }
    if (!selectablePreset(n, runningSoFar)) {
      setError(t('length.invalid'));
      return;
    }
    setError(null);
    setCustom('');
    void pick(clampMinutes(n));
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('length.title')}
      description={t('length.description')}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <div role="group" aria-label={t('length.presets')} className="flex flex-wrap gap-2">
          {options.map((m) => (
            <ToggleChip
              key={m}
              selected={m === current}
              disabled={!selectablePreset(m, runningSoFar)}
              onChange={() => void pick(m)}
            >
              {t('length.minutes', { count: m, value: number(m) })}
            </ToggleChip>
          ))}
        </div>
        <form onSubmit={submitCustom} className="flex items-end gap-2">
          <Input
            label={t('length.custom')}
            inputMode="numeric"
            value={custom}
            error={error ?? undefined}
            onChange={(e) => setCustom(e.target.value)}
            wrapperClassName="min-w-0 flex-1"
          />
          <Button type="submit" variant="secondary" className="mb-0 shrink-0 self-end">
            {t('length.set')}
          </Button>
        </form>
      </div>
    </Sheet>
  );
}

const AMBIENCE_TRACKS: readonly AmbienceTrack[] = ['none', 'rain', 'cafe', 'lofi', 'brown_noise'];

/** The ambience controls (track and volume), shared by focus mode and settings. */
export function AmbienceControls({ track, volume }: { track: AmbienceTrack; volume: number }) {
  const { t } = useTranslation('focus');
  const sound = usePreferences((s) => s.sound);
  const [local, setLocal] = useState(volume);
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t('ambience.track')}
        showLabel
        value={track}
        onChange={(ambience) => void updateSettings({ ambience })}
        options={AMBIENCE_TRACKS.map((v) => ({ value: v, label: t(`ambience.${v}`) }))}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-text">{t('ambience.volume')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={local}
          disabled={track === 'none'}
          onChange={(e) => setLocal(Number(e.target.value))}
          onPointerUp={() => void updateSettings({ ambience_volume: local })}
          onKeyUp={() => void updateSettings({ ambience_volume: local })}
          onBlur={() => void updateSettings({ ambience_volume: local })}
          className="w-full accent-[var(--ql-primary)] disabled:opacity-50"
        />
      </label>
      {!sound && <p className="text-sm text-muted">{t('ambience.sound_off')}</p>}
    </div>
  );
}

export function AmbienceSheet({
  open,
  onClose,
  track,
  volume,
}: {
  open: boolean;
  onClose: () => void;
  track: AmbienceTrack;
  volume: number;
}) {
  const { t } = useTranslation('focus');
  return (
    <Sheet open={open} onClose={onClose} title={t('ambience.title')} size="sm">
      <AmbienceControls track={track} volume={volume} />
    </Sheet>
  );
}

/** "Still on it?" long after the timer ended with no input. */
export function IdleCheckin({
  open,
  onDone,
  onStill,
  onPulled,
}: {
  open: boolean;
  onDone: () => void;
  onStill: () => void;
  onPulled: () => void;
}) {
  const { t } = useTranslation('focus');
  return (
    <Modal
      open={open}
      onClose={onStill}
      title={t('idle.title')}
      description={t('idle.body')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onPulled}>
            {t('idle.pulled')}
          </Button>
          <Button variant="secondary" onClick={onStill}>
            {t('idle.still')}
          </Button>
          <Button onClick={onDone} icon="check">
            {t('idle.done')}
          </Button>
        </>
      }
    />
  );
}
