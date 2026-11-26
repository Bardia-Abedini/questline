import { describe, expect, it } from 'vitest';
import { DAY_MS, localDateTimeToMs } from './dates';
import {
  bossHealth,
  canActivateAnother,
  clampActiveLimit,
  compareActiveQuests,
  daysUntouched,
  dueAtMs,
  isBossEligible,
  isOverdue,
  shouldAskOverdue,
  sortActiveQuests,
  type BossFields,
  type OrderingFields,
  type OverdueFields,
} from './quests';
import {
  defaultStepFor,
  isQuickByRule,
  needsNoTimerWarning,
  shouldSuggestSplittingFirstStep,
} from './steps';

const q = (over: Partial<OrderingFields> & { id: string }): OrderingFields => ({
  priority: 'medium',
  due_date: null,
  due_time: null,
  last_touched_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('active limit', () => {
  it('clamps to 1..5 with default 3', () => {
    expect([0, 1, 3, 5, 9, 2.6, Number.NaN].map(clampActiveLimit)).toEqual([1, 1, 3, 5, 5, 3, 3]);
  });
  it('allows activation below the limit only', () => {
    expect(canActivateAnother(2, 3)).toBe(true);
    expect(canActivateAnother(3, 3)).toBe(false);
    expect(canActivateAnother(4, 3)).toBe(false);
    expect(canActivateAnother(0, 0)).toBe(true); // limit clamps to 1
  });
});

describe('compareActiveQuests', () => {
  it('orders by priority first', () => {
    const list = [
      q({ id: 'l', priority: 'low' }),
      q({ id: 'h', priority: 'high' }),
      q({ id: 'm' }),
    ];
    expect(sortActiveQuests(list).map((x) => x.id)).toEqual(['h', 'm', 'l']);
  });

  it('then by due date, soonest first, none last', () => {
    const list = [
      q({ id: 'none' }),
      q({ id: 'later', due_date: '2026-03-20' }),
      q({ id: 'soon', due_date: '2026-03-12' }),
      q({ id: 'soon-morning', due_date: '2026-03-12', due_time: '09:00' }),
    ];
    expect(sortActiveQuests(list).map((x) => x.id)).toEqual([
      'soon-morning',
      'soon',
      'later',
      'none',
    ]);
  });

  it('then by last touched, most recent first (never touched last)', () => {
    const list = [
      q({ id: 'old', last_touched_at: '2026-03-01T10:00:00.000Z' }),
      q({ id: 'never' }),
      q({ id: 'recent', last_touched_at: '2026-03-09T10:00:00.000Z' }),
    ];
    expect(sortActiveQuests(list).map((x) => x.id)).toEqual(['recent', 'old', 'never']);
  });

  it('is stable by created date then id', () => {
    const list = [
      q({ id: 'b', created_at: '2026-01-02T00:00:00.000Z' }),
      q({ id: 'c' }),
      q({ id: 'a' }),
    ];
    expect(sortActiveQuests(list).map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(compareActiveQuests(list[1]!, list[1]!)).toBe(0);
  });

  it('does not mutate the input', () => {
    const list = [q({ id: 'l', priority: 'low' }), q({ id: 'h', priority: 'high' })];
    sortActiveQuests(list);
    expect(list.map((x) => x.id)).toEqual(['l', 'h']);
  });
});

describe('overdue', () => {
  const base: OverdueFields = {
    status: 'active',
    due_date: '2026-03-10',
    due_time: null,
    overdue_asked_at: null,
  };

  it('a date-only quest is due at the end of its day', () => {
    expect(dueAtMs(base)).toBe(localDateTimeToMs('2026-03-11'));
    expect(isOverdue(base, localDateTimeToMs('2026-03-10', '23:59'))).toBe(false);
    expect(isOverdue(base, localDateTimeToMs('2026-03-11'))).toBe(true);
  });

  it('a timed quest is due at its time', () => {
    const timed = { ...base, due_time: '14:30' };
    expect(isOverdue(timed, localDateTimeToMs('2026-03-10', '14:29'))).toBe(false);
    expect(isOverdue(timed, localDateTimeToMs('2026-03-10', '14:30'))).toBe(true);
  });

  it('no due date, done or archived quests are never overdue', () => {
    const later = localDateTimeToMs('2026-04-01');
    expect(isOverdue({ ...base, due_date: null }, later)).toBe(false);
    expect(isOverdue({ ...base, status: 'done' }, later)).toBe(false);
    expect(isOverdue({ ...base, status: 'archived' }, later)).toBe(false);
    expect(isOverdue({ ...base, status: 'inbox' }, later)).toBe(true);
    expect(isOverdue({ ...base, status: 'backlog' }, later)).toBe(true);
  });

  it('asks once, never twice', () => {
    const later = localDateTimeToMs('2026-04-01');
    expect(shouldAskOverdue(base, later)).toBe(true);
    expect(shouldAskOverdue({ ...base, overdue_asked_at: '2026-03-12T08:00:00.000Z' }, later)).toBe(
      false,
    );
    // Even after picking a new date that also passes.
    expect(
      shouldAskOverdue(
        { ...base, due_date: '2026-03-20', overdue_asked_at: '2026-03-12T08:00:00.000Z' },
        later,
      ),
    ).toBe(false);
  });

  it('does not ask before the due time', () => {
    expect(shouldAskOverdue(base, localDateTimeToMs('2026-03-09'))).toBe(false);
  });
});

describe('boss eligibility', () => {
  const now = Date.parse('2026-03-20T12:00:00.000Z');
  const quest: BossFields = {
    status: 'backlog',
    difficulty: 'C',
    is_boss: false,
    last_touched_at: '2026-03-19T12:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
  };

  it('any open S-rank quest is eligible', () => {
    expect(isBossEligible({ ...quest, difficulty: 'S' }, now)).toBe(true);
  });
  it('a quest untouched for 14+ days is eligible', () => {
    expect(isBossEligible(quest, now)).toBe(false);
    expect(
      isBossEligible({ ...quest, last_touched_at: new Date(now - 13 * DAY_MS).toISOString() }, now),
    ).toBe(false);
    expect(
      isBossEligible({ ...quest, last_touched_at: new Date(now - 14 * DAY_MS).toISOString() }, now),
    ).toBe(true);
  });
  it('falls back to created_at when never touched', () => {
    expect(
      daysUntouched({ last_touched_at: null, created_at: '2026-03-01T12:00:00.000Z' }, now),
    ).toBe(19);
    expect(isBossEligible({ ...quest, last_touched_at: null }, now)).toBe(true);
  });
  it('already a boss, done or archived quests are not eligible', () => {
    expect(isBossEligible({ ...quest, difficulty: 'S', is_boss: true }, now)).toBe(false);
    expect(isBossEligible({ ...quest, difficulty: 'S', status: 'done' }, now)).toBe(false);
    expect(isBossEligible({ ...quest, difficulty: 'S', status: 'archived' }, now)).toBe(false);
  });
  it('bad timestamps count as 0 days', () => {
    expect(daysUntouched({ last_touched_at: 'nope', created_at: 'nope' }, now)).toBe(0);
  });
  it('touches in the future count as 0 days', () => {
    expect(
      daysUntouched({ last_touched_at: '2027-01-01T00:00:00.000Z', created_at: '' }, now),
    ).toBe(0);
  });
});

describe('bossHealth', () => {
  it('loses equal health per finished step', () => {
    expect(bossHealth(4, 1)).toEqual({ max: 4, current: 3, fraction: 0.75 });
    expect(bossHealth(4, 4)).toEqual({ max: 4, current: 0, fraction: 0 });
  });
  it('clamps odd inputs', () => {
    expect(bossHealth(0, 0)).toEqual({ max: 1, current: 1, fraction: 1 });
    expect(bossHealth(3, 9).current).toBe(0);
    expect(bossHealth(3, -2).current).toBe(3);
  });
});

describe('quick-step rule', () => {
  it.each([
    [null, false],
    [undefined, false],
    [0, false],
    [-1, false],
    [1, true],
    [5, true],
    [5.5, false],
    [6, false],
    [Number.NaN, false],
  ])('guess %s -> quick %s', (guess, quick) => {
    expect(isQuickByRule(guess as number | null | undefined)).toBe(quick);
  });

  it('suggests splitting a first step over 5 minutes', () => {
    expect(shouldSuggestSplittingFirstStep(5)).toBe(false);
    expect(shouldSuggestSplittingFirstStep(6)).toBe(true);
    expect(shouldSuggestSplittingFirstStep(null)).toBe(false);
  });

  it('a quest with no steps gets one named after it', () => {
    expect(defaultStepFor({ title: 'Write essay', guess_minutes: 90 })).toEqual({
      title: 'Write essay',
      guess_minutes: 90,
      quick: false,
    });
    expect(defaultStepFor({ title: 'Water plants', guess_minutes: 3 }).quick).toBe(true);
  });

  it('warns once for non-quick steps checked off without a session', () => {
    expect(
      needsNoTimerWarning({ quick: false, hadFocusSession: false, alreadyWarned: false }),
    ).toBe(true);
    expect(needsNoTimerWarning({ quick: true, hadFocusSession: false, alreadyWarned: false })).toBe(
      false,
    );
    expect(needsNoTimerWarning({ quick: false, hadFocusSession: true, alreadyWarned: false })).toBe(
      false,
    );
    expect(needsNoTimerWarning({ quick: false, hadFocusSession: false, alreadyWarned: true })).toBe(
      false,
    );
  });
});
