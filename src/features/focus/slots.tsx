/** Public components of the Focus package, mounted by the app shell. OWNER: Focus. */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { clock, db, sessionToTimerState, useOpenFocusSession } from '@/data';
import { remainingMs, timerPhase } from '@/domain/timer';
import { useFormat } from '@/i18n/useFormat';
import { buttonClass, Icon } from '@/ui';
import { claimBootRedirect } from './engine/boot';
import { registerNavigator } from './engine/engine';
import { useAwaiting, useTick } from './hooks';
import { liveAwaiting, restoreTarget } from './logic/machine';

/**
 * Banner for an open session (running, paused, on a break) or a timer end still waiting
 * for a choice, with a way back into focus mode. Rendered at the top of every shell page.
 * On app open with a running session, it brings the player straight back (once per visit).
 */
export function ActiveSessionSlot() {
  const { t } = useTranslation('focus');
  const format = useFormat();
  const navigate = useNavigate();
  const open = useOpenFocusSession();
  const awaitingRow = useAwaiting();
  const loaded = open !== undefined && awaitingRow !== undefined;
  const awaiting = loaded ? liveAwaiting(awaitingRow, clock.now()) : null;

  useEffect(() => registerNavigator((to) => navigate(to)), [navigate]);
  useEffect(() => {
    if (!loaded) return;
    if (!claimBootRedirect()) return;
    const target = restoreTarget(open, awaitingRow, clock.now());
    if (target) navigate(`/focus/${target}`, { replace: true });
  }, [loaded, open, awaitingRow, navigate]);

  const sessionId = open?.id ?? awaiting?.session_id ?? null;
  const session = useLiveQuery(
    async () => (sessionId ? db.focus_sessions.get(sessionId) : undefined),
    [sessionId],
  );
  const step = useLiveQuery(
    async () => (session?.step_id ? db.steps.get(session.step_id) : undefined),
    [session?.step_id],
  );
  const now = useTick(1000, !!open);
  if (!loaded || !sessionId || !session) return null;

  const stepTitle = step?.title ?? '';
  let title: string;
  let detail: string;
  if (session.ended_at === null) {
    const state = sessionToTimerState(session);
    const time = format.timer(remainingMs(state, now));
    const paused = timerPhase(state, now) === 'paused';
    if (session.kind === 'break') {
      title = t('banner.break');
      detail = t('banner.left', { time });
    } else {
      title = paused
        ? t('banner.paused', { step: stepTitle })
        : t('banner.focusing', { step: stepTitle });
      detail = paused ? t('banner.paused_short', { time }) : t('banner.left', { time });
    }
  } else {
    title =
      session.end_reason === 'ended_while_away'
        ? t('banner.away')
        : t('banner.time_up', { step: stepTitle });
    detail = t('banner.choose');
  }

  return (
    <section
      aria-label={t('banner.label')}
      data-testid="focus-banner"
      className="mx-auto mb-5 flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-lg border border-primary/25 bg-primary-soft px-4 py-3 shadow-sm"
    >
      <Icon name="timer" size={24} className="shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-text">{title}</p>
        <p className="text-sm tabular-nums text-muted">{detail}</p>
      </div>
      <Link to={`/focus/${sessionId}`} className={buttonClass('primary', 'sm', 'shrink-0')}>
        {t('banner.back')}
      </Link>
    </section>
  );
}
