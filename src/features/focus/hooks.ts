import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { clock, db, getSingleton, listSteps, type Uuid } from '@/data';
import { AWAITING_KEY, getAwaiting } from './logic/sessions';

/**
 * The current time, re-read from `clock` every `intervalMs`. Only for display: the timer
 * value itself always comes from stored timestamps through the domain timer functions.
 */
export function useTick(intervalMs = 250, active = true): number {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(clock.now()), intervalMs);
    const onVisible = () => setNow(clock.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, active]);
  return now;
}

/** A session with its step, quest and the quest's steps, live. Undefined while loading. */
export function useSessionBundle(sessionId: Uuid) {
  return useLiveQuery(async () => {
    const session = await db.focus_sessions.get(sessionId);
    if (!session || session.deleted_at !== null) return { session: null } as const;
    const [step, quest, steps] = await Promise.all([
      session.step_id ? db.steps.get(session.step_id) : undefined,
      session.quest_id ? db.quests.get(session.quest_id) : undefined,
      session.quest_id ? listSteps(session.quest_id) : Promise.resolve([]),
    ]);
    return {
      session,
      step: step && step.deleted_at === null ? step : null,
      quest: quest && quest.deleted_at === null ? quest : null,
      steps,
    } as const;
  }, [sessionId]);
}

export type SessionBundle = NonNullable<ReturnType<typeof useSessionBundle>>;
export type LoadedBundle = Extract<SessionBundle, { step: unknown }>;

/** The timer end waiting for a choice on this device (null when none). */
export function useAwaiting() {
  return useLiveQuery(async () => {
    await db.local_meta.get(AWAITING_KEY); // subscribe to the row
    return getAwaiting();
  }, []);
}

export function useFocusSettings() {
  return useLiveQuery(() => getSingleton('settings'), []);
}

/** Keeps the screen awake while `active`, where the Wake Lock API exists. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) void next.release().catch(() => {});
        else lock = next;
      } catch {
        /* not allowed right now (hidden tab, battery saver); retried when visible */
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

/** Sets the document title while mounted and restores the previous one afterwards. */
export function useDocumentTitle(title: string | null): void {
  const original = useRef<string | null>(null);
  useEffect(() => {
    original.current = document.title;
    return () => {
      if (original.current !== null) document.title = original.current;
    };
  }, []);
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}

/** Moves keyboard and screen-reader focus to the element on mount (a view's heading). */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}
