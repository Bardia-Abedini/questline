import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { PATHS } from '@/app/routing';
import { clock, sessionToTimerState, type Settings } from '@/data';
import { remainingMs, timerPhase } from '@/domain/timer';
import { useFormat } from '@/i18n/useFormat';
import { Button, buttonClass, showToast } from '@/ui';
import { Companion } from '../components/Companion';
import {
  FocusFrame,
  FocusTools,
  GuessVsActual,
  RewardChips,
  ViewHeading,
} from '../components/Frame';
import { ProgressRing } from '../components/ProgressRing';
import { AmbienceSheet, IdleCheckin } from '../components/Sheets';
import { lastShellPath } from '../engine/boot';
import { chime, checkTimerNow } from '../engine/engine';
import {
  useDocumentTitle,
  useFocusOnMount,
  useTick,
  useWakeLock,
  type LoadedBundle,
} from '../hooks';
import {
  continueMinutes,
  DEFAULT_BREAK_MINUTES,
  DEFAULT_FOCUS_MINUTES,
  idleCheckinDue,
  nextOpenStep,
  questGuessAndActual,
} from '../logic/machine';
import {
  clearAwaiting,
  completeStepInSession,
  endSession,
  logSessionEvent,
  sessionRewards,
  startBreak,
  startSession,
} from '../logic/sessions';
import { HISTORY_PATH } from '../paths';

/** Start a session for a step and open it. */
function useStartAndGo() {
  const navigate = useNavigate();
  return async (stepId: string, minutes?: number) => {
    const { session } = await startSession({ stepId, minutes });
    navigate(`/focus/${session.id}`, { replace: true });
  };
}

/** "Stop for now" from a result screen: nothing to save, just leave warmly. */
/**
 * "Stop for now" from a result screen: nothing more to save, just leave warmly. Back to the
 * quest's page when focus was started from there, otherwise Today.
 */
function useStopForNow(questId: string | null) {
  const { t } = useTranslation('focus');
  const navigate = useNavigate();
  return async () => {
    await clearAwaiting();
    showToast({ title: t('stopped.toast'), tone: 'info', icon: 'heart', duration: 4000 });
    const from = lastShellPath();
    navigate(questId && from === `/quests/${questId}` ? from : PATHS.today);
  };
}

/* ------------------------------------------------------------------ break */

export function BreakView({
  bundle,
  settings,
}: {
  bundle: LoadedBundle;
  settings: Settings | undefined;
}) {
  const { t } = useTranslation('focus');
  const format = useFormat();
  const { session, step } = bundle;
  const now = useTick(250);
  const state = sessionToTimerState(session);
  const remaining = remainingMs(state, now);
  const phase = timerPhase(state, now);
  const startAndGo = useStartAndGo();
  const stopForNow = useStopForNow(bundle.session.quest_id);
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const [sounds, setSounds] = useState(false);
  useEffect(() => {
    if (phase === 'finished') checkTimerNow();
  }, [phase]);
  useWakeLock(true);
  useDocumentTitle(t('doc_title.break', { time: format.timer(remaining) }));

  const backToStep = async () => {
    await endSession(session.id, 'stopped');
    if (step) await startAndGo(step.id, settings?.focus_minutes ?? DEFAULT_FOCUS_MINUTES);
  };
  const stop = async () => {
    await endSession(session.id, 'stopped');
    await stopForNow();
  };

  return (
    <FocusFrame tools={<FocusTools onSounds={() => setSounds(true)} />}>
      <ViewHeading headingRef={heading}>{t('break.title')}</ViewHeading>
      <p className="mt-2 text-center text-muted">{t('break.body')}</p>
      <ProgressRing
        progress={1 - remaining / session.planned_ms}
        tone="accent"
        className="my-6 w-[min(15rem,64vw)]"
      >
        <span className="text-sm font-bold text-muted">{t('break.label')}</span>
        <span
          role="timer"
          aria-label={t('break.label')}
          className="font-display text-5xl font-semibold tabular-nums text-text"
          data-testid="focus-timer"
        >
          {format.timer(remaining)}
        </span>
      </ProgressRing>
      <div className="flex w-full max-w-sm flex-col gap-3">
        {step && (
          <Button size="lg" icon="play" onClick={() => void backToStep()}>
            {t('break.back')}
          </Button>
        )}
        <Button variant="ghost" onClick={() => void stop()}>
          {t('time_up.stop')}
        </Button>
      </div>
      <Companion resting className="mt-auto pt-6" />
      <AmbienceSheet
        open={sounds}
        onClose={() => setSounds(false)}
        track={settings?.ambience ?? 'none'}
        volume={settings?.ambience_volume ?? 0.5}
      />
    </FocusFrame>
  );
}

export function BreakOverView({
  bundle,
  settings,
}: {
  bundle: LoadedBundle;
  settings: Settings | undefined;
}) {
  const { t } = useTranslation('focus');
  const { step } = bundle;
  const startAndGo = useStartAndGo();
  const stopForNow = useStopForNow(bundle.session.quest_id);
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <FocusFrame>
      <ViewHeading headingRef={heading}>{t('break.over_title')}</ViewHeading>
      {step && (
        <p className="mt-2 text-center text-muted">{t('break.over_body', { step: step.title })}</p>
      )}
      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        {step && !step.done_at && (
          <Button
            size="lg"
            icon="play"
            onClick={() =>
              void startAndGo(step.id, settings?.focus_minutes ?? DEFAULT_FOCUS_MINUTES)
            }
          >
            {t('break.resume')}
          </Button>
        )}
        <Button variant="ghost" onClick={() => void stopForNow()}>
          {t('time_up.stop')}
        </Button>
      </div>
      <Companion resting className="mt-10" />
    </FocusFrame>
  );
}

/* --------------------------------------------------------------- time up */

export function TimeUpView({
  bundle,
  settings,
  whileAway,
}: {
  bundle: LoadedBundle;
  settings: Settings | undefined;
  whileAway: boolean;
}) {
  const { t } = useTranslation('focus');
  const format = useFormat();
  const { session, step } = bundle;
  const startAndGo = useStartAndGo();
  const stopForNow = useStopForNow(bundle.session.quest_id);
  const navigate = useNavigate();
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const rewards = useLiveQuery(() => sessionRewards(session), [session]);
  const breakMinutes = settings?.break_minutes ?? DEFAULT_BREAK_MINUTES;
  const [busy, setBusy] = useState(false);

  const act = (fn: () => Promise<unknown>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const takeBreak = act(async () => {
    const { session: br } = await startBreak(session.id);
    navigate(`/focus/${br.id}`, { replace: true });
  });
  const keepGoing = act(async () => {
    if (step)
      await startAndGo(
        step.id,
        continueMinutes(session.planned_ms, settings?.focus_minutes ?? DEFAULT_FOCUS_MINUTES),
      );
  });
  const done = act(() => completeStepInSession(session.id));

  // "Still on it?" long after the timer ended with no input (only when they saw it end).
  const [idleOpen, setIdleOpen] = useState(false);
  const lastInput = useRef<number | null>(null);
  const now = useTick(5000, !whileAway);
  useEffect(() => {
    const onInput = () => {
      lastInput.current = clock.now();
    };
    window.addEventListener('pointerdown', onInput);
    window.addEventListener('keydown', onInput);
    return () => {
      window.removeEventListener('pointerdown', onInput);
      window.removeEventListener('keydown', onInput);
    };
  }, []);
  const asked = useRef(false);
  useEffect(() => {
    if (whileAway || asked.current || !session.ended_at) return;
    if (
      idleCheckinDue({
        endedAt: Date.parse(session.ended_at),
        lastInputAt: lastInput.current,
        now,
        minutes: settings?.idle_checkin_minutes ?? 10,
      })
    ) {
      asked.current = true;
      setIdleOpen(true);
      chime('checkin');
    }
  }, [now, whileAway, session.ended_at, settings?.idle_checkin_minutes]);
  const pulledAway = async () => {
    setIdleOpen(false);
    await logSessionEvent(session.id, 'idle');
    await stopForNow();
  };

  return (
    <FocusFrame>
      <ViewHeading headingRef={heading}>
        {whileAway ? t('time_up.away_title') : t('time_up.title')}
      </ViewHeading>
      {whileAway && <p className="mt-2 text-center text-muted">{t('time_up.away_body')}</p>}
      {step && (
        <p className="mt-3 max-w-full text-center text-lg font-bold break-words">{step.title}</p>
      )}
      <p className="mt-1 text-center text-muted">
        {t('time_up.focused', { time: format.duration(session.focused_ms) })}
      </p>
      {rewards && rewards.focus > 0 && (
        <div className="mt-3">
          <RewardChips xp={rewards.focus} gold={0} label={t('time_up.bonus')} />
        </div>
      )}
      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        <Button size="lg" icon="leaf" onClick={() => void takeBreak()} disabled={busy}>
          {t('time_up.break', { minutes: format.number(breakMinutes) })}
        </Button>
        {step && (
          <Button
            size="lg"
            variant="secondary"
            icon="play"
            onClick={() => void keepGoing()}
            disabled={busy}
          >
            {t('time_up.continue')}
          </Button>
        )}
        {step && (
          <Button variant="soft" icon="check" onClick={() => void done()} disabled={busy}>
            {t('time_up.done')}
          </Button>
        )}
        <Button variant="ghost" onClick={() => void stopForNow()}>
          {t('time_up.stop')}
        </Button>
      </div>
      <Companion className="mt-10" />
      <IdleCheckin
        open={idleOpen}
        onDone={() => {
          setIdleOpen(false);
          void done();
        }}
        onStill={() => {
          setIdleOpen(false);
          void keepGoing();
        }}
        onPulled={() => void pulledAway()}
      />
    </FocusFrame>
  );
}

/* ------------------------------------------------------- step done / finish */

export function StepDoneView({ bundle, questDone }: { bundle: LoadedBundle; questDone: boolean }) {
  const { t } = useTranslation('focus');
  const { session, step, quest, steps } = bundle;
  const startAndGo = useStartAndGo();
  const stopForNow = useStopForNow(bundle.session.quest_id);
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const rewards = useLiveQuery(() => sessionRewards(session), [session]);
  const next = nextOpenStep(steps, session.step_id);

  if (questDone && quest) {
    const q = questGuessAndActual(quest, steps);
    return (
      <FocusFrame>
        <FinishArt />
        <ViewHeading headingRef={heading}>{t('finish.title')}</ViewHeading>
        <p className="mt-2 text-center text-muted">{t('finish.body', { quest: quest.title })}</p>
        <div className="mt-6 flex w-full flex-col items-center gap-4">
          <GuessVsActual
            title={t('finish.estimate')}
            guessMinutes={q.guessMinutes}
            actualMs={q.actualMs}
          />
          {rewards && (
            <div className="flex flex-col items-center gap-2" data-testid="focus-rewards">
              <RewardChips
                xp={rewards.step.xp + rewards.focus}
                gold={rewards.step.gold + rewards.loot}
                label={t('done.rewards')}
              />
              <RewardChips
                xp={rewards.quest.xp}
                gold={rewards.quest.gold}
                label={t('finish.rewards')}
              />
            </div>
          )}
        </div>
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
          <Link
            to={PATHS.today}
            className={buttonClass('primary', 'lg')}
            onClick={() => void clearAwaiting()}
          >
            {t('finish.today')}
          </Link>
          <Link to={HISTORY_PATH} className={buttonClass('ghost')}>
            {t('finish.history')}
          </Link>
        </div>
      </FocusFrame>
    );
  }

  return (
    <FocusFrame>
      <ViewHeading headingRef={heading}>{t('done.title')}</ViewHeading>
      {step && (
        <p className="mt-2 max-w-full text-center text-lg font-bold break-words">{step.title}</p>
      )}
      <div className="mt-6 flex w-full flex-col items-center gap-4">
        {step && (
          <GuessVsActual
            title={t('done.estimate')}
            guessMinutes={step.guess_minutes}
            actualMs={step.actual_ms}
          />
        )}
        {rewards && (
          <div className="flex flex-col items-center gap-2" data-testid="focus-rewards">
            <RewardChips xp={rewards.step.xp} gold={rewards.step.gold} label={t('done.rewards')} />
            <RewardChips xp={rewards.focus} gold={0} label={t('done.focus_bonus')} />
            <RewardChips xp={0} gold={rewards.loot} label={t('done.bonus_gold')} />
          </div>
        )}
      </div>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        {next && (
          <>
            <p className="truncate text-center text-sm text-muted">
              {t('done.next_label')}: {next.title}
            </p>
            <Button size="lg" iconEnd="arrow-forward" onClick={() => void startAndGo(next.id)}>
              {t('done.next')}
            </Button>
          </>
        )}
        <Button variant={next ? 'ghost' : 'primary'} onClick={() => void stopForNow()}>
          {t('done.stop')}
        </Button>
        <Link to={HISTORY_PATH} className={buttonClass('ghost', 'sm')}>
          {t('empty.history')}
        </Link>
      </div>
    </FocusFrame>
  );
}

/** A small celebratory banner with stars for the quest finish screen. */
function FinishArt() {
  return (
    <svg viewBox="0 0 160 96" width="180" height="108" aria-hidden className="mb-2">
      <style>{`
        .ql-star { transform-box: fill-box; transform-origin: center; animation: ql-star-pop 1.6s ease-in-out infinite alternate; }
        @keyframes ql-star-pop { from { transform: scale(.8); opacity: .6 } to { transform: scale(1.1); opacity: 1 } }
      `}</style>
      <path d="M30 30h100l-10 18 10 18H30l10-18z" fill="var(--ql-primary)" />
      <path d="M44 34h72v28H44z" fill="var(--ql-primary-soft)" />
      <path
        d="M68 48l8 8 16-18"
        stroke="var(--ql-success)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        [18, 18, 7],
        [142, 16, 6],
        [80, 10, 8],
        [24, 80, 5],
        [136, 82, 6],
      ].map(([x, y, r], i) => (
        <path
          key={i}
          className="ql-star"
          style={{ animationDelay: `${i * 0.25}s` }}
          d={`M${x} ${y! - r!}l${r! * 0.3} ${r! * 0.7} ${r! * 0.7} ${r! * 0.3}-${r! * 0.7} ${r! * 0.3}-${r! * 0.3} ${r! * 0.7}-${r! * 0.3}-${r! * 0.7}-${r! * 0.7}-${r! * 0.3} ${r! * 0.7}-${r! * 0.3}z`}
          fill="var(--ql-gold)"
        />
      ))}
    </svg>
  );
}

/* ----------------------------------------------------------------- stopped */

export function StoppedView({ bundle }: { bundle: LoadedBundle }) {
  const { t } = useTranslation('focus');
  const format = useFormat();
  const { session, step } = bundle;
  const startAndGo = useStartAndGo();
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <FocusFrame>
      <ViewHeading headingRef={heading}>{t('stopped.title')}</ViewHeading>
      <p className="mt-3 text-center text-muted">
        {t('stopped.body', { time: format.duration(session.focused_ms), step: step?.title ?? '' })}
      </p>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        <Link to={PATHS.today} className={buttonClass('primary', 'lg')}>
          {t('stopped.today')}
        </Link>
        {step && !step.done_at && (
          <Button variant="secondary" icon="play" onClick={() => void startAndGo(step.id)}>
            {t('stopped.again')}
          </Button>
        )}
        <Link to={HISTORY_PATH} className={buttonClass('ghost')}>
          {t('empty.history')}
        </Link>
      </div>
      <Companion resting className="mt-10" />
    </FocusFrame>
  );
}
