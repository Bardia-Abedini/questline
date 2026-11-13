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
 * With several tabs open, one tab owns all of this (see ownership.ts); the others only
 * report whether the player is looking at them, and play a sound when they are.
 *
 * Nothing here counts time in memory: timeouts only wake the engine up, and every decision is
 * recomputed from the stored session and `clock.now()`.
 */
import { liveQuery, type Subscription } from 'dexie';
import { usePreferences } from '@/app/preferences/preferences';
import {
  clock,
  focusSessionsRepo,
  newId,
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
import {
  anyTabPresent,
  createOwnership,
  HEARTBEAT_MS,
  shouldPlayAlert,
  type PresenceEntry,
} from './ownership';

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
  /** The player is looking at some tab of the app (this one or another). */
  present: boolean;
  /** When the current present stretch began (null: not present). */
  presentSince: number | null;
  /** Away periods (by start) that already got their nudge. */
  nudged: Set<number>;
  endTimer: number | null;
  nudgeTimer: number | null;
  /** This window lost focus. */
  blurred: boolean;
  /** This tab owns the writes and alerts (see ownership.ts). */
  owner: boolean;
  /** Presence reported by the other tabs. */
  others: Map<string, PresenceEntry>;
}

type Message =
  | { type: 'presence'; tabId: string; present: boolean }
  | { type: 'chime'; kind: ChimeKind }
  | { type: 'welcome'; offer: boolean };

let running: (() => void) | null = null;
let channel: BroadcastChannel | null = null;
const tabId = newId();
const engine: EngineState = {
  session: null,
  settings: undefined,
  present: true,
  presentSince: null,
  nudged: new Set(),
  endTimer: null,
  nudgeTimer: null,
  blurred: false,
  owner: false,
  others: new Map(),
};

/** This tab is visible and focused. */
function selfPresent(): boolean {
  return document.visibilityState === 'visible' && !engine.blurred;
}

function post(message: Message) {
  try {
    channel?.postMessage(message);
  } catch {
    /* channel closed */
  }
}

/** Plays a sound in exactly one tab: the one being looked at, else the owner. */
function alertChime(kind: ChimeKind) {
  post({ type: 'chime', kind });
  onChimeMessage(kind);
}

function onChimeMessage(kind: ChimeKind) {
  if (
    shouldPlayAlert({
      selfPresent: selfPresent(),
      anyPresent: engine.present,
      isOwner: engine.owner,
    })
  ) {
    chime(kind);
  }
}

function showWelcome(offer: boolean) {
  if (!selfPresent()) return;
  const tr = t();
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

function clearTimer(key: 'endTimer' | 'nudgeTimer') {
  if (engine[key] !== null) window.clearTimeout(engine[key]!);
  engine[key] = null;
}

/** Ends the open session if its timer has run out. Owner tab only. */
async function checkEnd(): Promise<void> {
  const s = engine.session;
  if (!s || !engine.owner) return;
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
  if (fresh) alertChime(s.kind === 'break' ? 'break_end' : 'focus_end');
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
  if (!s || !engine.owner) return;
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
  if (!engine.owner) return;
  const s = await focusSessionsRepo.get(sessionId);
  if (!s || s.ended_at !== null || s.kind !== 'focus') return;
  const now = clock.now();
  const runningNow = timerPhase(sessionToTimerState(s), now) === 'running';
  const threshold = engine.settings?.away_threshold_seconds ?? 60;
  if (
    engine.present ||
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
  alertChime('nudge');
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
  if (!s || !engine.owner || s.kind !== 'focus' || engine.present) return;
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
  if (!s || !engine.owner || s.kind !== 'focus' || s.ended_at !== null) return;
  await markAway(s.id);
}

async function cameBack() {
  const s = engine.session;
  if (!s || !engine.owner || s.ended_at !== null) return;
  const awayStart = openAwayStart(s.away);
  if (awayStart === null) return;
  const wasNudged = engine.nudged.has(awayStart);
  const ms = await markBack(s.id);
  if (!wasNudged || ms <= 0) return;
  // Welcome back, gently, in the tab they came back to. The first time, offer notifications.
  const offer = notificationPermission() === 'default' && !readOffer();
  if (offer) markOffered();
  post({ type: 'welcome', offer });
  showWelcome(offer);
}

/** Recomputes "the player is here" from this tab and the others, and reacts to changes. */
function updatePresence() {
  const present = anyTabPresent(engine.others, selfPresent(), clock.now());
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

function onOwnPresenceChange() {
  post({ type: 'presence', tabId, present: selfPresent() });
  updatePresence();
}

function onSession(s: FocusSession | null) {
  engine.session = s;
  scheduleEnd();
  if (!s || !engine.owner) {
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
      if (!step && engine.owner && engine.session?.id === s.id) {
        void endSession(s.id, 'abandoned');
      }
    });
  }
}

/** Whether this tab currently owns the engine (for tests and diagnostics). */
export function isEngineOwner(): boolean {
  return engine.owner;
}

/** Starts the engine once. Returns a cleanup. */
export function startFocusEngine(): () => void {
  if (running) return running;
  engine.blurred = false;
  engine.others.clear();
  engine.present = selfPresent();
  engine.presentSince = engine.present ? clock.now() : null;

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('ql-focus');
    channel.onmessage = (e: MessageEvent<Message>) => {
      const m = e.data;
      if (m?.type === 'presence') {
        engine.others.set(m.tabId, { present: m.present, at: clock.now() });
        updatePresence();
      } else if (m?.type === 'chime') {
        onChimeMessage(m.kind);
      } else if (m?.type === 'welcome') {
        showWelcome(m.offer);
      }
    };
  }

  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  const ownership = createOwnership({
    tabId,
    now: () => clock.now(),
    locks: typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : null,
    storage,
    onChange: (owner) => {
      engine.owner = owner;
      if (owner) {
        // Taking over: catch up with whatever happened while another tab was in charge.
        engine.presentSince = engine.present ? clock.now() : null;
        onSession(engine.session);
      } else {
        clearTimer('endTimer');
        clearTimer('nudgeTimer');
      }
    },
  });

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

  // Heartbeat: keeps this tab's presence fresh for the others and drops stale reports.
  const heartbeat = window.setInterval(() => {
    post({ type: 'presence', tabId, present: selfPresent() });
    updatePresence();
  }, HEARTBEAT_MS);
  post({ type: 'presence', tabId, present: selfPresent() });

  const onBlur = () => {
    engine.blurred = true;
    onOwnPresenceChange();
  };
  const onFocus = () => {
    engine.blurred = false;
    onOwnPresenceChange();
  };
  const onPageHide = () => post({ type: 'presence', tabId, present: false });
  const onGesture = () => unlockAudio();
  document.addEventListener('visibilitychange', onOwnPresenceChange);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pointerdown', onGesture, { capture: true });
  window.addEventListener('keydown', onGesture, { capture: true });

  running = () => {
    subs.forEach((s) => s.unsubscribe());
    ownership.stop();
    window.clearInterval(heartbeat);
    clearTimer('endTimer');
    clearTimer('nudgeTimer');
    channel?.close();
    channel = null;
    document.removeEventListener('visibilitychange', onOwnPresenceChange);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('pagehide', onPageHide);
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
