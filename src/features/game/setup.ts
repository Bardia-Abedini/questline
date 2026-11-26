/**
 * Runs once at app start, after the database is ready. OWNER: Game.
 * Registers rare cosmetics for loot, keeps daily quests and achievements up to date from
 * events, and applies a waiting double-XP potion to the next focus session.
 */
import { clock } from '@/data';
import { configureRewards, events, type AppEventName } from '@/services';
import { rareItemIds } from './catalog/cosmetics';
import { checkAchievements } from './logic/achievements';
import { countInboxSorted, ensureDailyQuests, evaluateDailyQuests } from './logic/dailyQuests';
import { applyPendingPotion, topUpPotionFocus, topUpPotionStep } from './logic/powerUps';
import { installTestHooks } from './testHooks';

let queue: Promise<unknown> = Promise.resolve();

/** Runs game bookkeeping one job at a time, so two events never pay the same thing twice. */
export function enqueue<T>(job: () => Promise<T>): Promise<T | undefined> {
  const next = queue.then(job).catch((error: unknown) => {
    console.warn('[game] bookkeeping failed', error);
    return undefined;
  });
  queue = next;
  return next;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Re-checks daily quests and achievements shortly after something happened. */
export function scheduleRefresh(delay = 120): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void enqueue(async () => {
      await ensureDailyQuests(clock.today());
      await evaluateDailyQuests(clock.today());
      await checkAchievements();
    });
  }, delay);
}

const TRIGGERS: AppEventName[] = [
  'step.completed',
  'quest.completed',
  'session.ended',
  'level.up',
  'daily_quest.completed',
  'power_up.used',
  'gold.spent',
  'distraction.logged',
  'energy.checked_in',
  'quest.became_boss',
];

export function setup(): (() => void) | void {
  configureRewards({ rareItemIds });
  const offs = TRIGGERS.map((name) => events.on(name, () => scheduleRefresh()));
  offs.push(
    events.on('inbox.sorted', () => {
      void enqueue(() => countInboxSorted()).then(() => scheduleRefresh());
    }),
    // Started in the same tick as the event (not queued), so this write transaction is
    // created before any step completion the player can trigger in the new session;
    // IndexedDB runs overlapping read-write transactions in creation order.
    events.on('session.started', ({ sessionId, kind }) => {
      if (kind !== 'focus') return;
      applyPendingPotion(sessionId).catch((e: unknown) => console.warn('[game] potion', e));
    }),
    // Safety net if a reward was still paid before the flag landed: top up the missing XP.
    events.on('step.completed', ({ stepId, sessionId, grant }) => {
      const reward = grant.events.find((e) => e.kind === 'step_reward');
      if (!sessionId || !reward) return;
      void enqueue(() =>
        topUpPotionStep({
          stepId,
          sessionId,
          stepRewardXp: reward.xp,
          alreadyDoubled: !!reward.meta?.double_xp,
        }),
      );
    }),
    events.on('session.ended', ({ sessionId, kind }) => {
      if (kind === 'focus') void enqueue(() => topUpPotionFocus(sessionId));
    }),
  );
  installTestHooks();
  scheduleRefresh(400);
  return () => offs.forEach((off) => off());
}
