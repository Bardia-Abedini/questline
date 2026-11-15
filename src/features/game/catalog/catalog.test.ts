import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en/game.json';
import fa from '@/i18n/locales/fa/game.json';
import { DEFAULT_LOOK } from '../logic/looks';
import { DAILY_QUEST_POOL } from '@/domain/dailyQuests';
import { ACHIEVEMENTS, EMPTY_STATS, isAchieved, newlyAchieved } from './achievements';
import {
  COSMETICS,
  cosmeticById,
  DEFAULT_FLOOR,
  DEFAULT_ROOM,
  DEFAULT_WALLPAPER,
  hasArt,
  itemsUnlockedAt,
  rareItemIds,
} from './cosmetics';
import { POWER_UPS } from './powerUps';
import { availableTitles, TITLES } from './titles';

function lookup(obj: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

function translated(key: string) {
  for (const locale of [en, fa]) {
    const v = lookup(locale, key);
    expect(typeof v === 'string' && v.trim().length > 0, `${key} missing`).toBe(true);
  }
}

describe('cosmetic catalogue', () => {
  it('has unique ids, art and both translations for every item', () => {
    const ids = COSMETICS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of COSMETICS) {
      expect(hasArt(item), `${item.id} has no art`).toBe(true);
      translated(item.nameKey);
    }
  });

  it('has sane prices and unlock levels', () => {
    for (const item of COSMETICS) {
      expect(Number.isInteger(item.price) && item.price >= 0 && item.price <= 400).toBe(true);
      expect(Number.isInteger(item.unlockLevel) && item.unlockLevel >= 1).toBe(true);
      expect(item.unlockLevel).toBeLessThanOrEqual(30);
      if (item.starter) expect(item.unlockLevel).toBe(1);
      if (item.rarity === 'rare') expect(item.price).toBeGreaterThanOrEqual(200);
      if (item.rarity === 'common' && !item.starter) expect(item.price).toBeLessThanOrEqual(90);
    }
  });

  it('defaults are free starter items in the right slots', () => {
    for (const id of Object.values(DEFAULT_LOOK)) {
      if (id) expect(cosmeticById(id)?.starter, id).toBe(true);
    }
    for (const [slot, id] of Object.entries(DEFAULT_ROOM)) {
      if (id) expect(cosmeticById(id)).toMatchObject({ slot, starter: true });
    }
    expect(cosmeticById(DEFAULT_WALLPAPER)?.starter).toBe(true);
    expect(cosmeticById(DEFAULT_FLOOR)?.starter).toBe(true);
  });

  it('has about 30 avatar items and 30 cottage items, a few pets and rare drops', () => {
    expect(COSMETICS.filter((c) => c.area === 'avatar').length).toBeGreaterThanOrEqual(24);
    expect(COSMETICS.filter((c) => c.area === 'cottage').length).toBeGreaterThanOrEqual(25);
    expect(COSMETICS.filter((c) => c.slot === 'pet').length).toBeGreaterThanOrEqual(2);
    expect(rareItemIds().length).toBeGreaterThan(0);
    expect(itemsUnlockedAt(5).length).toBeGreaterThan(0);
  });
});

describe('titles, power-ups and daily quests', () => {
  it('are translated', () => {
    TITLES.forEach((t) => translated(t.nameKey));
    POWER_UPS.forEach((p) => {
      translated(`powerups.${p.type}.name`);
      translated(`powerups.${p.type}.description`);
    });
    DAILY_QUEST_POOL.forEach((d) => translated(`daily.quests.${d.key}`));
  });

  it('titles unlock at milestones', () => {
    expect(availableTitles(1).map((t) => t.id)).toEqual(['title_newcomer']);
    expect(availableTitles(10)).toHaveLength(3);
  });
});

describe('achievements', () => {
  it('has about 30, unique and translated, with positive rewards', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      translated(`achievements.${a.id}.name`);
      translated(`achievements.${a.id}.hint`);
      expect(a.gold).toBeGreaterThan(0);
    }
  });

  it('none is met by a brand-new player', () => {
    expect(newlyAchieved(EMPTY_STATS, new Set())).toEqual([]);
  });

  it('conditions follow the stats', () => {
    const s = {
      ...EMPTY_STATS,
      stepsCompleted: 25,
      questsCompleted: 1,
      sRankQuests: 1,
      bossesDefeated: 1,
      activeDays: 7,
      cameBackAfterRest: true,
      focusSessions: 10,
      longestSessionMinutes: 45,
      accurateEstimates: 3,
      level: 5,
    };
    const got = newlyAchieved(s, new Set(['first_step']));
    expect(got).toEqual(
      expect.arrayContaining([
        'steps_25',
        'first_quest',
        'first_s_rank',
        'boss_defeated',
        'streak_3',
        'streak_7',
        'welcome_back',
        'first_session',
        'sessions_10',
        'deep_focus',
        'accurate_estimator',
        'level_5',
      ]),
    );
    expect(got).not.toContain('first_step');
    expect(got).not.toContain('steps_100');
    expect(got).not.toContain('streak_30');
    const steps100 = ACHIEVEMENTS.find((a) => a.id === 'steps_100')!;
    expect(steps100.progress(s)).toEqual({ current: 25, target: 100 });
    expect(isAchieved(steps100, { ...s, stepsCompleted: 120 })).toBe(true);
    expect(steps100.progress({ ...s, stepsCompleted: 120 }).current).toBe(100);
  });
});
