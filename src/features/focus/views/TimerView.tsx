import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { db, sessionToTimerState, type Settings, type Step } from '@/data';
import { remainingMs, runningMs, timerPhase } from '@/domain/timer';
import { useFormat } from '@/i18n/useFormat';
import { Button, Chip, cx, Icon } from '@/ui';
import { Companion } from '../components/Companion';
import { FocusFrame, FocusTools } from '../components/Frame';
import { ProgressRing } from '../components/ProgressRing';
import { AmbienceSheet, DistractionSheet, LengthSheet, StopDialog } from '../components/Sheets';
import { checkTimerNow } from '../engine/engine';
import { useDocumentTitle, useTick, useWakeLock, type LoadedBundle } from '../hooks';
import {
  DEFAULT_PRESETS,
  isFirstStep,
  JUST_START_MINUTES,
  minuteMarkCrossed,
  nextOpenStep,
} from '../logic/machine';
import {
  completeStepInSession,
  endSession,
  pauseSession,
  resumeSession,
  setSessionMinutes,
  startSession,
  stopOpenSession,
} from '../logic/sessions';

const ENTER_ARM_MS = 3000;

/** Focus mode while the timer runs or is paused. */
export function TimerView({
  bundle,
  settings,
  switchTo,
}: {
  bundle: LoadedBundle;
  settings: Settings | undefined;
  switchTo: string | null;
}) {
  const { t } = useTranslation('focus');
  const format = useFormat();
  const navigate = useNavigate();
  const { session, step, quest, steps } = bundle;
  const now = useTick(250);
  const state = sessionToTimerState(session);
  const phase = timerPhase(state, now);
  const paused = phase === 'paused';
  const remaining = remainingMs(state, now);
  const ran = runningMs(state, now);
  const progress = session.planned_ms > 0 ? 1 - remaining / session.planned_ms : 0;
  const timerText = format.timer(remaining);
  const stepTitle = step?.title ?? '';
  const next = nextOpenStep(steps, session.step_id);

  const [dialog, setDialog] = useState<null | 'stop' | 'distracted' | 'length' | 'sounds'>(null);
  const [announcement, setAnnouncement] = useState('');
  const [enterArmed, setEnterArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  // The engine ends the session when the timer runs out; nudge it if we see zero first.
  useEffect(() => {
    if (phase === 'finished') checkTimerNow();
  }, [phase]);

  useWakeLock(true);
  useDocumentTitle(
    paused
      ? t('doc_title.paused', { time: timerText, step: stepTitle })
      : t('doc_title.running', { time: timerText, step: stepTitle }),
  );

  // Screen-reader announcements: start, pause/resume, and minute marks (not every second).
  const prevRemaining = useRef(remaining);
  const announcedStart = useRef(false);
  useEffect(() => {
    if (!announcedStart.current) {
      announcedStart.current = true;
      setAnnouncement(
        t('announce.started', { time: format.duration(remaining), step: stepTitle }),
      );
    }
    const mark = paused ? null : minuteMarkCrossed(prevRemaining.current, remaining);
    prevRemaining.current = remaining;
    if (mark !== null) {
      setAnnouncement(t('announce.minutes_left', { count: mark, value: format.number(mark) }));
    }
  }, [remaining, paused, stepTitle, t, format]);

  const togglePause = useCallback(async () => {
    if (paused) {
      await resumeSession(session.id);
      setAnnouncement(t('announce.resumed'));
    } else {
      await pauseSession(session.id);
      setAnnouncement(t('announce.paused'));
    }
  }, [paused, session.id, t]);

  const done = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await completeStepInSession(session.id);
    } finally {
      setBusy(false);
    }
  }, [busy, session.id]);

  const stop = async () => {
    setDialog(null);
    await endSession(session.id, 'stopped');
  };

  // Keyboard: Space pauses/resumes, Enter twice marks done, Escape asks before stopping.
  const armTimer = useRef<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (dialog || document.querySelector('[role="dialog"]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setDialog('stop');
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'button, a, input, textarea, select, summary, [contenteditable="true"], [role="button"], [role="radio"], [role="switch"]',
        )
      ) {
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        void togglePause();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (enterArmed) {
          setEnterArmed(false);
          void done();
        } else {
          setEnterArmed(true);
          setAnnouncement(t('keys.enter_again'));
          if (armTimer.current) window.clearTimeout(armTimer.current);
          armTimer.current = window.setTimeout(() => setEnterArmed(false), ENTER_ARM_MS);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, enterArmed, togglePause, done, t]);
  useEffect(() => () => void (armTimer.current && window.clearTimeout(armTimer.current)), []);

  const offerJustStart =
    isFirstStep(steps, session.step_id) &&
    Math.round(session.planned_ms / 60_000) !== JUST_START_MINUTES &&
    ran < JUST_START_MINUTES * 60_000;

  return (
    <FocusFrame tools={<FocusTools onSounds={() => setDialog('sounds')} />}>
      <p role="status" aria-live="polite" className="ql-visually-hidden">
        {announcement}
      </p>

      {switchTo && switchTo !== session.step_id && (
        <SwitchOffer currentTitle={stepTitle} otherStepId={switchTo} navigate={navigate} />
      )}

      <div className="flex w-full min-w-0 flex-col items-center gap-1 text-center">
        {quest && (
          <p className="max-w-full truncate text-sm font-bold text-muted">
            <span className="ql-visually-hidden">{t('timer.quest')}: </span>
            {quest.title}
          </p>
        )}
        <h1 className="max-w-full text-2xl font-semibold break-words text-text sm:text-3xl">
          {stepTitle}
        </h1>
        {session.double_xp && (
          <Chip tone="xp" icon="potion" size="sm" className="mt-1">
            {t('timer.double_xp')}
          </Chip>
        )}
      </div>

      <ProgressRing
        progress={progress}
        muted={paused}
        className="my-4 w-[min(17rem,72vw)] sm:my-6 sm:w-72"
      >
        <span className="text-sm font-bold text-muted">
          {paused ? t('timer.paused') : t('timer.label')}
        </span>
        <span
          role="timer"
          aria-label={t('timer.label')}
          className={cx(
            'font-display text-6xl font-semibold tabular-nums text-text sm:text-7xl',
            paused && 'opacity-60',
          )}
          data-testid="focus-timer"
        >
          {timerText}
        </span>
        <button
          type="button"
          onClick={() => setDialog('length')}
          className="mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold text-muted hover:bg-surface-2 hover:text-text"
        >
          <Icon name="timer" size="1em" />
          {t('timer.length', {
            minutes: format.number(Math.round(session.planned_ms / 60_000)),
          })}
        </button>
      </ProgressRing>

      {offerJustStart && (
        <Button
          variant="soft"
          size="sm"
          icon="feather"
          className="-mt-2 mb-3"
          onClick={() => void setSessionMinutes(session.id, JUST_START_MINUTES)}
        >
          {t('timer.just_start')}
        </Button>
      )}

      <p className="mb-5 max-w-full truncate text-center text-muted">
        {next ? t('timer.next', { step: next.title }) : t('timer.last_step')}
      </p>

      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <Button size="lg" icon="check" onClick={() => void done()} loading={busy}>
          {t('actions.done')}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          icon={paused ? 'play' : 'pause'}
          onClick={() => void togglePause()}
        >
          {paused ? t('actions.resume') : t('actions.pause')}
        </Button>
        <Button variant="soft" icon="feather" onClick={() => setDialog('distracted')}>
          {t('actions.distracted')}
        </Button>
        <Button variant="ghost" icon="stop" onClick={() => setDialog('stop')}>
          {t('actions.stop')}
        </Button>
      </div>

      <p className="mt-4 hidden text-center text-xs text-faint md:block" aria-hidden>
        {enterArmed ? t('keys.enter_again') : t('keys.hint')}
      </p>
      {enterArmed && (
        <p className="mt-4 text-center text-sm font-bold text-primary md:hidden" aria-hidden>
          {t('keys.enter_again')}
        </p>
      )}

      <Companion className="mt-auto pt-6" />

      <StopDialog
        open={dialog === 'stop'}
        onClose={() => setDialog(null)}
        onConfirm={() => void stop()}
        focusedMs={Math.min(session.planned_ms, ran)}
      />
      <DistractionSheet
        open={dialog === 'distracted'}
        onClose={() => setDialog(null)}
        sessionId={session.id}
      />
      {dialog === 'length' && (
        <LengthSheet
          open
          onClose={() => setDialog(null)}
          session={session}
          presets={settings?.focus_presets ?? DEFAULT_PRESETS}
          runningSoFar={ran}
          offerJustStart={isFirstStep(steps, session.step_id)}
        />
      )}
      <AmbienceSheet
        open={dialog === 'sounds'}
        onClose={() => setDialog(null)}
        track={settings?.ambience ?? 'none'}
        volume={settings?.ambience_volume ?? 0.5}
      />
    </FocusFrame>
  );
}

/** A link asked for another step while this one runs: offer a one-tap switch, never force it. */
function SwitchOffer({
  currentTitle,
  otherStepId,
  navigate,
}: {
  currentTitle: string;
  otherStepId: string;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { t } = useTranslation('focus');
  const [other, setOther] = useState<Step | null | undefined>(undefined);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    void db.steps.get(otherStepId).then((s) => setOther(s && !s.deleted_at && !s.done_at ? s : null));
  }, [otherStepId]);
  if (hidden || !other) return null;
  const doSwitch = async () => {
    await stopOpenSession();
    const { session } = await startSession({ stepId: other.id });
    navigate(`/focus/${session.id}`, { replace: true });
  };
  return (
    <section
      aria-label={t('switch.title', { current: currentTitle })}
      className="mb-3 w-full rounded-lg border border-primary/25 bg-primary-soft p-3 text-sm"
    >
      <p className="font-bold text-text">{t('switch.title', { current: currentTitle })}</p>
      <p className="mt-1 text-muted">{t('switch.body', { other: other.title })}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void doSwitch()}>
          {t('switch.action')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setHidden(true)}>
          {t('switch.stay')}
        </Button>
      </div>
    </section>
  );
}
