import { beforeEach, describe, expect, it } from 'vitest';
import { resetAll } from '@/test/db';
import { setClock } from './clock';
import { db } from './db';
import { ensureLocalData, getDeviceId, localMeta } from './bootstrap';
import { getPlayerStats } from './derived';
import { UUID_RE } from './ids';
import {
  activeDays,
  appendLedgerEvent,
  categoriesRepo,
  createQuest,
  getSettings,
  getSingleton,
  hasLedgerKey,
  ledgerForQuest,
  ledgerRepo,
  ledgerTotals,
  listQuestsByStatus,
  listSteps,
  questsRepo,
  RowNotFoundError,
  tagsRepo,
  touchQuest,
  updateSettings,
  xpInWeek,
  MissingSingletonError,
} from './repositories';
import { setCurrentUserId } from './session';
import { writeTransaction } from './transaction';

const T0 = Date.parse('2026-03-10T09:00:00.000Z');

beforeEach(async () => {
  await resetAll();
  setClock(T0);
});

describe('generic repository', () => {
  it('stamps id, user, timestamps and writes an outbox entry', async () => {
    const tag = await tagsRepo.create({ name: 'exam', color: null });
    expect(tag.id).toMatch(UUID_RE);
    expect(tag).toMatchObject({
      user_id: null,
      created_at: '2026-03-10T09:00:00.000Z',
      updated_at: '2026-03-10T09:00:00.000Z',
      deleted_at: null,
    });
    const outbox = await db.outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ table: 'tags', row_id: tag.id, op: 'upsert', attempts: 0 });
  });

  it('uses the signed-in user id for new rows', async () => {
    setCurrentUserId('11111111-1111-4111-8111-111111111111');
    const tag = await tagsRepo.create({ name: 'x', color: null });
    expect(tag.user_id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('keeps a caller-provided id', async () => {
    const tag = await tagsRepo.create({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'x',
      color: null,
    });
    expect(tag.id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('update bumps updated_at and coalesces the outbox entry', async () => {
    const tag = await tagsRepo.create({ name: 'a', color: null });
    setClock(T0 + 1000);
    const next = await tagsRepo.update(tag.id, { name: 'b' });
    expect(next.name).toBe('b');
    expect(next.created_at).toBe(tag.created_at);
    expect(next.updated_at).toBe('2026-03-10T09:00:01.000Z');
    const outbox = await db.outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.changed_at).toBe('2026-03-10T09:00:01.000Z');
  });

  it('update cannot change id or sync columns through the patch type, and rejects missing rows', async () => {
    await expect(tagsRepo.update('nope', { name: 'x' })).rejects.toBeInstanceOf(RowNotFoundError);
  });

  it('soft-deletes, hides deleted rows, and restores', async () => {
    const a = await tagsRepo.create({ name: 'a', color: null });
    await tagsRepo.create({ name: 'b', color: null });
    await tagsRepo.remove(a.id);
    expect(await tagsRepo.get(a.id)).toBeUndefined();
    expect((await tagsRepo.getAny(a.id))!.deleted_at).toBe('2026-03-10T09:00:00.000Z');
    expect((await tagsRepo.list()).map((t) => t.name)).toEqual(['b']);
    const entry = await db.outbox.where('[table+row_id]').equals(['tags', a.id]).first();
    expect(entry!.op).toBe('delete');
    await tagsRepo.remove(a.id); // idempotent
    await expect(tagsRepo.update(a.id, { name: 'z' })).rejects.toBeInstanceOf(RowNotFoundError);
    const restored = await tagsRepo.restore(a.id);
    expect(restored.deleted_at).toBeNull();
    expect((await tagsRepo.list()).length).toBe(2);
  });

  it('list accepts a filter', async () => {
    await tagsRepo.createMany([
      { name: 'a', color: 'sky' },
      { name: 'b', color: null },
    ]);
    expect((await tagsRepo.list((t) => t.color !== null)).map((t) => t.name)).toEqual(['a']);
    expect(await db.outbox.count()).toBe(2);
  });

  it('rolls back the row and the outbox entry together', async () => {
    await expect(
      writeTransaction(['tags'], async () => {
        await tagsRepo.create({ name: 'a', color: null });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.tags.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('bootstrap', () => {
  it('creates singletons and default categories once', async () => {
    await ensureLocalData({ language: 'fa', timezone: 'Asia/Tehran' });
    await ensureLocalData({ language: 'en' });
    expect(await db.settings.count()).toBe(1);
    expect(await db.profile.count()).toBe(1);
    expect(await db.streak_state.count()).toBe(1);
    expect(await db.notification_prefs.count()).toBe(1);
    const settings = await getSettings();
    expect(settings).toMatchObject({
      language: 'fa',
      active_limit: 3,
      week_starts_on: 6,
      theme: 'system',
    });
    expect((await getSingleton('profile'))!.timezone).toBe('Asia/Tehran');
    const prefs = await getSingleton('notification_prefs');
    expect(prefs).toMatchObject({
      due_soon: true,
      daily_nudge: false,
      paused_reminder: false,
      push_enabled: false,
    });
    const cats = await categoriesRepo.list();
    expect(cats.map((c) => c.name_key).sort()).toEqual(['home', 'personal', 'school']);
  });

  it('does not re-seed categories the player deleted', async () => {
    await ensureLocalData();
    for (const c of await categoriesRepo.list()) await categoriesRepo.remove(c.id);
    await ensureLocalData();
    expect(await categoriesRepo.list()).toEqual([]);
  });

  it('runs safely in parallel', async () => {
    await Promise.all([ensureLocalData(), ensureLocalData(), ensureLocalData()]);
    expect(await db.settings.count()).toBe(1);
    expect(await db.categories.count()).toBe(3);
  });

  it('gives the device a stable id and stores local meta', async () => {
    await ensureLocalData();
    const id = await getDeviceId();
    expect(id).toMatch(UUID_RE);
    expect(await getDeviceId()).toBe(id);
    await localMeta.set('k', { a: 1 });
    expect(await localMeta.get('k')).toEqual({ a: 1 });
    await localMeta.remove('k');
    expect(await localMeta.get('k')).toBeUndefined();
  });

  it('throws a clear error when a singleton is missing', async () => {
    await expect(getSettings()).rejects.toBeInstanceOf(MissingSingletonError);
  });

  it('updates a singleton', async () => {
    await ensureLocalData();
    const s = await updateSettings({ theme: 'dark' });
    expect(s.theme).toBe('dark');
    expect((await getSettings()).theme).toBe('dark');
  });

  it('picks the oldest singleton if two exist (e.g. before first sync)', async () => {
    await ensureLocalData();
    const first = await getSettings();
    await db.settings.add({
      ...first,
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      created_at: '2027-01-01T00:00:00.000Z',
    });
    expect((await getSettings()).id).toBe(first.id);
  });
});

describe('quests', () => {
  it('a quest saved with no steps gets one step named after it', async () => {
    const { quest, steps } = await createQuest({ title: 'Write essay', guess_minutes: 90 });
    expect(quest).toMatchObject({
      status: 'backlog',
      priority: 'medium',
      difficulty: 'C',
      tag_ids: [],
      is_boss: false,
    });
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      title: 'Write essay',
      guess_minutes: 90,
      quick: false,
      quick_source: 'rule',
      position: 1,
    });
  });

  it('keeps given steps in order and applies the quick rule when not set', async () => {
    const { quest } = await createQuest({
      title: 'Clean room',
      difficulty: 'D',
      steps: [
        { title: 'Pick up clothes', guess_minutes: 3 },
        { title: 'Vacuum', guess_minutes: 15 },
        { title: 'Dust', guess_minutes: 10, quick: true },
      ],
    });
    const steps = await listSteps(quest.id);
    expect(steps.map((s) => [s.title, s.quick, s.quick_source])).toEqual([
      ['Pick up clothes', true, 'rule'],
      ['Vacuum', false, 'rule'],
      ['Dust', true, 'user'],
    ]);
    expect(await db.outbox.count()).toBe(4);
  });

  it('lists by status and touches', async () => {
    const { quest } = await createQuest({ title: 'A', status: 'active' });
    await createQuest({ title: 'B' });
    expect((await listQuestsByStatus('active')).map((q) => q.title)).toEqual(['A']);
    setClock(T0 + 5000);
    const touched = await touchQuest(quest.id);
    expect(touched.last_touched_at).toBe('2026-03-10T09:00:05.000Z');
    await questsRepo.remove(quest.id);
    expect(await listQuestsByStatus('active')).toEqual([]);
  });

  it('listSteps hides deleted steps', async () => {
    const { quest, steps } = await createQuest({
      title: 'A',
      steps: [{ title: '1' }, { title: '2' }],
    });
    await db.steps.update(steps[0]!.id, { deleted_at: '2026-03-10T09:00:00.000Z' });
    expect((await listSteps(quest.id)).map((s) => s.title)).toEqual(['2']);
  });
});

describe('ledger', () => {
  const base = { xp: 10, gold: 5, source_type: 'system' as const, source_id: null };

  it('is append-only', async () => {
    const { event } = await appendLedgerEvent({ ...base, kind: 'adjustment', dedupe_key: 'a' });
    await expect(ledgerRepo.update(event.id, { xp: 1 })).rejects.toThrow('append-only');
    await expect(ledgerRepo.remove(event.id)).rejects.toThrow('append-only');
  });

  it('is idempotent on dedupe_key', async () => {
    const a = await appendLedgerEvent({ ...base, kind: 'adjustment', dedupe_key: 'k' });
    const b = await appendLedgerEvent({ ...base, xp: 999, kind: 'adjustment', dedupe_key: 'k' });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.event.id).toBe(a.event.id);
    expect(await hasLedgerKey('k')).toBe(true);
    expect(await ledgerTotals()).toEqual({ xp: 10, gold: 5 });
  });

  it('stamps day, occurred_at, meta and quest_id defaults', async () => {
    const { event } = await appendLedgerEvent({ ...base, kind: 'adjustment', dedupe_key: 'k' });
    expect(event).toMatchObject({
      day: '2026-03-10',
      occurred_at: '2026-03-10T09:00:00.000Z',
      meta: null,
      quest_id: null,
    });
  });

  it('sums totals with spending, finds quest events, active days and weekly XP', async () => {
    await appendLedgerEvent({
      ...base,
      kind: 'step_reward',
      dedupe_key: 's1',
      quest_id: 'q1',
      day: '2026-03-09',
    });
    await appendLedgerEvent({
      ...base,
      kind: 'step_reward',
      dedupe_key: 's2',
      quest_id: 'q1',
      day: '2026-03-10',
    });
    await appendLedgerEvent({
      ...base,
      kind: 'step_reward',
      dedupe_key: 's3',
      quest_id: 'q2',
      day: '2026-03-10',
    });
    await appendLedgerEvent({
      ...base,
      kind: 'focus_bonus',
      dedupe_key: 'f',
      gold: 0,
      day: '2026-03-02',
    });
    await appendLedgerEvent({ ...base, kind: 'purchase', xp: 0, gold: -12, dedupe_key: 'p' });
    expect(await ledgerTotals()).toEqual({ xp: 40, gold: 3 });
    expect((await ledgerForQuest('q1')).length).toBe(2);
    expect((await ledgerForQuest('q1', ['quest_finish'])).length).toBe(0);
    expect(await activeDays()).toEqual(['2026-03-09', '2026-03-10']);
    expect(await xpInWeek('2026-03-09')).toBe(30);
    expect(await xpInWeek('2026-03-02')).toBe(10);
  });

  it('derives player stats (level, gold, streak) from the ledger', async () => {
    await ensureLocalData();
    await appendLedgerEvent({
      ...base,
      xp: 120,
      gold: 30,
      kind: 'step_reward',
      dedupe_key: 'a',
      day: '2026-03-09',
    });
    await appendLedgerEvent({
      ...base,
      xp: 40,
      gold: 0,
      kind: 'step_reward',
      dedupe_key: 'b',
      day: '2026-03-10',
    });
    const stats = await getPlayerStats('2026-03-10');
    expect(stats.xp).toBe(160);
    expect(stats.gold).toBe(30);
    expect(stats.level).toMatchObject({ level: 2, xpIntoLevel: 60 });
    expect(stats.streak).toMatchObject({ current: 2, status: 'active' });
  });
});
