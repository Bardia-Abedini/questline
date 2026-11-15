import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Cloud package. Runs at phone and desktop sizes.
 *
 * Default run (no Supabase configured): guest mode, AI mock, calendar and AI explaining
 * themselves, export, Persian. With a local stack (supabase/README.md) build with
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set and E2E_SUPABASE=1: account validation,
 * sign-up, sync between two browser contexts and sign-out run too.
 */
const STACK = process.env.E2E_SUPABASE === '1';
/** fake-services.mjs, when the stack's functions point at it (supabase/README.md). */
const FAKE_URL = process.env.E2E_FAKE_URL ?? '';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // The local stack has no realtime server; its websocket refusal is expected there.
    if (m.type() === 'error' && !/websocket|realtime|ERR_CONNECTION_REFUSED/i.test(m.text())) {
      errors.push(m.text());
    }
  });
  return errors;
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}

/** Rows of a local IndexedDB table, read in the page. */
function readTable(page: Page, table: string) {
  return page.evaluate(
    (name) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('questline');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction(name).objectStore(name).getAll();
          req.onsuccess = () => {
            resolve(req.result as Record<string, unknown>[]);
            open.result.close();
          };
        };
      }),
    table,
  );
}

const liveTitles = async (page: Page) =>
  (await readTable(page, 'quests'))
    .filter((q) => q.deleted_at === null)
    .map((q) => q.title as string)
    .sort();

test.describe('guest mode', () => {
  test.skip(STACK, 'guest-only checks run in the default build');

  test('works with no configuration and shows the guest sync state', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await expect(page.getByTestId('header-level')).toBeVisible();
    const badge = page.getByTestId('sync-status');
    await expect(badge).toHaveAttribute('data-state', 'guest');
    await expect(badge).toHaveAccessibleName(/Guest: your data stays on this device/);
    await badge.click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible();
    await expect(page.getByTestId('account-unconfigured')).toContainText(
      'Accounts are not set up yet',
    );
    await expectNoHorizontalScroll(page);
    // No Supabase code or request in a guest build.
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.reload();
    await expect(page.getByTestId('account-unconfigured')).toBeVisible();
    expect(requests.filter((u) => /supabase|functions\/v1/.test(u))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('settings explain AI, calendar and reminders without an account', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByTestId('settings-ai')).toContainText('AI helpers need an account');
    await expect(page.getByTestId('settings-calendar')).toContainText(
      'Calendar sync has not been switched on',
    );
    const reminders = page.getByTestId('settings-reminders');
    await expect(reminders.getByRole('switch', { name: 'Due soon' })).toBeChecked();
    await expect(
      reminders.getByRole('switch', { name: 'Daily “time to quest”' }),
    ).not.toBeChecked();
    await expect(reminders.getByRole('switch', { name: 'Paused quest' })).not.toBeChecked();
    await reminders.getByRole('switch', { name: 'Quiet hours' }).click();
    await expect(reminders.getByLabel('Quiet from')).toHaveValue('22:00');
    await expectNoHorizontalScroll(page);
  });

  test('export downloads valid JSON with every table', async ({ page }) => {
    await page.goto('/settings');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page
        .getByTestId('settings-data')
        .getByRole('button', { name: 'Download all my data' })
        .click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^questline-export-\d{4}-\d{2}-\d{2}\.json$/);
    const stream = await download.createReadStream();
    let text = '';
    for await (const chunk of stream) text += chunk;
    const data = JSON.parse(text);
    expect(data.format).toBe('questline-export');
    expect(Object.keys(data.tables)).toHaveLength(22);
    expect(data.tables.settings).toHaveLength(1);
    expect(data.tables.categories).toHaveLength(3);
  });

  test('brain dump explains AI needs an account and still splits lines', async ({ page }) => {
    await page.goto('/brain-dump');
    await expect(page.getByTestId('ai-unavailable')).toContainText('AI helpers need an account');
    await expect(page.getByRole('button', { name: 'Sort it into quests' })).toHaveCount(0);
    await page.getByLabel('Everything on your mind').fill('- buy milk\n- call grandma');
    await page.getByRole('button', { name: 'One quest per line' }).click();
    await expect(page.getByLabel('Quest 1')).toHaveValue('buy milk');
    await page.getByRole('button', { name: 'Save 2 quests' }).click();
    await expect(page).toHaveURL(/\/quests$/);
    expect(await liveTitles(page)).toEqual(['buy milk', 'call grandma']);
  });

  test('brain dump with the AI mock: review, edit, remove, save', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ql.ai.mock', '1'));
    await page.goto('/brain-dump');
    await page
      .getByLabel('Everything on your mind')
      .fill('buy milk\nfinish essay draft; call grandma');
    await page.getByRole('button', { name: 'Sort it into quests' }).click();
    await expect(page.getByLabel('Quest 3')).toHaveValue('call grandma');
    await expectNoHorizontalScroll(page);
    await page.getByLabel('Quest 2').fill('Finish the essay draft');
    await page.getByRole('button', { name: 'Remove “call grandma”' }).click();
    await page.getByRole('button', { name: 'Save 2 quests' }).click();
    await expect(page).toHaveURL(/\/quests$/);
    expect(await liveTitles(page)).toEqual(['Finish the essay draft', 'buy milk']);
    const quests = await readTable(page, 'quests');
    expect(quests.every((q) => q.source === 'brain_dump')).toBe(true);
    const steps = await readTable(page, 'steps');
    const essay = quests.find((q) => q.title === 'Finish the essay draft')!;
    const essaySteps = steps.filter((s) => s.quest_id === essay.id);
    expect(essaySteps.length).toBeGreaterThanOrEqual(3);
    expect(essaySteps.every((s) => s.quick_source === 'ai')).toBe(true);
  });

  test('calendar explains itself and plans a focus block locally', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/brain-dump');
    await page.getByLabel('Everything on your mind').fill('write report');
    await page.getByRole('button', { name: 'One quest per line' }).click();
    await page.getByRole('button', { name: 'Save 1 quest' }).click();
    await expect(page).toHaveURL(/\/quests$/);

    await page.goto('/calendar');
    await expect(page.getByTestId('calendar-explainer')).toContainText(
      'Google Calendar is not set up yet',
    );
    await expectNoHorizontalScroll(page);
    // Plan tomorrow so the whole day is free.
    await page.getByRole('button', { name: 'Next day' }).click();
    const gaps = page.getByTestId('calendar-gaps');
    await gaps.getByRole('button', { name: 'Plan focus' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Plan it' }).click();
    await expect(page.getByTestId('calendar-timeline')).toContainText('write report');
    expect(await readTable(page, 'focus_blocks')).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('clicking a Focus notification brings the app to the focus session', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'service worker evaluation is Chromium-only');
    await context.grantPermissions(['notifications']);
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    // Controlled by the generated service worker (which imports public/push-sw.js) after a reload.
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.goto('/settings');
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    // The same notification Focus shows through the service worker on phones, then a click.
    const result = await worker.evaluate(async () => {
      // Service worker globals, typed loosely: e2e/ compiles with DOM types only.
      const sw = self as unknown as {
        registration: {
          showNotification(title: string, options: object): Promise<void>;
          getNotifications(filter: object): Promise<object[]>;
        };
        clients: { matchAll(o: object): Promise<{ url: string }[]> };
        dispatchEvent(e: Event): boolean;
      };
      const NotificationEventCtor = (globalThis as Record<string, unknown>)
        .NotificationEvent as new (type: string, init: object) => Event;
      await sw.registration.showNotification('Time is up', { tag: 'ql-focus-end', body: 'x' });
      const [n] = await sw.registration.getNotifications({ tag: 'ql-focus-end' });
      if (!n) return 'no notification';
      sw.dispatchEvent(new NotificationEventCtor('notificationclick', { notification: n }));
      return 'clicked';
    });
    expect(result).toBe('clicked');
    await expect(page).toHaveURL(/\/focus$/);
  });

  test('Persian: cloud screens in RTL with no horizontal scroll', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('radio', { name: 'فارسی' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // The choice is saved to the local database before we navigate away.
    await expect.poll(async () => (await readTable(page, 'settings'))[0]?.language).toBe('fa');
    for (const [path, heading] of [
      ['/account', 'حساب کاربری'],
      ['/brain-dump', 'خالی کردن ذهن'],
      ['/calendar', 'برنامهٔ روز'],
      ['/settings', 'تنظیمات'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
    await expect(page.getByTestId('settings-ai')).toContainText(
      'دستیار هوش مصنوعی حساب کاربری لازم دارد',
    );
    await expect(page.getByTestId('sync-status')).toHaveAccessibleName(/مهمان/);
  });
});

test.describe('with the local Supabase stack', () => {
  test.skip(!STACK, 'needs E2E_SUPABASE=1 and a build pointed at a local stack');
  test.describe.configure({ mode: 'serial' });

  const password = 'tiny steps 123';
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  test('account form validates before sending', async ({ page }) => {
    await page.goto('/account');
    await page.getByRole('radio', { name: 'Create account' }).click();
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create my account' }).click();
    await expect(page.getByText('That email address does not look complete.')).toBeVisible();
    await expect(page.getByText('Use at least 8 characters.')).toBeVisible();
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Password').fill('wrong password');
    await page.getByRole('radio', { name: 'Sign in' }).click();
    await page.getByRole('button', { name: 'Sign in' }).last().click();
    await expect(page.getByRole('alert')).toContainText('That email and password do not match');
    await expectNoHorizontalScroll(page);
  });

  test('sign up uploads guest data, a second device syncs, sign out leaves a clean guest', async ({
    browser,
  }, testInfo) => {
    const address = email.replace('@', `-${testInfo.project.name}@`);
    const phone = await browser.newPage();
    const errors = trackErrors(phone);
    // Guest data first.
    await phone.goto('/brain-dump');
    await phone.getByLabel('Everything on your mind').fill('guest quest');
    await phone.getByRole('button', { name: 'One quest per line' }).click();
    await phone.getByRole('button', { name: 'Save 1 quest' }).click();
    await expect(phone).toHaveURL(/\/quests$/);

    await phone.goto('/account');
    await phone.getByRole('radio', { name: 'Create account' }).click();
    await phone.getByLabel('Email').fill(address);
    await phone.getByLabel('Password').fill(password);
    await phone.getByRole('button', { name: 'Create my account' }).click();
    await expect(phone.getByTestId('account-email')).toHaveText(address);
    await expect(phone.getByTestId('sync-status')).toHaveAttribute('data-state', 'synced', {
      timeout: 15_000,
    });
    const owner = (await readTable(phone, 'quests'))[0]!.user_id;
    expect(owner).toBeTruthy();

    // A second browser profile = another device.
    const laptopContext = await browser.newContext();
    const laptop = await laptopContext.newPage();
    await laptop.goto('/account');
    await laptop.getByLabel('Email').fill(address);
    await laptop.getByLabel('Password').fill(password);
    await laptop.getByRole('button', { name: 'Sign in' }).last().click();
    await expect(laptop.getByTestId('sync-status')).toHaveAttribute('data-state', 'synced', {
      timeout: 15_000,
    });
    await expect.poll(() => liveTitles(laptop), { timeout: 10_000 }).toEqual(['guest quest']);

    // A change on the laptop reaches the phone (polling: the local stack has no realtime).
    await laptop.goto('/brain-dump');
    await laptop.getByLabel('Everything on your mind').fill('from the laptop');
    await laptop.getByRole('button', { name: 'One quest per line' }).click();
    await laptop.getByRole('button', { name: 'Save 1 quest' }).click();
    await expect(laptop.getByTestId('sync-status')).toHaveAttribute('data-state', 'synced', {
      timeout: 15_000,
    });
    await phone.goto('/account');
    await phone.getByRole('button', { name: 'Sync now' }).click();
    await expect
      .poll(() => liveTitles(phone), { timeout: 15_000 })
      .toEqual(['from the laptop', 'guest quest']);

    // Sign out: account data leaves this device, a fresh guest space starts.
    await phone.getByRole('button', { name: 'Sign out' }).click();
    await expect(phone.getByTestId('sync-status')).toHaveAttribute('data-state', 'guest');
    await expect.poll(() => liveTitles(phone)).toEqual([]);
    expect((await readTable(phone, 'categories')).length).toBe(3);
    expect(errors).toEqual([]);
    await laptopContext.close();
  });
});

/* -------------------------------------------- integration with the real Quests and Focus */

/** A fresh browser profile (= a device). */
async function newDevice(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

const synced = (page: Page) =>
  expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'synced', {
    timeout: 20_000,
  });

/** Nothing left in this device's outbox (works on full-screen pages without the badge). */
const outboxEmpty = (page: Page) =>
  expect.poll(async () => (await readTable(page, 'outbox')).length, { timeout: 20_000 }).toBe(0);

async function signUpOn(page: Page, address: string) {
  await page.goto('/account');
  await page.getByRole('radio', { name: 'Create account' }).click();
  await page.getByLabel('Email').fill(address);
  await page.getByLabel('Password').fill('tiny steps 123');
  await page.getByRole('button', { name: 'Create my account' }).click();
  await expect(page.getByTestId('account-email')).toHaveText(address);
  await synced(page);
}

async function signInOn(page: Page, address: string) {
  await page.goto('/account');
  await page.getByLabel('Email').fill(address);
  await page.getByLabel('Password').fill('tiny steps 123');
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  await expect(page.getByTestId('account-email')).toHaveText(address);
}

/** Reloading starts a sync cycle at once (no need to wait for polling). */
async function syncByReload(page: Page, path = '/') {
  await page.goto(path);
  await synced(page);
}

/** Adds a quest through the Quests form; `fromToday` makes it active. */
async function addQuestThroughForm(
  page: Page,
  title: string,
  steps: Array<[string, number]>,
  options: { fromToday?: boolean; dueDate?: string } = {},
) {
  await page.goto(options.fromToday ? '/quests/new?from=today' : '/quests/new');
  await page.getByLabel('Quest name').fill(title);
  for (const [step, minutes] of steps) {
    await page.getByPlaceholder('e.g. Open the document').fill(step);
    await page.getByLabel('Minutes for the new step').fill(String(minutes));
    await page.getByPlaceholder('e.g. Open the document').press('Enter');
  }
  if (options.dueDate) {
    await page.getByRole('button', { name: 'More details' }).click();
    await page.getByLabel('Date', { exact: true }).fill(options.dueDate);
  }
  await page.getByRole('button', { name: 'Save quest' }).click();
  if (options.fromToday) await expect(page).toHaveURL(/\/$/);
  else await expect(page).toHaveURL(/\/quests\/[0-9a-f-]{36}$/);
}

async function questId(page: Page, title: string): Promise<string> {
  const q = (await readTable(page, 'quests')).find((r) => r.title === title && !r.deleted_at);
  return q!.id as string;
}

const seconds = (text: string | null) => {
  const digits = (text ?? '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const parts = digits.match(/\d+/g)!.map(Number);
  return parts.reduce((total, n) => total * 60 + n, 0);
};

test.describe('local stack: the real screens on two devices', () => {
  test.skip(!STACK, 'needs E2E_SUPABASE=1 and a build pointed at a local stack');
  const unique = () => `it-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  test('a quest from the Quests form shows on the other device; rewards come back', async ({
    browser,
  }) => {
    const address = unique();
    const a = await newDevice(browser);
    await signUpOn(a.page, address);
    await addQuestThroughForm(a.page, 'Shared homework', [['Open the book', 2]], {
      fromToday: true,
    });
    await synced(a.page);

    const b = await newDevice(browser);
    await signInOn(b.page, address);
    await syncByReload(b.page, '/');
    const board = b.page.getByRole('region', { name: 'Active quests' });
    await expect(board.getByRole('link', { name: 'Shared homework' })).toBeVisible();

    // Complete the (quick) step on B.
    await board.getByRole('link', { name: 'Shared homework' }).click();
    await b.page.getByRole('checkbox', { name: /Open the book/ }).click();
    await expect(b.page.getByRole('checkbox', { name: /Open the book/ })).toBeChecked();
    await expect(b.page.getByTestId('header-gold')).not.toHaveText(/^Gold:\s*0$/);
    const bGold = await b.page.getByTestId('header-gold').textContent();
    await synced(b.page);

    // A sees the XP and gold earned on B.
    await syncByReload(a.page, '/');
    await expect(a.page.getByTestId('header-gold')).toHaveText(bGold!);
    await expect(a.page.getByRole('progressbar', { name: 'Experience' })).not.toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    await a.context.close();
    await b.context.close();
  });

  test('a focus session started on one device continues on the other', async ({ browser }) => {
    const address = unique();
    const a = await newDevice(browser);
    await signUpOn(a.page, address);
    await addQuestThroughForm(a.page, 'Read chapter', [['Read pages 1-20', 20]], {
      fromToday: true,
    });
    await a.page.goto('/');
    await a.page.getByRole('button', { name: /^Start/ }).click();
    await expect(a.page).toHaveURL(/\/focus\/[0-9a-f-]{36}$/);
    const sessionId = a.page.url().split('/').pop()!;
    await expect(a.page.getByTestId('focus-timer')).toBeVisible();
    await outboxEmpty(a.page);

    const b = await newDevice(browser);
    await signInOn(b.page, address);
    await synced(b.page);
    // Opening the app on B brings it into the running session.
    await b.page.goto('/');
    await expect(b.page).toHaveURL(new RegExp(`/focus/${sessionId}$`));
    const [ta, tb] = await Promise.all([
      a.page.getByTestId('focus-timer').textContent(),
      b.page.getByTestId('focus-timer').textContent(),
    ]);
    expect(Math.abs(seconds(ta) - seconds(tb))).toBeLessThanOrEqual(2);
    expect(seconds(tb)).toBeGreaterThan(19 * 60);

    // Finish it on B; A sees it ended.
    await b.page.getByRole('button', { name: 'Done', exact: true }).click();
    await outboxEmpty(b.page);
    await expect
      .poll(
        async () => {
          await a.page.goto('/settings');
          await synced(a.page);
          const s = (await readTable(a.page, 'focus_sessions')).find((r) => r.id === sessionId);
          return s?.ended_at ?? null;
        },
        { timeout: 30_000 },
      )
      .not.toBeNull();
    await a.page.goto('/');
    await expect(a.page).toHaveURL(/\/$/);
    await a.context.close();
    await b.context.close();
  });

  test('a guest with real quests signs up and the quests reach the account', async ({
    browser,
  }) => {
    const address = unique();
    const a = await newDevice(browser);
    await addQuestThroughForm(a.page, 'Guest essay', [
      ['Open the draft', 2],
      ['Write the intro', 25],
    ]);
    await signUpOn(a.page, address);
    const b = await newDevice(browser);
    await signInOn(b.page, address);
    await synced(b.page);
    await expect.poll(() => liveTitles(b.page)).toEqual(['Guest essay']);
    const steps = (await readTable(b.page, 'steps')).filter((s) => !s.deleted_at);
    expect(steps.map((s) => s.title).sort()).toEqual(['Open the draft', 'Write the intro']);
    await a.context.close();
    await b.context.close();
  });

  test('signing in with guest data into an account with data asks first, then merges', async ({
    browser,
  }) => {
    const address = unique();
    const a = await newDevice(browser);
    await addQuestThroughForm(a.page, 'Phone quest', [['Do it', 2]]);
    await signUpOn(a.page, address);
    const b = await newDevice(browser);
    await addQuestThroughForm(b.page, 'Laptop quest', [['Do it', 2]]);
    await signInOn(b.page, address);
    const dialog = b.page.getByRole('dialog', { name: 'This device has its own progress' });
    await expect(dialog).toBeVisible();
    expect(await liveTitles(b.page)).toEqual(['Laptop quest']); // nothing changed yet
    await expectNoHorizontalScroll(b.page);
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await synced(b.page);
    await expect.poll(() => liveTitles(b.page)).toEqual(['Laptop quest', 'Phone quest']);
    await syncByReload(a.page, '/settings');
    await expect.poll(() => liveTitles(a.page)).toEqual(['Laptop quest', 'Phone quest']);
    await a.context.close();
    await b.context.close();
  });
});

test.describe('local stack with fake AI and Google', () => {
  test.skip(!STACK || !FAKE_URL, 'needs E2E_SUPABASE=1 and E2E_FAKE_URL (fake-services.mjs)');

  test('"Break it down for me" uses the real AI client, then rests kindly at the limit', async ({
    browser,
  }) => {
    const { page, context } = await newDevice(browser);
    const errors = trackErrors(page);
    await signUpOn(page, `ai-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`);
    await page.goto('/quests/new');
    await page.getByLabel('Quest name').fill('Write the essay');
    await page.getByRole('button', { name: 'Break it down for me' }).click();
    await expect(page.getByText(/Here is a plan/)).toBeVisible();
    await expect(page.getByLabel(/^Step \d$/)).toHaveCount(3);
    await expect(page.getByLabel('Step 1', { exact: true })).toHaveValue('Open what you need');
    // Keep asking until the daily limit (small on the test stack) is used up.
    const resting = page.getByText('AI helpers are resting until tomorrow.');
    for (let i = 0; i < 10 && !(await resting.isVisible()); i++) {
      const again = page.getByRole('button', { name: /^(Try again|Break it down for me)$/ });
      if (!(await again.count())) break;
      await again.first().click();
      await page.waitForTimeout(400);
    }
    await expect(resting).toBeVisible();
    await expect(page.getByRole('button', { name: 'Break it down for me' })).toHaveCount(0);
    await page.goto('/settings');
    await expect(page.getByTestId('settings-ai')).toContainText("Today's AI helps are used up");
    expect(errors).toEqual([]);
    await context.close();
  });

  test('the calendar follows quests created, edited, completed, archived and deleted', async ({
    browser,
  }) => {
    const { page, context } = await newDevice(browser);
    await signUpOn(page, `cal-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`);
    // Today's links land on the Cloud screens.
    await page.goto('/');
    await page.getByRole('link', { name: 'Day view' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Day plan' })).toBeVisible();
    await page.getByRole('button', { name: 'Connect Google Calendar' }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(page.getByTestId('calendar-connected')).toContainText('player@gmail.test');
    await expect(page.getByTestId('calendar-timeline')).toContainText('Dentist');

    const events = async () =>
      (await (await fetch(`${FAKE_URL}/__events`)).json()) as Array<{
        id: string;
        summary: string;
        start: { date?: string };
      }>;
    const eventFor = async (id: string) =>
      (await events()).find((e) => e.id === `qlq${id.replace(/-/g, '')}`) ?? null;

    // Created with a due date -> all-day event.
    await addQuestThroughForm(page, 'Library books', [['Find the books', 2]], {
      dueDate: '2030-05-10',
    });
    const first = await questId(page, 'Library books');
    await expect
      .poll(async () => (await eventFor(first))?.start.date, { timeout: 20_000 })
      .toBe('2030-05-10');
    // Due date edited -> the same event moves.
    await page.getByRole('link', { name: 'Edit' }).click();
    await page.getByLabel('Date', { exact: true }).fill('2030-05-12');
    await page.getByRole('button', { name: 'Save quest' }).click();
    await expect
      .poll(async () => (await eventFor(first))?.start.date, { timeout: 20_000 })
      .toBe('2030-05-12');
    // Archived -> removed.
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect.poll(() => eventFor(first), { timeout: 20_000 }).toBeNull();

    // Completed -> ticked; deleted -> removed.
    await addQuestThroughForm(page, 'Return form', [['Sign it', 2]], { dueDate: '2030-05-11' });
    const second = await questId(page, 'Return form');
    await expect
      .poll(async () => (await eventFor(second))?.summary, { timeout: 20_000 })
      .toBe('Return form');
    await page.getByRole('checkbox', { name: /Sign it/ }).click();
    await expect
      .poll(async () => (await eventFor(second))?.summary, { timeout: 20_000 })
      .toBe('✓ Return form');
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect.poll(() => eventFor(second), { timeout: 20_000 }).toBeNull();

    // Disconnect removes access.
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Disconnect Google Calendar' }).click();
    await expect(page.getByTestId('settings-calendar')).toContainText('Connect Google Calendar');
    await context.close();
  });
});
