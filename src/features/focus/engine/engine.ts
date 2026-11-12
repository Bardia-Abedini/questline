/**
 * The focus engine runs for the whole app (started by `setup()`), on every route:
 *
 * - Ends a session when its timer runs out, at the exact moment it reached zero, whether
 *   the player is in focus mode, on another page, or reopens the app hours later. A timer
 *   that ran out while the player was not looking is saved as `ended_while_away`.
 * - Plays the chime and, when the player is away, shows a notification.
 * - Records time away (tab hidden or window unfocused) on the open focus session, and after
 *   the threshold nudges once per away period (sound + notification naming the step).
 *
 * Nothing here counts time in memory: timeouts only wake the engine up, and every decision is
 * recomputed from the stored session and `clock.now()`.
 */
import { liveQuery, type Subscription } from 'dexie';
import { usePreferences } from '@/app/preferences/preferences';
import {
  clock,
  focusSessionsRepo,
  getSingleton,
  sessionToTimerState,
  stepsRepo,
  type FocusSession,
  type Settings,
} from '@/data';
import { timerEndsAt, timerPhase } from '@/domain/timer';
import { i18next } from '@/i18n';
import { showToast } from '@/ui';
import { playChime, setChimeVolume, unlockAudio, type ChimeKind } from '../audio/audio';
import {
  msUntilNudge,
  naturalEndAt,
  nudgeDue,
  openAwayStart,
  timerEndReason,
} from '../logic/machine';
import { endSession, getOpenSession, logSessionEvent, markAway, markBack } from '../logic/sessions';
import { notificationPermission, notify, requestNotificationPermission } from './notify';

const t = () => i18next.getFixedT(null, 'focus');

/** Largest delay setTimeout handles; longer waits are re-checked. */
const MAX_DELAY = 2 ** 31 - 1;
const NOTIFY_OFFER_KEY = 'ql.focus.notifyOffered';

type Navigate = (to: string) => void;
const navigators: Navigate[] = [];

/** Lets the engine open focus mode (e.g. from a notification click). Returns a cleanup. */
export function registerNavigator(fn: Navigate): () => void {
  navigators.push(fn);
  return () => {
    const i = navigators.lastIndexOf(fn);
    if (i >= 0) navigators.splice(i, 1);
  };
}

function goToSession(id: string) {
  window.focus();
  navigators[navigators.length - 1]?.(`/focus/${id}`);
}

export function soundOn(): boolean {
  return usePreferences.getState().sound;
}

export function chime(kind: ChimeKind): void {
  if (soundOn()) playChime(kind);
}

function readOffer(): boolean {
  try {
    return localStorage.getItem(NOTIFY_OFFER_KEY) === '1';
  } catch {
    return true;
  }
}

function markOffered() {
  try {
    localStorage.setItem(NOTIFY_OFFER_KEY, '1');
  } catch {
    /* private mode: offering again later is fine */
  }
}

interface EngineState {
  session: FocusSession | null;
  settings: Settings | undefined;
  /** Visible and focused right now. */
  present: boolean;
  /** When the current present stretch began (null: not present). */
  presentSince: number | null;
  /** Away periods (by start) that already got their nudge. */
  nudged: Set<number>;
  endTimer: number | null;
  nudgeTimer: number | null;
  blurred: boolean;
}

let running: (() => void) | null = null;
const engine: EngineState = {
  session: null,
  settings: undefined,
  present: true,
  presentSince: null,
  nudged: new Set(),
  endTimer: null,
  nudgeTimer: null,
  blurred: false,
};

function isPresentNow(): boolean {
  return document.visibilityState === 'visible' && !engine.blurred;
}

function clearTimer(key: 'endTimer' | 'nudgeTimer') {
  if (engine[key] !== null) window.clearTimeout(engine[key]!);
  engine[key] = null;
}

/** Ends the open session if its timer has run out. */
async function checkEnd(): Promise<void> {
  const s = engine.session;
  if (!s) return;
  const now = clock.now();
  const state = sessionToTimerState(s);
  const endAt = naturalEndAt(state, now);
  if (endAt === null) return;
  const seenThroughEnd =
    engine.present && engine.presentSince !== null && engine.presentSince <= endAt;
  const reason =
    s.kind === 'break' ? 'timer_done' : timerEndReason(state, now, seenThroughEnd ? now : null);
  const result = await endSession(s.id, reason, { at: endAt, awaitChoice: true });
  if (!result.changed) return;
  // A timer that ran out long ago (reopened later) ends quietly; one that just ended chimes.
  const fresh = now - endAt < 60_000;
  if (fresh) chime(s.kind === 'break' ? 'break_end' : 'focus_end');
  if (fresh && !engine.present) {
    const step = s.step_id ? await stepsRepo.get(s.step_id) : undefined;
    const tr = t();
    notify({
      title: s.kind === 'break' ? tr('notify.break_end_title') : tr('notify.focus_end_title'),
      body:
        s.kind === 'break'
          ? tr('notify.break_end_body', { step: step?.title ?? '' })
          : tr('notify.focus_end_body', { step: step?.title ?? '' }),
      tag: 'ql-focus-end',
      onClick: () => goToSession(s.id),
    });
  }
}

function scheduleEnd() {
  clearTimer('endTimer');
  const s = engine.session;
  if (!s) return;
  const now = clock.now();
  const state = sessionToTimerState(s);
  const phase = timerPhase(state, now);
  if (phase === 'paused' || phase === 'ended') return;
  if (phase === 'finished') {
    void checkEnd();
    return;
  }
  const delay = Math.min(MAX_DELAY, Math.max(0, timerEndsAt(state, now) - now) + 30);
  engine.endTimer = window.setTimeout(() => {
    engine.endTimer = null;
    void checkEnd().finally(scheduleEnd);
  }, delay);
}

async function nudge(sessionId: string, awayStart: number) {
  const s = await focusSessionsRepo.get(sessionId);
  if (!s || s.ended_at !== null || s.kind !== 'focus') return;
  const now = clock.now();
  const runningNow = timerPhase(sessionToTimerState(s), now) === 'running';
  const threshold = engine.settings?.away_threshold_seconds ?? 60;
  if (
    !nudgeDue({
      awayStart: openAwayStart(s.away),
      now,
      thresholdSeconds: threshold,
      running: runningNow,
      alreadyNudged: engine.nudged.has(awayStart),
    })
  ) {
    return;
  }
  engine.nudged.add(awayStart);
  await logSessionEvent(sessionId, 'left_app');
  chime('nudge');
  const step = s.step_id ? await stepsRepo.get(s.step_id) : undefined;
  const tr = t();
  notify({
    title: tr('notify.nudge_title'),
    body: tr('notify.nudge_body', { step: step?.title ?? '' }),
    tag: 'ql-focus-nudge',
    onClick: () => goToSession(sessionId),
  });
}

function scheduleNudge() {
  clearTimer('nudgeTimer');
  const s = engine.session;
  if (!s || s.kind !== 'focus' || engine.present) return;
  const awayStart = openAwayStart(s.away);
  const threshold = engine.settings?.away_threshold_seconds ?? 60;
  if (awayStart === null || !(threshold > 0) || engine.nudged.has(awayStart)) return;
  if (s.distractions.some((d) => d.kind === 'left_app' && Date.parse(d.at) >= awayStart)) {
    engine.nudged.add(awayStart);
    return;
  }
  const delay = Math.min(MAX_DELAY, msUntilNudge(awayStart, clock.now(), threshold) + 20);
  engine.nudgeTimer = window.setTimeout(() => {
    engine.nudgeTimer = null;
    void nudge(s.id, awayStart);
  }, delay);
}

async function wentAway() {
  const s = engine.session;
  if (!s || s.kind !== 'focus' || s.ended_at !== null) return;
  await markAway(s.id);
}

async function cameBack() {
  const s = engine.session;
  if (!s || s.ended_at !== null) return;
  const awayStart = openAwayStart(s.away);
  if (awayStart === null) return;
  const wasNudged = engine.nudged.has(awayStart);
  const ms = await markBack(s.id);
  if (!wasNudged || ms <= 0) return;
  // Welcome back, gently. The first time, offer system notifications for next time.
  const tr = t();
  const offer = notificationPermission() === 'default' && !readOffer();
  if (offer) markOffered();
  showToast({
    title: tr('welcome_back.title'),
    description: tr('welcome_back.body'),
    tone: 'info',
    icon: 'heart',
    duration: offer ? 12_000 : 6000,
    action: offer
      ? { label: tr('welcome_back.allow'), onClick: () => void requestNotificationPermission() }
      : undefined,
  });
}

function onPresenceChange() {
  const present = isPresentNow();
  if (present === engine.present) return;
  engine.present = present;
  engine.presentSince = present ? clock.now() : null;
  if (present) {
    clearTimer('nudgeTimer');
    void cameBack().then(() => checkEnd());
  } else {
    void wentAway();
  }
}

function onSession(s: FocusSession | null) {
  engine.session = s;
  scheduleEnd();
  if (!s) {
    clearTimer('nudgeTimer');
    return;
  }
  if (s.kind === 'focus' && s.ended_at === null) {
    const hasOpenAway = s.away.some((a) => a.end === null);
    // Reopened while away, or the app was closed while hidden: fix up the open period.
    if (!engine.present && !hasOpenAway) void wentAway();
    if (engine.present && hasOpenAway) void cameBack();
  }
  scheduleNudge();
  // The step disappeared (deleted elsewhere): end quietly, keeping the time.
  if (s.step_id) {
    void stepsRepo.get(s.step_id).then((step) => {
      if (!step && engine.session?.id === s.id) void endSession(s.id, 'abandoned');
    });
  }
}

/** Starts the engine once. Returns a cleanup. */
export function startFocusEngine(): () => void {
  if (running) return running;
  engine.blurred = false;
  engine.present = isPresentNow();
  engine.presentSince = engine.present ? clock.now() : null;

  const subs: Subscription[] = [
    liveQuery(getOpenSession).subscribe({
      next: onSession,
      error: (e) => console.error('[focus] engine', e),
    }),
    liveQuery(() => getSingleton('settings')).subscribe({
      next: (row) => {
        engine.settings = row;
        if (row) setChimeVolume(row.sound_volume);
        scheduleNudge();
      },
      error: (e) => console.error('[focus] engine', e),
    }),
  ];

  const onVisibility = () => onPresenceChange();
  const onBlur = () => {
    engine.blurred = true;
    onPresenceChange();
  };
  const onFocus = () => {
    engine.blurred = false;
    onPresenceChange();
  };
  const onGesture = () => unlockAudio();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  window.addEventListener('pointerdown', onGesture, { capture: true });
  window.addEventListener('keydown', onGesture, { capture: true });

  running = () => {
    subs.forEach((s) => s.unsubscribe());
    clearTimer('endTimer');
    clearTimer('nudgeTimer');
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('pointerdown', onGesture, { capture: true });
    window.removeEventListener('keydown', onGesture, { capture: true });
    running = null;
  };
  return running;
}

/** Ends the open session right away if its timer is already over (used by focus mode). */
export function checkTimerNow(): void {
  void checkEnd();
}
