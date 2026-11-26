import { beforeEach, describe, expect, it } from 'vitest';
import { createQuest, db, setClock, type Quest, type Step } from '@/data';
import { events } from '@/services';
import { resetAll } from '@/test/db';
import { checkInEnergy, currentEnergy, ENERGY_FRESH_MS } from './energy';
import { pickAt, rankPicks, toCandidates } from './whatNowPicks';

const NOW = Date.parse('2026-03-10T09:00:00Z');

describe('currentEnergy', () => {
  const at = new Date(NOW).toISOString();
  it('is null with no check-in', () => {
    expect(currentEnergy(null, NOW, '2026-03-10')).toBeNull();
  });
  it('counts for a few hours of the same day', () => {
    const row = { level: 'low' as const, at, day: '2026-03-10' };
    expect(currentEnergy(row, NOW + 60_000, '2026-03-10')).toBe('low');
    expect(currentEnergy(row, NOW + ENERGY_FRESH_MS - 1, '2026-03-10')).toBe('low');
    expect(currentEnergy(row, NOW + ENERGY_FRESH_MS, '2026-03-10')).toBeNull();
  });
  it('never carries over to the next day', () => {
    expect(currentEnergy({ level: 'high', at, day: '2026-03-09' }, NOW, '2026-03-10')).toBeNull();
  });
});

describe('checkInEnergy', () => {
  beforeEach(async () => {
    await resetAll();
    setClock(NOW);
  });

  it('saves a check-in and emits energy.checked_in after commit', async () => {
    const seen: string[] = [];
    events.on('energy.checked_in', (e) => seen.push(e.level));
    await checkInEnergy('medium');
    const rows = await db.energy_checkins.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ level: 'medium', day: '2026-03-10' });
    expect(seen).toEqual(['medium']);
  });

  it('a quick change of mind edits the same row; later ones add a new row', async () => {
    await checkInEnergy('low');
    setClock(NOW + 5 * 60_000);
    await checkInEnergy('high');
    expect((await db.energy_checkins.toArray()).map((r) => r.level)).toEqual(['high']);
    setClock(NOW + 3 * 60 * 60_000);
    await checkInEnergy('low');
    expect(await db.energy_checkins.count()).toBe(2);
  });
});

describe('what should I do now', () => {
  beforeEach(async () => {
    await resetAll();
    setClock(NOW);
  });

  async function load() {
    const quests = (await db.quests.toArray()) as Quest[];
    const steps = new Map<string, Step[]>();
    for (const s of await db.steps.toArray())
      steps.set(s.quest_id, [...(steps.get(s.quest_id) ?? []), s]);
    return toCandidates(quests, steps);
  }

  it('picks the next open step of each quest and skips finished quests', async () => {
    const { quest, steps } = await createQuest({
      title: 'Essay',
      status: 'active',
      steps: [{ title: 'Outline', guess_minutes: 5 }, { title: 'Draft' }],
    });
    await db.steps.update(steps[0]!.id, { done_at: new Date(NOW).toISOString() });
    const done = await createQuest({ title: 'Old', status: 'active' });
    await db.steps.update(done.steps[0]!.id, { done_at: new Date(NOW).toISOString() });
    const candidates = await load();
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: quest.id, nextStep: { title: 'Draft' } });
  });

  it('ranks due and important quests first, and low energy prefers small steps', async () => {
    await createQuest({ title: 'Big', status: 'active', difficulty: 'S', guess_minutes: 120 });
    await createQuest({ title: 'Tiny', status: 'active', difficulty: 'E', guess_minutes: 5 });
    await createQuest({ title: 'Due', status: 'active', due_date: '2026-03-10', priority: 'high' });
    const candidates = await load();
    expect(rankPicks(candidates, NOW, null)[0]!.quest.title).toBe('Due');
    const low = rankPicks(candidates, NOW, 'low').map((p) => p.quest.title);
    expect(low.indexOf('Tiny')).toBeLessThan(low.indexOf('Big'));
    const high = rankPicks(candidates, NOW, 'high').map((p) => p.quest.title);
    expect(high.indexOf('Big')).toBeLessThan(high.indexOf('Tiny'));
  });

  it('"Not this one" walks the list and wraps around', async () => {
    await createQuest({ title: 'A', status: 'active', priority: 'high' });
    await createQuest({ title: 'B', status: 'active' });
    const ranked = rankPicks(await load(), NOW, null);
    expect(pickAt(ranked, 0)!.quest.title).toBe('A');
    expect(pickAt(ranked, 1)!.quest.title).toBe('B');
    expect(pickAt(ranked, 2)!.quest.title).toBe('A');
    expect(pickAt([], 3)).toBeNull();
  });

  it('offers Active quests first, then the backlog (never the inbox)', async () => {
    await createQuest({
      title: 'Urgent waiting',
      status: 'backlog',
      priority: 'high',
      due_date: '2026-03-10',
    });
    await createQuest({ title: 'Active one', status: 'active', priority: 'low' });
    await createQuest({ title: 'Unsorted', status: 'inbox' });
    const titles = rankPicks(await load(), NOW, null).map((p) => p.quest.title);
    expect(titles).toEqual(['Active one', 'Urgent waiting']);
  });
});
