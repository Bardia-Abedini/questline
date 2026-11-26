import { levelFromXp, type LevelInfo } from '@/domain/levels';
import { computeStreak, type StreakResult } from '@/domain/streak';
import type { LocalDate } from '@/domain/dates';
import { activeDays, getSingleton, ledgerTotals } from './repositories';

export interface PlayerStats {
  /** Lifetime XP. */
  xp: number;
  /** Spendable gold. */
  gold: number;
  level: LevelInfo;
  streak: StreakResult;
}

/** Everything the header shows, derived from the ledger (nothing here is stored). */
export async function getPlayerStats(today: LocalDate): Promise<PlayerStats> {
  const [totals, days, streakState] = await Promise.all([
    ledgerTotals(),
    activeDays(),
    getSingleton('streak_state'),
  ]);
  const streak = computeStreak({ activeDays: days, today });
  return {
    xp: totals.xp,
    gold: totals.gold,
    level: levelFromXp(totals.xp),
    streak: { ...streak, best: Math.max(streak.best, streakState?.best ?? 0) },
  };
}
