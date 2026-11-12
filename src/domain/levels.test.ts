import { describe, expect, it } from 'vitest';
import {
  cottageTier,
  isMilestoneLevel,
  levelFromXp,
  levelsGained,
  levelUpGold,
  totalXpForLevel,
  xpForNextLevel,
} from './levels';

describe('xpForNextLevel', () => {
  it.each([
    [1, 100],
    [2, 150],
    [3, 200],
    [10, 550],
    [50, 2550],
  ])('level %d needs %d XP for the next level', (level, xp) => {
    expect(xpForNextLevel(level)).toBe(xp);
  });

  it('treats levels below 1 as level 1', () => {
    expect(xpForNextLevel(0)).toBe(100);
    expect(xpForNextLevel(-4)).toBe(100);
  });
});

describe('totalXpForLevel', () => {
  it('is the running sum of the curve', () => {
    let sum = 0;
    for (let level = 1; level <= 100; level++) {
      expect(totalXpForLevel(level)).toBe(sum);
      sum += xpForNextLevel(level);
    }
  });
  it.each([
    [1, 0],
    [2, 100],
    [3, 250],
    [4, 450],
    [5, 700],
  ])('level %d starts at %d XP', (level, xp) => {
    expect(totalXpForLevel(level)).toBe(xp);
  });
});

describe('levelFromXp', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(levelFromXp(0)).toEqual({
      level: 1,
      xpIntoLevel: 0,
      xpForNext: 100,
      xpToNext: 100,
      progress: 0,
    });
  });

  it('levels up exactly on the boundary', () => {
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(249).level).toBe(2);
    expect(levelFromXp(250).level).toBe(3);
  });

  it('reports progress within the level', () => {
    const info = levelFromXp(175);
    expect(info).toEqual({
      level: 2,
      xpIntoLevel: 75,
      xpForNext: 150,
      xpToNext: 75,
      progress: 0.5,
    });
  });

  it('agrees with totalXpForLevel at every boundary up to level 500', () => {
    for (let level = 1; level <= 500; level++) {
      const start = totalXpForLevel(level);
      expect(levelFromXp(start).level).toBe(level);
      if (start > 0) expect(levelFromXp(start - 1).level).toBe(level - 1);
    }
  });

  it('handles very large totals', () => {
    const xp = totalXpForLevel(10_000) + 5;
    expect(levelFromXp(xp).level).toBe(10_000);
  });

  it('treats negative, fractional and invalid totals safely', () => {
    expect(levelFromXp(-50).level).toBe(1);
    expect(levelFromXp(100.9).level).toBe(2);
    expect(levelFromXp(Number.NaN).level).toBe(1);
  });
});

describe('milestones', () => {
  it('marks every fifth level', () => {
    expect([1, 4, 5, 6, 10, 15, 16, 0].map(isMilestoneLevel)).toEqual([
      false,
      false,
      true,
      false,
      true,
      true,
      false,
      false,
    ]);
  });
  it('cottage tier grows at milestones', () => {
    expect([1, 4, 5, 9, 10, 24, 25].map(cottageTier)).toEqual([0, 0, 1, 1, 2, 4, 5]);
  });
});

describe('levelUpGold', () => {
  it('gives 10 x level, plus 50 on milestones', () => {
    expect(levelUpGold(2)).toBe(20);
    expect(levelUpGold(4)).toBe(40);
    expect(levelUpGold(5)).toBe(100);
    expect(levelUpGold(10)).toBe(150);
  });
  it('gives nothing for level 1 or below', () => {
    expect(levelUpGold(1)).toBe(0);
    expect(levelUpGold(0)).toBe(0);
  });
});

describe('levelsGained', () => {
  it('lists every level reached in order', () => {
    expect(levelsGained(90, 460)).toEqual([2, 3, 4]);
  });
  it('is empty when no level is reached or XP goes down', () => {
    expect(levelsGained(0, 99)).toEqual([]);
    expect(levelsGained(300, 100)).toEqual([]);
  });
});
