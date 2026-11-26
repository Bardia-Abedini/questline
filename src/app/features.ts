/**
 * Every feature package's startup hook, run once after the database is ready.
 * Foundation-owned: already lists every package, so packages edit only their own setup.ts.
 */
import { setup as cloud } from '@/features/cloud/setup';
import { setup as focus } from '@/features/focus/setup';
import { setup as game } from '@/features/game/setup';
import { setup as insights } from '@/features/insights/setup';
import { setup as quests } from '@/features/quests/setup';

const SETUPS = { quests, focus, game, cloud, insights };

export function setupFeatures(): () => void {
  const cleanups: Array<() => void> = [];
  for (const [name, fn] of Object.entries(SETUPS)) {
    try {
      const cleanup = fn();
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    } catch (error) {
      console.error(`[setup] ${name} failed`, error);
    }
  }
  return () => cleanups.forEach((c) => c());
}
