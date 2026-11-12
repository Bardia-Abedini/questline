/**
 * Typed app event bus. Packages react to each other through these events instead of
 * importing each other (e.g. Game listens to `step.completed` from Quests and Focus).
 *
 * Rules:
 * - Events describe facts that already happened and were saved. Emit data-changing events
 *   with `emitAfterCommit` inside a transaction, so listeners never see rolled-back changes.
 * - Listeners must not throw; errors are caught and logged so one listener cannot break others.
 * - Listeners run synchronously in subscription order; do async work without blocking.
 * - To add an event: add it to `AppEvents` below (Foundation-owned file; each package adds
 *   only its own events, in its own block) and document it in docs/CONTRIBUTING.md.
 */
import { afterCommit } from '@/data/transaction';
import type { EnergyLevel, Reward } from '@/domain/types';
import type { SessionEndReason, Uuid } from '@/data/types';
import type { GrantResult } from './rewards';

export interface AppEvents {
  /* ---- emitted by src/services (Foundation) ---- */
  /** Any reward was paid (step, finish, focus bonus, daily quest, achievement...). */
  'reward.granted': { grant: GrantResult };
  /** One event per level reached, in order. `goldGift` is already paid. */
  'level.up': { level: number; goldGift: number; milestone: boolean };
  /** Bonus gold on a step, or a rare cosmetic on a quest finish. Already saved. */
  'loot.dropped':
    | { kind: 'gold'; amount: number; stepId: Uuid }
    | { kind: 'item'; itemId: string; questId: Uuid };
  /** A step was checked off (by Quests or Focus via `completeStep`). */
  'step.completed': {
    questId: Uuid;
    stepId: Uuid;
    quick: boolean;
    /** No focus session was involved (quick steps included). */
    withoutTimer: boolean;
    /** The player confirmed the one-time no-timer warning. */
    confirmedWithoutTimer: boolean;
    sessionId: Uuid | null;
    grant: GrantResult;
  };
  'step.reopened': { questId: Uuid; stepId: Uuid };
  /** A quest was finished (all steps done or "finish quest"). */
  'quest.completed': { questId: Uuid; isBoss: boolean; recurring: boolean; grant: GrantResult };
  /** Gold was spent in the shop. */
  'gold.spent': { amount: number; sourceType: string; sourceId: string };

  /* ---- Quests package ---- */
  'quest.created': { questId: Uuid; source: string };
  'quest.activated': { questId: Uuid };
  'quest.deactivated': { questId: Uuid };
  'quest.archived': { questId: Uuid };
  'quest.became_boss': { questId: Uuid };
  /** One "Can this still be done?" answer. */
  'quest.overdue_answered': { questId: Uuid; answer: 'keep' | 'archive' };
  'inbox.sorted': { questId: Uuid };

  /* ---- Focus package ---- */
  'session.started': {
    sessionId: Uuid;
    questId: Uuid | null;
    stepId: Uuid | null;
    kind: 'focus' | 'break';
  };
  'session.ended': {
    sessionId: Uuid;
    questId: Uuid | null;
    stepId: Uuid | null;
    kind: 'focus' | 'break';
    focusedMs: number;
    reason: SessionEndReason;
  };
  'distraction.logged': { sessionId: Uuid | null; noteId: Uuid | null };

  /* ---- Game package ---- */
  'achievement.unlocked': { achievementId: string };
  'daily_quest.completed': { dailyQuestId: Uuid; reward: Reward };
  'power_up.used': { type: string; inventoryItemId: Uuid };

  /* ---- Finish package ---- */
  'energy.checked_in': { level: EnergyLevel };
}

export type AppEventName = keyof AppEvents;
export type AppEventHandler<K extends AppEventName> = (payload: AppEvents[K]) => void;

type AnyHandler = (payload: unknown) => void;

const handlers = new Map<AppEventName, Set<AnyHandler>>();

export const events = {
  /** Subscribe. Returns an unsubscribe function. */
  on<K extends AppEventName>(name: K, handler: AppEventHandler<K>): () => void {
    let set = handlers.get(name);
    if (!set) {
      set = new Set();
      handlers.set(name, set);
    }
    set.add(handler as AnyHandler);
    return () => {
      set.delete(handler as AnyHandler);
    };
  },

  /** Subscribe for one event only. */
  once<K extends AppEventName>(name: K, handler: AppEventHandler<K>): () => void {
    const off = events.on(name, (payload) => {
      off();
      handler(payload);
    });
    return off;
  },

  /** Emit now. Use for UI-only facts; for saved data use `emitAfterCommit`. */
  emit<K extends AppEventName>(name: K, payload: AppEvents[K]): void {
    const set = handlers.get(name);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[events] listener for "${name}" failed`, error);
      }
    }
  },

  /** Emit once the current database transaction commits (immediately if there is none). */
  emitAfterCommit<K extends AppEventName>(name: K, payload: AppEvents[K]): void {
    afterCommit(() => events.emit(name, payload));
  },

  /** Tests only: drop every listener. */
  clear(): void {
    handlers.clear();
  },
};
