/**
 * Test-only helpers for end-to-end tests. Installed only when
 * `localStorage['ql.game.testHooks'] === '1'` (set by Playwright before the page loads), so
 * players never get them. They act through the same services the app uses.
 */
import { clock, createQuest, dailyQuestsRepo, newId, writeTransaction } from '@/data';
import { DAILY_QUEST_POOL } from '@/domain/dailyQuests';
import { sequenceRng } from '@/domain/rng';
import type { Difficulty } from '@/domain/types';
import { completeStep, events, grantReward, REWARD_TABLES, type AppEvents } from '@/services';
import { listDailyQuests } from './logic/dailyQuests';

export interface GameTestHooks {
  /** Adds gold (and optional XP) as a ledger adjustment. */
  grant(gold: number, xp?: number): Promise<void>;
  /** Creates a one-step quest and finishes the step (so the quest too). No loot. */
  finishQuest(options?: {
    difficulty?: Difficulty;
    boss?: boolean;
    quick?: boolean;
  }): Promise<void>;
  /** Replaces today's daily quests with these pool keys. */
  setDailyQuests(keys: string[]): Promise<void>;
  /** Emits an app event as if another package had. */
  emit<K extends keyof AppEvents>(name: K, payload: AppEvents[K]): void;
}

export function installTestHooks(): void {
  try {
    if (typeof window === 'undefined' || localStorage.getItem('ql.game.testHooks') !== '1') return;
  } catch {
    return;
  }
  const hooks: GameTestHooks = {
    async grant(gold, xp = 0) {
      await grantReward({
        kind: 'fixed',
        ledgerKind: 'adjustment',
        sourceType: 'system',
        sourceId: 'e2e',
        dedupeKey: `e2e:${newId()}`,
        reward: { xp, gold },
      });
    },
    async finishQuest({ difficulty = 'E', boss = false, quick = true } = {}) {
      const { steps } = await createQuest({
        title: 'Test quest',
        difficulty,
        is_boss: boss,
        boss_started_at: boss ? clock.iso() : null,
        status: 'active',
        steps: [{ title: 'Tiny step', guess_minutes: 2, quick }],
      });
      await completeStep(steps[0]!.id, { rng: sequenceRng([0.99]) });
    },
    async setDailyQuests(keys) {
      const day = clock.today();
      await writeTransaction([...REWARD_TABLES], async () => {
        for (const row of await listDailyQuests(day)) await dailyQuestsRepo.remove(row.id);
        await dailyQuestsRepo.createMany(
          keys.map((key, slot) => {
            const def = DAILY_QUEST_POOL.find((d) => d.key === key)!;
            return {
              day,
              slot,
              quest_key: def.key,
              kind: def.kind,
              target: def.target,
              reward_gold: def.rewardGold,
              completed_at: null,
              rewarded_at: null,
              rerolled: false,
            };
          }),
        );
      });
    },
    emit(name, payload) {
      events.emit(name, payload);
    },
  };
  (window as unknown as { __qlGame: GameTestHooks }).__qlGame = hooks;
}
