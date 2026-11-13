import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { usePreferences } from '@/app/preferences/preferences';
import { parseFocusSearch, PATHS } from '@/app/routing';
import { clock, db, listSteps } from '@/data';
import { useFormat } from '@/i18n/useFormat';
import { Button, buttonClass, Icon, Spinner } from '@/ui';
import { setAmbience, stopAmbience } from './audio/audio';
import { Companion } from './components/Companion';
import { FocusFrame } from './components/Frame';
import { markBootHandled } from './engine/boot';
import { registerNavigator } from './engine/engine';
import { useFocusSettings, useSessionBundle, type LoadedBundle } from './hooks';
import { decideArrival, nextOpenStep, viewFor } from './logic/machine';
import { getAwaiting, getOpenSession, startSession } from './logic/sessions';
import { HISTORY_PATH } from './paths';
import {
  BreakOverView,
  BreakView,
  StepDoneView,
  StoppedView,
  TimeUpView,
} from './views/OtherViews';
import { TimerView } from './views/TimerView';

/**
 * Focus mode: full screen, no app chrome (plan section 3).
 *
 * - `/focus?step=<id>[&minutes=<n>]` starts a session right away (after the optional
 *   pledge) and replaces the URL with `/focus/<sessionId>`.
 * - `/focus/<sessionId>` shows whatever that stored session leads to (timer, break, time's
 *   up, done, finish, stopped), so a reload or another device lands on the same screen.
 * - `/focus` alone restores the open session (or a timer end awaiting a choice).
 */
export function FocusPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => markBootHandled(), []);
  useEffect(() => registerNavigator((to) => navigate(to)), [navigate]);
  const switchTo = (location.state as { switchTo?: string } | null)?.switchTo ?? null;
  if (sessionId) return <SessionScreen key={sessionId} sessionId={sessionId} switchTo={switchTo} />;
  return <Arrival search={location.search} />;
}

type ArrivalState =
  | { kind: 'deciding' }
  | { kind: 'pledge'; stepId: string; minutes: number | null }
  | { kind: 'empty' }
  | { kind: 'unknown_step' }
  | { kind: 'already_done'; nextStepId: string | null };

function Arrival({ search }: { search: string }) {
  const navigate = useNavigate();
  const [state, setState] = useState<ArrivalState>({ kind: 'deciding' });
  const starting = useRef(false);

  const start = async (stepId: string, minutes: number | null) => {
    if (starting.current) return;
    starting.current = true;
    const { session } = await startSession({ stepId, minutes });
    navigate(`/focus/${session.id}`, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { stepId, minutes } = parseFocusSearch(search);
      const [open, awaiting, step, settings] = await Promise.all([
        getOpenSession(),
        getAwaiting(),
        stepId ? db.steps.get(stepId) : Promise.resolve(undefined),
        db.settings.toCollection().first(),
      ]);
      if (cancelled) return;
      const d = decideArrival({
        requestedStepId: stepId,
        minutes,
        open,
        awaiting,
        step,
        now: clock.now(),
      });
      switch (d.kind) {
        case 'resume':
          navigate(`/focus/${d.sessionId}`, {
            replace: true,
            state: d.otherStepId ? { switchTo: d.otherStepId } : null,
          });
          return;
        case 'restore':
          navigate(`/focus/${d.sessionId}`, { replace: true });
          return;
        case 'start':
          if (settings?.pledge_enabled)
            setState({ kind: 'pledge', stepId: d.stepId, minutes: d.minutes });
          else await start(d.stepId, d.minutes);
          return;
        case 'step_already_done': {
          const steps = step ? await listSteps(step.quest_id) : [];
          if (!cancelled)
            setState({
              kind: 'already_done',
              nextStepId: nextOpenStep(steps, d.stepId)?.id ?? null,
            });
          return;
        }
        case 'unknown_step':
          setState({ kind: 'unknown_step' });
          return;
        case 'empty':
          setState({ kind: 'empty' });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (state.kind === 'pledge')
    return <Pledge onDone={() => void start(state.stepId, state.minutes)} />;
  if (state.kind === 'deciding') return <Loading />;
  return <QuietRoom state={state} onStart={(id) => void start(id, null)} />;
}

function Loading() {
  const { t } = useTranslation('focus');
  return (
    <FocusFrame>
      <div className="flex flex-col items-center gap-3 text-muted" role="status">
        <Spinner label={t('loading')} />
        <span>{t('loading')}</span>
      </div>
    </FocusFrame>
  );
}

function QuietRoom({
  state,
  onStart,
}: {
  state: Exclude<ArrivalState, { kind: 'deciding' } | { kind: 'pledge' }>;
  onStart: (stepId: string) => void;
}) {
  const { t } = useTranslation('focus');
  const title =
    state.kind === 'unknown_step'
      ? t('unknown_step.title')
      : state.kind === 'already_done'
        ? t('already_done.title')
        : t('empty.title');
  const body =
    state.kind === 'unknown_step'
      ? t('unknown_step.body')
      : state.kind === 'already_done'
        ? t('already_done.body')
        : t('empty.body');
  return (
    <FocusFrame>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface/60 px-6 py-10 text-center">
        <div className="mb-1 grid size-20 place-items-center rounded-full bg-primary-soft text-primary shadow-sm">
          <Icon name="timer" size={40} />
        </div>
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        <p className="text-muted">{body}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {state.kind === 'already_done' && state.nextStepId && (
            <Button onClick={() => onStart(state.nextStepId!)}>{t('already_done.next')}</Button>
          )}
          <Link to={PATHS.today} className={buttonClass('secondary')}>
            {t('empty.back')}
          </Link>
          <Link to={HISTORY_PATH} className={buttonClass('ghost')}>
            {t('empty.history')}
          </Link>
        </div>
      </div>
    </FocusFrame>
  );
}

const PLEDGE_SECONDS = 3;

/** Optional 3-second "phone away, tabs closed" moment. Skippable; off by default. */
function Pledge({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('focus');
  const { number } = useFormat();
  const [left, setLeft] = useState(PLEDGE_SECONDS);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  useEffect(() => {
    const id = window.setInterval(() => setLeft((n) => n - 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (left <= 0) doneRef.current();
  }, [left]);
  return (
    <FocusFrame>
      <h1 className="text-center text-3xl font-semibold sm:text-4xl">{t('pledge.title')}</h1>
      <p className="mt-3 text-center text-muted">{t('pledge.body')}</p>
      <p className="my-8 font-display text-6xl font-semibold tabular-nums text-primary" aria-hidden>
        {number(Math.max(left, 1))}
      </p>
      <p className="ql-visually-hidden" role="status">
        {t('pledge.count', { value: number(Math.max(left, 1)) })}
      </p>
      <Button size="lg" variant="secondary" onClick={() => doneRef.current()}>
        {t('pledge.skip')}
      </Button>
      <Companion className="mt-10" />
    </FocusFrame>
  );
}

/** Plays the chosen ambience while a timer or break runs (and the sound setting is on). */
function AmbiencePlayer({ active }: { active: boolean }) {
  const settings = useFocusSettings();
  const sound = usePreferences((s) => s.sound);
  const track = settings?.ambience ?? 'none';
  const volume = settings?.ambience_volume ?? 0.5;
  useEffect(() => {
    if (active && sound && track !== 'none') setAmbience(track, volume);
    else stopAmbience();
  }, [active, sound, track, volume]);
  useEffect(() => () => stopAmbience(), []);
  return null;
}

function SessionScreen({ sessionId, switchTo }: { sessionId: string; switchTo: string | null }) {
  const bundle = useSessionBundle(sessionId);
  const settings = useFocusSettings();
  if (bundle === undefined) return <Loading />;
  if (!bundle.session) return <QuietRoom state={{ kind: 'empty' }} onStart={() => {}} />;
  const b = bundle as LoadedBundle;
  const view = viewFor(b.session, b.step, b.quest);
  const ambient = view.kind === 'timer' || view.kind === 'break';
  let screen;
  switch (view.kind) {
    case 'timer':
      screen = <TimerView bundle={b} settings={settings} switchTo={switchTo} />;
      break;
    case 'break':
      screen = <BreakView bundle={b} settings={settings} />;
      break;
    case 'break_over':
      screen = <BreakOverView bundle={b} settings={settings} />;
      break;
    case 'time_up':
      screen = <TimeUpView bundle={b} settings={settings} whileAway={view.whileAway} />;
      break;
    case 'step_done':
      screen = <StepDoneView bundle={b} questDone={view.questDone} />;
      break;
    case 'stopped':
      screen = <StoppedView bundle={b} />;
      break;
    default:
      screen = <QuietRoom state={{ kind: 'empty' }} onStart={() => {}} />;
  }
  return (
    <>
      <AmbiencePlayer active={ambient} />
      <div key={view.kind} className="animate-fade-in">
        {screen}
      </div>
    </>
  );
}
