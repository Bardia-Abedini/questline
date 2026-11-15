import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendLedgerEvent,
  createQuest,
  db,
  ensureLocalData,
  focusSessionsRepo,
  getSettings,
  ledgerTotals,
  questsRepo,
  setClock,
  setCurrentUserId,
  stepsRepo,
  updateSettings,
} from '@/data';
import { resetAll } from '@/test/db';
import {
  connectAccount,
  exportAllData,
  hasGuestData,
  resetToGuest,
  resolveAccountChoice,
  type AccountChoice,
} from './account';
import { backoffDelay, createSyncLock, MAX_REJECTED_ATTEMPTS, SyncEngine } from './engine';
import { applyRemoteRows } from './apply';
import { fromRemote } from './rows';
import { FakeServer } from './testing/fakeRemote';
import { classifyError } from './supabaseRemote';
import { RemoteError } from './remote';

const U = 'aaaaaaaa-0000-4000-8000-000000000001';
const T0 = Date.parse('2026-03-10T09:00:00.000Z');

/** The whole local database of one simulated device. */
type Snapshot = Record<string, unknown[]>;

async function snapshot(): Promise<Snapshot> {
  const out: Snapshot = {};
  for (const t of db.tables) out[t.name] = await t.toArray();
  return out;
}

async function restore(s: Snapshot): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      if (s[t.name]?.length) await t.bulkPut(s[t.name]!);
    }
  });
}

/** Simulates several devices sharing one browser database by swapping snapshots. */
class Devices {
  private saved = new Map<string, Snapshot>();
  current = '';
  async create(name: string) {
    if (this.current) this.saved.set(this.current, await snapshot());
    await restore({});
    await ensureLocalData({ language: 'en', timezone: 'UTC' });
    this.current = name;
  }
  async use(name: string) {
    if (name === this.current) return;
    this.saved.set(this.current, await snapshot());
    await restore(this.saved.get(name)!);
    this.current = name;
  }
}

let server: FakeServer;
const engineFor = (userId = U) =>
  new SyncEngine({ remote: server.remote(userId), isOnline: () => true });

async function signIn(userId = U, choice?: AccountChoice) {
  const remote = server.remote(userId);
  const engine = new SyncEngine({ remote, isOnline: () => true });
  const result = await connectAccount(userId, remote, engine, { language: 'en', timezone: 'UTC' });
  if (result === 'needs_choice') {
    if (!choice) return { engine, result };
    await resolveAccountChoice(choice, userId, remote, engine, { language: 'en', timezone: 'UTC' });
  }
  await engine.syncNow();
  return { engine, result };
}

const liveQuests = async () =>
  (await db.quests.toArray())
    .filter((q) => q.deleted_at === null)
    .map((q) => q.title)
    .sort();

beforeEach(async () => {
  await resetAll();
  server = new FakeServer();
  setClock(T0);
  server.now = T0;
});

describe('row conversion', () => {
  it('normalizes server formats to local ones', () => {
    const row = fromRemote('focus_sessions', {
      id: 'x',
      started_at: '2026-03-10T09:15:00.123456+00:00',
      planned_ms: '1500000',
      pauses: [],
      double_xp: false,
      server_updated_at: '2026-03-10T09:15:00.5+00:00',
      unknown_column: 1,
    });
    expect(row.started_at).toBe('2026-03-10T09:15:00.123Z');
    expect(row.planned_ms).toBe(1_500_000);
    expect(row.ended_at).toBeNull();
    expect(row).not.toHaveProperty('server_updated_at');
    expect(row).not.toHaveProperty('unknown_column');
  });

  it('classifies server errors for retries', () => {
    expect(classifyError({ code: '42501', message: 'new row violates row-level security' })).toBe(
      'rejected',
    );
    expect(classifyError({ code: 'PGRST301', message: 'JWT expired' })).toBe('auth');
    expect(classifyError({ message: 'Failed to fetch' })).toBe('network');
    expect(classifyError({ code: '', message: 'Bad gateway' }, 502)).toBe('network');
  });

  it('backs off exponentially with jitter, up to five minutes', () => {
    expect(backoffDelay(1, () => 0.5)).toBe(1000);
    expect(backoffDelay(4, () => 0.5)).toBe(8000);
    expect(backoffDelay(30, () => 0.5)).toBe(300_000);
    expect(backoffDelay(1, () => 0)).toBe(750);
  });
});

describe('push and pull', () => {
  beforeEach(async () => {
    await ensureLocalData({ language: 'en', timezone: 'UTC' });
    setCurrentUserId(U);
  });

  it('pushes the outbox in order and empties it', async () => {
    await createQuest({ title: 'Essay', steps: [{ title: 'Open doc' }, { title: 'Write' }] });
    const engine = engineFor();
    const status = await engine.syncNow();
    expect(status.state).toBe('synced');
    expect(await db.outbox.count()).toBe(0);
    const order = server.pushLog.map((p) => p.table);
    expect(order.indexOf('quests')).toBeLessThan(order.indexOf('steps'));
    expect(server.rowsOf(U, 'quests').map((q) => q.title)).toEqual(['Essay']);
    expect(server.rowsOf(U, 'steps')).toHaveLength(2);
  });

  it('keeps changes and retries after network failures', async () => {
    await createQuest({ title: 'Laundry' });
    const remote = server.remote(U);
    const push = remote.push.bind(remote);
    let failures = 2;
    remote.push = (...args) =>
      failures-- > 0 ? Promise.reject(new RemoteError('network', 'timeout')) : push(...args);
    const engine = new SyncEngine({ remote, isOnline: () => true });
    server.failNext(1);
    expect((await engine.syncNow()).state).toBe('error');
    expect((await engine.syncNow()).state).toBe('error');
    expect(await db.outbox.count()).toBeGreaterThan(0);
    const entry = await db.outbox.orderBy('seq').first();
    expect(entry?.attempts).toBeGreaterThan(0);
    expect((await engine.syncNow()).state).toBe('error');
    expect((await engine.syncNow()).state).toBe('synced');
    expect(await db.outbox.count()).toBe(0);
    expect(server.rowsOf(U, 'quests')).toHaveLength(1);
  });

  it('reports offline without touching the server', async () => {
    const engine = new SyncEngine({ remote: server.remote(U), isOnline: () => false });
    expect((await engine.syncNow()).state).toBe('offline');
    expect(server.pushLog).toHaveLength(0);
  });

  it('does not lose an edit made while its row was being pushed', async () => {
    const { quest } = await createQuest({ title: 'v1' });
    const remote = server.remote(U);
    const push = remote.push.bind(remote);
    let edited = false;
    remote.push = async (table, rows, now) => {
      const result = await push(table, rows, now);
      if (table === 'quests' && !edited) {
        edited = true;
        setClock(T0 + 1000);
        await questsRepo.update(quest.id, { title: 'v2' });
      }
      return result;
    };
    const engine = new SyncEngine({ remote, isOnline: () => true });
    await engine.syncNow();
    expect(await db.outbox.count()).toBe(0);
    expect(server.rowsOf(U, 'quests')[0]!.title).toBe('v2');
    expect((await questsRepo.get(quest.id))!.title).toBe('v2');
  });

  it('parks a refused row without blocking the others', async () => {
    const { quest: bad } = await createQuest({ title: 'bad' });
    await createQuest({ title: 'good' });
    server.rejectIds.add(bad.id);
    const engine = engineFor();
    for (let i = 0; i < MAX_REJECTED_ATTEMPTS; i++) await engine.syncNow();
    const status = await engine.syncNow();
    expect(status.state).toBe('error');
    expect(status.failed).toBe(1);
    expect(server.rowsOf(U, 'quests').map((q) => q.title)).toEqual(['good']);
    expect(await questsRepo.get(bad.id)).toBeDefined();
  });

  it('applies remote rows without queuing them again', async () => {
    await engineFor().syncNow();
    await applyRemoteRows('tags', [
      {
        id: 'b0000000-0000-4000-8000-000000000001',
        user_id: U,
        created_at: '2026-03-10T09:00:00+00:00',
        updated_at: '2026-03-10T09:00:00+00:00',
        deleted_at: null,
        name: 'from server',
        color: null,
        server_updated_at: '2026-03-10T09:00:00+00:00',
      },
    ]);
    expect(await db.tags.count()).toBe(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it('two tabs syncing at once push each change once', async () => {
    await createQuest({ title: 'Both tabs' });
    const lock = createSyncLock('test');
    const a = new SyncEngine({ remote: server.remote(U), lock, isOnline: () => true });
    const b = new SyncEngine({ remote: server.remote(U), lock, isOnline: () => true });
    await Promise.all([a.syncNow(), b.syncNow()]);
    const pushedQuests = server.pushLog.filter((p) => p.table === 'quests').flatMap((p) => p.ids);
    expect(pushedQuests).toHaveLength(1);
  });

  it('notifies near real time and pulls the changed table', async () => {
    const engine = engineFor();
    const live: boolean[] = [];
    engine.subscribe((s) => live.push(s.live));
    engine.start();
    await new Promise((r) => setTimeout(r, 30));
    expect(engine.getStatus().live).toBe(true);
    engine.stop();
  });
});

describe('two devices', () => {
  let devices: Devices;
  beforeEach(async () => {
    devices = new Devices();
    await devices.create('phone');
    setCurrentUserId(U);
    await signIn();
    await devices.create('laptop');
    await signIn();
  });

  async function syncBoth() {
    for (const d of ['phone', 'laptop', 'phone']) {
      await devices.use(d);
      setCurrentUserId(U);
      await engineFor().syncNow();
    }
  }

  it('converge on the same rows, with no duplicate defaults', async () => {
    await devices.use('phone');
    await createQuest({ title: 'From phone' });
    await devices.use('laptop');
    await createQuest({ title: 'From laptop' });
    await syncBoth();
    await devices.use('laptop');
    await engineFor().syncNow();
    expect(await liveQuests()).toEqual(['From laptop', 'From phone']);
    expect((await db.categories.toArray()).filter((c) => !c.deleted_at)).toHaveLength(3);
    expect(await db.settings.count()).toBe(1);
    await devices.use('phone');
    expect(await liveQuests()).toEqual(['From laptop', 'From phone']);
  });

  it('resolve a conflict by last write wins and spread soft deletes', async () => {
    await devices.use('phone');
    const { quest } = await createQuest({ title: 'Shared' });
    await syncBoth();
    await devices.use('laptop');
    await engineFor().syncNow();

    setClock(T0 + 10_000);
    server.now = T0 + 10_000;
    await questsRepo.update(quest.id, { title: 'Laptop edit (earlier)' });
    await devices.use('phone');
    setClock(T0 + 20_000);
    server.now = T0 + 20_000;
    await questsRepo.update(quest.id, { title: 'Phone edit (later)' });
    await engineFor().syncNow();
    await devices.use('laptop');
    await engineFor().syncNow();
    expect((await questsRepo.get(quest.id))!.title).toBe('Phone edit (later)');

    setClock(T0 + 30_000);
    server.now = T0 + 30_000;
    await questsRepo.remove(quest.id);
    await engineFor().syncNow();
    await devices.use('phone');
    await engineFor().syncNow();
    expect(await questsRepo.get(quest.id)).toBeUndefined();
    expect((await questsRepo.getAny(quest.id))!.deleted_at).not.toBeNull();
  });

  it('pay a reward granted on both devices offline only once', async () => {
    await devices.use('phone');
    await appendLedgerEvent({
      kind: 'level_up_gift',
      xp: 0,
      gold: 50,
      source_type: 'level',
      source_id: '2',
      dedupe_key: 'level:2',
    });
    await devices.use('laptop');
    await appendLedgerEvent({
      kind: 'level_up_gift',
      xp: 0,
      gold: 50,
      source_type: 'level',
      source_id: '2',
      dedupe_key: 'level:2',
    });
    await syncBoth();
    await devices.use('laptop');
    await engineFor().syncNow();
    expect(await ledgerTotals()).toEqual({ xp: 0, gold: 50 });
    expect(await db.ledger_events.count()).toBe(1);
    await devices.use('phone');
    expect(await ledgerTotals()).toEqual({ xp: 0, gold: 50 });
    expect(server.rowsOf(U, 'ledger_events')).toHaveLength(1);
    const [laptopRow] = await db.ledger_events.toArray();
    expect(laptopRow!.id).toBe(server.rowsOf(U, 'ledger_events')[0]!.id);
  });

  it('restore an open focus session on the other device', async () => {
    await devices.use('phone');
    const session = await focusSessionsRepo.create({
      kind: 'focus',
      quest_id: null,
      step_id: null,
      started_at: new Date(T0).toISOString(),
      planned_ms: 25 * 60_000,
      pauses: [],
      away: [],
      distractions: [],
      ended_at: null,
      end_reason: null,
      focused_ms: 0,
      away_ms: 0,
      paused_ms: 0,
      double_xp: false,
      device_id: 'phone',
    });
    await engineFor().syncNow();
    await devices.use('laptop');
    await engineFor().syncNow();
    const open = (await db.focus_sessions.toArray()).filter((s) => s.ended_at === null);
    expect(open.map((s) => s.id)).toEqual([session.id]);
    expect(open[0]!.started_at).toBe(session.started_at);
  });

  it('cope with a device clock one hour fast', async () => {
    await devices.use('phone');
    const { quest } = await createQuest({ title: 'Clock' });
    await syncBoth();
    // The laptop's clock runs an hour fast; its edit is moved onto the server clock.
    await devices.use('laptop');
    setClock(T0 + 3_600_000 + 5_000);
    server.now = T0 + 5_000;
    await questsRepo.update(quest.id, { title: 'Fast clock edit' });
    await engineFor().syncNow();
    // A real later edit on the phone still wins.
    await devices.use('phone');
    setClock(T0 + 60_000);
    server.now = T0 + 60_000;
    await engineFor().syncNow();
    expect((await questsRepo.get(quest.id))!.title).toBe('Fast clock edit');
    await questsRepo.update(quest.id, { title: 'Phone, a minute later' });
    await engineFor().syncNow();
    await devices.use('laptop');
    await engineFor().syncNow();
    expect((await questsRepo.get(quest.id))!.title).toBe('Phone, a minute later');
  });
});

describe('guest to account', () => {
  let devices: Devices;
  beforeEach(async () => {
    devices = new Devices();
    // The account already exists, used on a laptop.
    await devices.create('laptop');
    setCurrentUserId(U);
    await signIn();
    await createQuest({ title: 'Account quest' });
    await appendLedgerEvent({
      kind: 'step_reward',
      xp: 20,
      gold: 10,
      source_type: 'step',
      source_id: 's1',
      dedupe_key: 'step:s1',
    });
    await updateSettings({ theme: 'dark' });
    await engineFor().syncNow();
    // A phone used as a guest.
    setCurrentUserId(null);
    await devices.create('phone');
  });

  it('uploads guest data to an empty account', async () => {
    await createQuest({ title: 'Guest quest' });
    const other = 'bbbbbbbb-0000-4000-8000-000000000002';
    const { result } = await signIn(other);
    expect(result).toBe('ready');
    expect(server.rowsOf(other, 'quests').map((q) => q.title)).toEqual(['Guest quest']);
    expect((await db.quests.toArray()).every((q) => q.user_id === other)).toBe(true);
    expect(await db.outbox.count()).toBe(0);
  });

  it('uses the account data when the device has none, without duplicate defaults', async () => {
    expect(await hasGuestData()).toBe(false);
    const { result } = await signIn();
    expect(result).toBe('ready');
    expect(await liveQuests()).toEqual(['Account quest']);
    expect((await db.categories.toArray()).filter((c) => !c.deleted_at)).toHaveLength(3);
    expect((await getSettings()).theme).toBe('dark');
    expect(await db.settings.count()).toBe(1);
  });

  it('asks before touching anything when both have data', async () => {
    await createQuest({ title: 'Guest quest' });
    const { result } = await signIn(U);
    expect(result).toBe('needs_choice');
    expect(await liveQuests()).toEqual(['Guest quest']);
    expect(server.rowsOf(U, 'quests').map((q) => q.title)).toEqual(['Account quest']);
  });

  it('merge keeps both, folds defaults and pays each reward once', async () => {
    await createQuest({ title: 'Guest quest' });
    await appendLedgerEvent({
      kind: 'step_reward',
      xp: 20,
      gold: 10,
      source_type: 'step',
      source_id: 's1',
      dedupe_key: 'step:s1',
    });
    await appendLedgerEvent({
      kind: 'step_reward',
      xp: 40,
      gold: 20,
      source_type: 'step',
      source_id: 's2',
      dedupe_key: 'step:s2',
    });
    const guestQuest = (await db.quests.toArray())[0]!;
    await questsRepo.update(guestQuest.id, {
      category_id: (await db.categories.toArray()).find((c) => c.name_key === 'home')!.id,
    });
    await signIn(U, 'merge');

    expect(await liveQuests()).toEqual(['Account quest', 'Guest quest']);
    expect(await ledgerTotals()).toEqual({ xp: 60, gold: 30 });
    const cats = (await db.categories.toArray()).filter((c) => !c.deleted_at);
    expect(cats).toHaveLength(3);
    const home = cats.find((c) => c.name_key === 'home')!;
    expect((await questsRepo.get(guestQuest.id))!.category_id).toBe(home.id);
    expect(await db.settings.count()).toBe(1);
    expect((await getSettings()).theme).toBe('dark');
    expect(server.rowsOf(U, 'quests')).toHaveLength(2);
    expect(server.rowsOf(U, 'ledger_events')).toHaveLength(2);
    expect(server.rowsOf(U, 'categories')).toHaveLength(3);
    expect(await db.outbox.count()).toBe(0);
  });

  it('keep account data replaces the device data', async () => {
    await createQuest({ title: 'Guest quest' });
    await signIn(U, 'keep_account');
    expect(await liveQuests()).toEqual(['Account quest']);
    expect(await ledgerTotals()).toEqual({ xp: 20, gold: 10 });
    expect(server.rowsOf(U, 'quests')).toHaveLength(1);
  });

  it('keep this device replaces the account data, and other devices reload', async () => {
    await createQuest({ title: 'Guest quest' });
    await signIn(U, 'keep_device');
    expect(server.rowsOf(U, 'quests').map((q) => q.title)).toEqual(['Guest quest']);
    expect(server.rowsOf(U, 'ledger_events')).toHaveLength(0);
    expect(await liveQuests()).toEqual(['Guest quest']);

    await devices.use('laptop');
    setCurrentUserId(U);
    await engineFor().syncNow();
    expect(await liveQuests()).toEqual(['Guest quest']);
    expect(await ledgerTotals()).toEqual({ xp: 0, gold: 0 });
  });

  it('sign-out leaves a clean guest device and export holds every table', async () => {
    await signIn();
    const exported = await exportAllData();
    expect(exported.format).toBe('questline-export');
    expect(Object.keys(exported.tables)).toHaveLength(22);
    expect(exported.tables.quests).toHaveLength(1);

    await resetToGuest({ language: 'en', timezone: 'UTC' });
    expect(await liveQuests()).toEqual([]);
    expect(await db.ledger_events.count()).toBe(0);
    expect((await db.categories.toArray()).filter((c) => !c.deleted_at)).toHaveLength(3);
    expect((await db.settings.toArray())[0]!.user_id).toBeNull();
    const step = await stepsRepo.list();
    expect(step).toHaveLength(0);
  });
});
