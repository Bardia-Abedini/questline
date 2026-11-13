import { describe, expect, it } from 'vitest';
import type { Tag } from '@/data';
import {
  addStep,
  filledSteps,
  firstStepGuess,
  isRecurrenceComplete,
  makeStep,
  moveStep,
  parseMinutes,
  removeStep,
  replaceStep,
  sumStepGuesses,
  toggleStepQuick,
  updateStepGuess,
} from './draft';
import { estimateSamples, questGuessMinutes } from './estimates';
import { activeFilterCount, filterQuests, NO_FILTERS, normalizeForSearch } from './filters';

describe('draft steps', () => {
  it('parses minutes typed in any digits', () => {
    expect(parseMinutes('15')).toBe(15);
    expect(parseMinutes('۴۵')).toBe(45);
    expect(parseMinutes('٢٠')).toBe(20);
    expect(parseMinutes(' 2.6 ')).toBe(3);
    expect(parseMinutes('0')).toBeNull();
    expect(parseMinutes('abc')).toBeNull();
    expect(parseMinutes('')).toBeNull();
    expect(parseMinutes('99999')).toBe(1440);
  });

  it('adds, moves, removes and replaces steps', () => {
    const a = makeStep('a');
    const b = makeStep('b');
    const c = makeStep('c');
    let list = addStep([a, c], b, 1);
    expect(list.map((s) => s.title)).toEqual(['a', 'b', 'c']);
    list = moveStep(list, c.key, -1);
    expect(list.map((s) => s.title)).toEqual(['a', 'c', 'b']);
    expect(moveStep(list, a.key, -1)).toBe(list);
    expect(moveStep(list, b.key, 1)).toBe(list);
    list = removeStep(list, a.key);
    expect(list.map((s) => s.title)).toEqual(['c', 'b']);
    list = replaceStep(list, c.key, [makeStep('c1'), makeStep('c2')]);
    expect(list.map((s) => s.title)).toEqual(['c1', 'c2', 'b']);
  });

  it('applies the quick rule from the guess unless the player chose', () => {
    const s = makeStep('x', 20);
    expect(s.quick).toBe(false);
    let list = updateStepGuess([s], s.key, '4');
    expect(list[0]).toMatchObject({ quick: true, quickSource: 'rule' });
    list = toggleStepQuick(list, s.key);
    expect(list[0]).toMatchObject({ quick: false, quickSource: 'user' });
    list = updateStepGuess(list, s.key, '2');
    expect(list[0]).toMatchObject({ quick: false, quickSource: 'user' });
  });

  it('sums guesses and finds the first step guess', () => {
    const steps = [makeStep(' '), makeStep('a', 10), makeStep('b'), makeStep('c', 5)];
    expect(filledSteps(steps)).toHaveLength(3);
    expect(sumStepGuesses(steps)).toBe(15);
    expect(firstStepGuess(steps)).toMatchObject({ minutes: 10 });
    expect(sumStepGuesses([makeStep('a')])).toBeNull();
    expect(firstStepGuess([{ ...makeStep('a', 10), done: true }, makeStep('b', 3)])).toMatchObject({
      minutes: 3,
    });
  });

  it('checks recurrence completeness', () => {
    expect(isRecurrenceComplete({ kind: 'weekdays', weekdays: [], interval: '2' })).toBe(false);
    expect(isRecurrenceComplete({ kind: 'weekdays', weekdays: [1], interval: '2' })).toBe(true);
    expect(isRecurrenceComplete({ kind: 'every_n_days', weekdays: [], interval: '1' })).toBe(false);
    expect(isRecurrenceComplete({ kind: 'every_n_days', weekdays: [], interval: '۳' })).toBe(true);
  });
});

describe('search and filters', () => {
  const tag = { id: 't1', name: 'Exam' } as Tag;
  const quests = [
    {
      title: 'Math homework',
      notes: '',
      tag_ids: ['t1'],
      category_id: 'school',
      priority: 'high',
      difficulty: 'B',
    },
    {
      title: 'Laundry',
      notes: 'whites first',
      tag_ids: [],
      category_id: 'home',
      priority: 'low',
      difficulty: 'E',
    },
    {
      title: 'کتاب خواندن',
      notes: '',
      tag_ids: [],
      category_id: null,
      priority: 'medium',
      difficulty: 'C',
    },
  ] as const;
  const list = quests.map((q) => ({ ...q, tag_ids: [...q.tag_ids] }));

  it('searches titles, notes and tag names', () => {
    expect(filterQuests(list, { ...NO_FILTERS, search: 'math' }, [tag])).toHaveLength(1);
    expect(filterQuests(list, { ...NO_FILTERS, search: 'WHITES' }, [tag])[0]!.title).toBe(
      'Laundry',
    );
    expect(filterQuests(list, { ...NO_FILTERS, search: 'exam' }, [tag])[0]!.title).toBe(
      'Math homework',
    );
    expect(filterQuests(list, { ...NO_FILTERS, search: 'كتاب' }, [tag])).toHaveLength(1);
    expect(filterQuests(list, { ...NO_FILTERS, search: '' }, [tag])).toHaveLength(3);
  });

  it('combines groups with AND and choices with OR', () => {
    const f = { ...NO_FILTERS, priorities: ['high', 'low'] as const, difficulties: ['E'] as const };
    const filters = { ...f, priorities: [...f.priorities], difficulties: [...f.difficulties] };
    expect(filterQuests(list, filters, [tag]).map((q) => q.title)).toEqual(['Laundry']);
    expect(activeFilterCount(filters)).toBe(3);
    expect(filterQuests(list, { ...NO_FILTERS, categoryIds: ['school'] }, [tag])).toHaveLength(1);
    expect(filterQuests(list, { ...NO_FILTERS, tagIds: ['t1'] }, [tag])).toHaveLength(1);
  });

  it('normalizes Persian text', () => {
    expect(normalizeForSearch('مي‌روم')).toBe('می روم');
  });
});

describe('estimate samples', () => {
  it('uses the quest guess or the step sum, and skips quests without focused time', () => {
    expect(
      questGuessMinutes({ guess_minutes: null }, [{ guess_minutes: 5 }, { guess_minutes: 10 }]),
    ).toBe(15);
    expect(questGuessMinutes({ guess_minutes: 30 }, [{ guess_minutes: 5 }])).toBe(30);
    const steps = new Map([
      ['a', [{ guess_minutes: 10, actual_ms: 20 * 60_000 }]],
      ['b', [{ guess_minutes: 10, actual_ms: 0 }]],
    ]);
    const samples = estimateSamples(
      [
        { id: 'a', status: 'done', guess_minutes: null, category_id: 'c' },
        { id: 'b', status: 'done', guess_minutes: 10, category_id: null },
        { id: 'c', status: 'active', guess_minutes: 10, category_id: null },
      ],
      steps,
    );
    expect(samples).toEqual([{ guessMinutes: 10, actualMinutes: 20, categoryId: 'c' }]);
  });
});
