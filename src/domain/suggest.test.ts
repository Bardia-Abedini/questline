import { describe, expect, it } from 'vitest';
import { localDateTimeToMs } from './dates';
import { rankSuggestions, scoreQuest, suggestNext, type SuggestCandidate } from './suggest';

const now = localDateTimeToMs('2026-03-10', '09:00');

const c = (over: Partial<SuggestCandidate> & { id: string }): SuggestCandidate => ({
  status: 'backlog',
  priority: 'medium',
  difficulty: 'C',
  guess_minutes: 30,
  due_date: null,
  due_time: null,
  ...over,
});

describe('scoreQuest', () => {
  it('overdue beats due soon beats no date', () => {
    const overdue = scoreQuest(c({ id: 'o', due_date: '2026-03-09' }), now, null);
    const today = scoreQuest(c({ id: 't', due_date: '2026-03-10', due_time: '17:00' }), now, null);
    const week = scoreQuest(c({ id: 'w', due_date: '2026-03-15' }), now, null);
    const none = scoreQuest(c({ id: 'n' }), now, null);
    expect(overdue.score).toBeGreaterThan(today.score);
    expect(today.score).toBeGreaterThan(week.score);
    expect(week.score).toBeGreaterThan(none.score);
    expect(overdue.reasons[0]).toBe('overdue');
    expect(today.reasons[0]).toBe('due_today');
    expect(week.reasons).toContain('due_soon');
  });

  it('due within 24h but more than 12h away is "due soon"', () => {
    const r = scoreQuest(c({ id: 'x', due_date: '2026-03-11', due_time: '08:00' }), now, null);
    expect(r.reasons[0]).toBe('due_soon');
  });

  it('due within 3 days scores between 24h and 7 days', () => {
    const d3 = scoreQuest(c({ id: 'a', due_date: '2026-03-12' }), now, null).score;
    const d1 = scoreQuest(c({ id: 'b', due_date: '2026-03-10' }), now, null).score;
    const d7 = scoreQuest(c({ id: 'd', due_date: '2026-03-16' }), now, null).score;
    expect(d1).toBeGreaterThan(d3);
    expect(d3).toBeGreaterThan(d7);
  });

  it('priority adds weight; only high priority is named', () => {
    const high = scoreQuest(c({ id: 'h', priority: 'high' }), now, null);
    const med = scoreQuest(c({ id: 'm', priority: 'medium' }), now, null);
    const low = scoreQuest(c({ id: 'l', priority: 'low' }), now, null);
    expect(high.score).toBeGreaterThan(med.score);
    expect(med.score).toBeGreaterThan(low.score);
    expect(high.reasons).toContain('high_priority');
    expect(med.reasons).not.toContain('high_priority');
  });

  it('active quests and quick starts get a nudge', () => {
    expect(scoreQuest(c({ id: 'a', status: 'active' }), now, null).reasons).toContain(
      'already_active',
    );
    expect(scoreQuest(c({ id: 'q', guess_minutes: 5 }), now, null).reasons).toContain(
      'quick_start',
    );
    expect(
      scoreQuest(c({ id: 'q2', guess_minutes: 60, next_step_guess_minutes: 3 }), now, null).reasons,
    ).toContain('quick_start');
    expect(
      scoreQuest(c({ id: 'q3', guess_minutes: 3, next_step_quick: false }), now, null).reasons,
    ).not.toContain('quick_start');
  });

  it('low energy prefers small, easy quests', () => {
    const small = scoreQuest(c({ id: 's', guess_minutes: 10, difficulty: 'E' }), now, 'low');
    const big = scoreQuest(c({ id: 'b', guess_minutes: 120, difficulty: 'S' }), now, 'low');
    expect(small.score).toBeGreaterThan(big.score);
    expect(small.reasons).toContain('fits_low_energy');
    expect(big.reasons).not.toContain('fits_low_energy');
  });

  it('high energy prefers big, hard quests', () => {
    const small = scoreQuest(c({ id: 's', guess_minutes: 10, difficulty: 'E' }), now, 'high');
    const big = scoreQuest(c({ id: 'b', guess_minutes: 120, difficulty: 'S' }), now, 'high');
    expect(big.score).toBeGreaterThan(small.score);
    expect(big.reasons).toContain('fits_high_energy');
  });

  it('medium or unknown energy is neutral', () => {
    const a = scoreQuest(c({ id: 'a', guess_minutes: 10, difficulty: 'E' }), now, 'medium');
    const b = scoreQuest(c({ id: 'b', guess_minutes: 10, difficulty: 'E' }), now, null);
    expect(a.score).toBe(b.score);
  });

  it('no guess counts as medium size', () => {
    const r = scoreQuest(c({ id: 'x', guess_minutes: null, difficulty: 'E' }), now, 'low');
    expect(r.reasons).toContain('fits_low_energy');
  });
});

describe('rankSuggestions / suggestNext', () => {
  it('skips inbox, done and archived quests', () => {
    const list = [
      c({ id: 'inbox', status: 'inbox', priority: 'high' }),
      c({ id: 'done', status: 'done', priority: 'high' }),
      c({ id: 'arch', status: 'archived', priority: 'high' }),
      c({ id: 'ok', status: 'backlog' }),
    ];
    expect(rankSuggestions(list, now, null).map((s) => s.quest.id)).toEqual(['ok']);
  });

  it('returns null with nothing open', () => {
    expect(suggestNext([], now, 'low')).toBeNull();
  });

  it('breaks ties deterministically by id', () => {
    const list = [c({ id: 'b' }), c({ id: 'a' })];
    expect(rankSuggestions(list, now, null).map((s) => s.quest.id)).toEqual(['a', 'b']);
  });

  it('picks the overdue high-priority quest over a quick low one', () => {
    const list = [
      c({ id: 'quick', guess_minutes: 2, priority: 'low' }),
      c({ id: 'urgent', due_date: '2026-03-09', priority: 'high' }),
    ];
    expect(suggestNext(list, now, 'low')!.quest.id).toBe('urgent');
  });
});
