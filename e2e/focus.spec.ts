import { expect, test, type Page } from '@playwright/test';

/**
 * Focus package end-to-end tests. Time is moved with Playwright's clock (`page.clock`),
 * never waited for. Quests and steps are seeded through the data repositories by a
 * test-only hook (src/features/focus/testing/e2eHooks.ts), enabled by a localStorage flag.
 */

interface Seeded {
  questId: string;
  stepIds: string[];
}

interface Hooks {
  seedQuest(input: unknown): Promise<Seeded>;
  setSettings(patch: Record<string, unknown>): Promise<void>;
  sessions(): Promise<Array<Record<string, unknown> & { distractions: unknown[] }>>;
  step(id: string): Promise<Record<string, unknown>>;
  inbox(): Promise<Array<{ title: string; source: string }>>;
  notes(): Promise<Array<{ text: string; inbox_quest_id: string }>>;
  ledger(): Promise<Array<{ kind: string; xp: number }>>;
}

declare global {
  interface Window {
    __qlFocus: Hooks;
    __notes: Array<{ title: string; body?: string }>;
  }
}

async function boot(page: Page, lang: 'en' | 'fa' = 'en') {
  await page.context().addInitScript((lang) => {
    localStorage.setItem('ql.focus.e2e', '1');
    if (lang === 'fa' && !sessionStorage.getItem('ql.fa')) {
      sessionStorage.setItem('ql.fa', '1');
      localStorage.setItem('ql:prefs', JSON.stringify({ language: 'fa' }));
    }
    // A stand-in for system notifications that records what would be shown.
    const notes: Array<{ title: string; body?: string }> = [];
    window.__notes = notes;
    class FakeNotification {
      static permission = 'granted';
      static requestPermission() {
        return Promise.resolve('granted');
      }
      onclick: (() => void) | null = null;
      constructor(title: string, options?: { body?: string }) {
        notes.push({ title, body: options?.body });
      }
      close() {}
    }
    (window as unknown as { Notification: unknown }).Notification = FakeNotification;
  }, lang);
  await page.clock.install();
  await page.goto('/');
  await page.waitForFunction(() => !!window.__qlFocus);
}

const seed = (page: Page, input: unknown) =>
  page.evaluate((i) => window.__qlFocus.seedQuest(i), input);

const ESSAY = {
  title: 'Write the essay',
  difficulty: 'C',
  steps: [
    { title: 'Open the document', guessMinutes: 10 },
    { title: 'Write the intro', guessMinutes: 15 },
  ],
};

async function startFocus(page: Page, stepId: string, minutes?: number) {
  await page.goto(`/focus?step=${stepId}${minutes ? `&minutes=${minutes}` : ''}`);
  await expect(page).toHaveURL(/\/focus\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId('focus-timer')).toBeVisible();
}

const timer = (page: Page) => page.getByTestId('focus-timer');

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((hidden) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('arriving with a step starts a running timer with no extra tap', async ({ page }) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await expect(page.getByRole('heading', { level: 1, name: 'Open the document' })).toBeVisible();
  await expect(page.getByText('Write the essay')).toBeVisible();
  await expect(page.getByText('Next: Write the intro')).toBeVisible();
  await expect(timer(page)).toHaveText(/^(25:00|24:5\d)$/);
  await page.clock.fastForward('01:00');
  await expect(timer(page)).toHaveText(/^2[34]:\d\d$/);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  for (const name of ['Done', 'Pause', 'I got distracted', 'Stop']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  const sessions = await page.evaluate(() => window.__qlFocus.sessions());
  expect(sessions).toHaveLength(1);
  await expectNoHorizontalScroll(page);
});

test('pause and resume, with the keyboard too', async ({ page }) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  const frozen = await timer(page).textContent();
  await page.clock.fastForward('03:00');
  await expect(timer(page)).toHaveText(frozen!);
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.clock.fastForward('01:00');
  await expect(timer(page)).not.toHaveText(frozen!);

  // Space toggles pause when focus is not on a control; Escape asks before stopping.
  await page.locator('h1').click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Stop for now?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep going' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(timer(page)).toBeVisible();
});

test('reload mid-timer restores the same remaining time', async ({ page }) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await page.clock.fastForward('10:00');
  await expect(timer(page)).toHaveText(/^1[45]:\d\d$/);
  const url = page.url();
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(timer(page)).toHaveText(/^1[45]:\d\d$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Open the document' })).toBeVisible();
});

test('timer end offers a break, and continuing the same step', async ({ page }) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await page.clock.fastForward('25:05');
  await expect(page.getByRole('heading', { name: "Time's up. Nice focus!" })).toBeVisible();
  await expect(page.getByText('You focused 25 min on this step.')).toBeVisible();
  await expect(page.getByText('+5 XP')).toBeVisible();
  await page.getByRole('button', { name: 'Take a 5-minute break' }).click();
  await expect(page.getByRole('heading', { name: 'Take a breather' })).toBeVisible();
  await expect(timer(page)).toHaveText(/^(5:00|4:5\d)$/);
  await page.clock.fastForward('05:05');
  await expect(page.getByRole('heading', { name: "Break's over" })).toBeVisible();
  await page.getByRole('button', { name: 'Back to it' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Open the document' })).toBeVisible();
  await expect(timer(page)).toHaveText(/^(25:00|24:5\d)$/);

  // Keep going: one tap, fresh timer on the same step; the step's time accumulates.
  await page.clock.fastForward('25:05');
  await page.getByRole('button', { name: 'Keep going' }).click();
  await expect(timer(page)).toHaveText(/^(25:00|24:5\d)$/);
  const step = await page.evaluate((id) => window.__qlFocus.step(id), stepIds[0]!);
  expect(step.actual_ms).toBe(50 * 60_000);
});

test('"ended while you were away" after closing and reopening past the end', async ({
  page,
  context,
}) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  const now = await page.evaluate(() => Date.now());
  await page.close();
  const again = await context.newPage();
  await again.clock.install({ time: now + 40 * 60_000 });
  await again.goto('/');
  await expect(again).toHaveURL(/\/focus\/[0-9a-f-]{36}$/);
  await expect(
    again.getByRole('heading', { name: 'Your timer ended while you were away' }),
  ).toBeVisible();
  for (const name of [
    'Take a 5-minute break',
    'Keep going',
    'Done with this step',
    'Stop for now',
  ]) {
    await expect(again.getByRole('button', { name })).toBeVisible();
  }
  const sessions = await again.evaluate(() => window.__qlFocus.sessions());
  expect(sessions[0]).toMatchObject({ end_reason: 'ended_while_away', focused_ms: 25 * 60_000 });
});

test('Done pays XP and shows guess versus actual; next step in one tap; quest finish', async ({
  page,
}) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await page.clock.fastForward('12:00');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Step done!' })).toBeVisible();
  await expect(page.getByTestId('estimate-guess')).toHaveText('10 min');
  await expect(page.getByTestId('estimate-actual')).toHaveText('12 min');
  await expect(page.getByTestId('focus-rewards')).toContainText('+24 XP');
  await expect(page.getByTestId('focus-rewards')).toContainText('+2 XP');
  const kinds = (await page.evaluate(() => window.__qlFocus.ledger())).map((e) => e.kind);
  expect(kinds).toEqual(expect.arrayContaining(['step_reward', 'focus_bonus']));

  await page.getByRole('button', { name: 'Start next step' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Write the intro' })).toBeVisible();
  await expect(page.getByText('This is the last step of the quest')).toBeVisible();
  await page.clock.fastForward('20:00');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quest complete!' })).toBeVisible();
  await expect(page.getByTestId('estimate-guess')).toHaveText('25 min');
  await expect(page.getByTestId('estimate-actual')).toHaveText('32 min');
  await expect(page.getByTestId('focus-rewards')).toContainText('+32 XP');
  await expectNoHorizontalScroll(page);
});

test('Stop keeps the time and it shows in the history', async ({ page }) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await page.clock.fastForward('07:00');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stop for now' }).click();
  await expect(page.getByRole('heading', { name: 'Saved. Rest is part of it.' })).toBeVisible();
  await expect(page.getByText('You focused 7 min on “Open the document”')).toBeVisible();
  await page.getByRole('link', { name: 'Focus history' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Focus history' })).toBeVisible();
  const item = page.getByTestId('history-item');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('Open the document');
  await expect(item).toContainText('Write the essay');
  await expect(item).toContainText('Focused 7 min');
  await expect(item).toContainText('Stopped');
  await expectNoHorizontalScroll(page);
});

test('a distraction note lands in the Inbox and is logged on the session', async ({ page }) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await page.getByRole('button', { name: 'I got distracted' }).click();
  const sheet = page.getByRole('dialog', { name: 'Park that thought' });
  await sheet.getByLabel('What popped up?').fill('Email the teacher');
  await sheet.getByRole('button', { name: 'Park it in Inbox' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Parked in your Inbox')).toBeVisible();
  await expect(timer(page)).toBeVisible();
  const inbox = await page.evaluate(() => window.__qlFocus.inbox());
  expect(inbox.map((q) => [q.title, q.source])).toEqual([['Email the teacher', 'distraction']]);
  const sessions = await page.evaluate(() => window.__qlFocus.sessions());
  expect(sessions[0]!.distractions).toEqual([expect.objectContaining({ kind: 'button' })]);
});

test('leaving the app nudges after the threshold and records time away', async ({ page }) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await setHidden(page, true);
  await page.clock.fastForward('00:30');
  expect(await page.evaluate(() => window.__notes.length)).toBe(0);
  await page.clock.fastForward('00:35');
  await expect
    .poll(() => page.evaluate(() => window.__notes))
    .toEqual([expect.objectContaining({ title: 'Still with your quest?' })]);
  expect((await page.evaluate(() => window.__notes))[0]!.body).toContain('Open the document');
  await setHidden(page, false);
  await expect(page.getByText('Welcome back')).toBeVisible();
  const [s] = await page.evaluate(() => window.__qlFocus.sessions());
  expect(s!.distractions).toEqual([expect.objectContaining({ kind: 'left_app' })]);
  expect(s!.away).toEqual([
    expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
  ]);
  // Time away is never subtracted: the timer kept running.
  await expect(timer(page)).toHaveText(/^2[34]:\d\d$/);
});

test('the pledge shows when enabled, then the timer starts by itself', async ({ page }) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await page.evaluate(() => window.__qlFocus.setSettings({ pledge_enabled: true }));
  await page.goto(`/focus?step=${stepIds[0]}`);
  await expect(page.getByRole('heading', { name: 'Phone away, tabs closed' })).toBeVisible();
  await page.clock.fastForward('00:04');
  await expect(timer(page)).toHaveText(/^(25:00|24:5\d)$/);
});

test('length presets and the 5-minute "just start" option', async ({ page }) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await page.getByRole('button', { name: 'Just 5 minutes' }).click();
  await expect(timer(page)).toHaveText(/^(5:00|4:5\d)$/);
  await page.getByRole('button', { name: '5 min timer' }).click();
  const sheet = page.getByRole('dialog', { name: 'Timer length' });
  await sheet.getByRole('button', { name: '10 min' }).click();
  await expect(timer(page)).toHaveText(/^(10:00|9:5\d)$/);
  await page.getByRole('button', { name: '10 min timer' }).click();
  await page.getByLabel('Custom length (minutes)').fill('30');
  await page.getByRole('button', { name: 'Set', exact: true }).click();
  await expect(timer(page)).toHaveText(/^(30:00|29:5\d)$/);

  // A link can ask for 5 minutes directly.
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stop for now' }).click();
  await expect(page.getByRole('heading', { name: 'Saved. Rest is part of it.' })).toBeVisible();
  await startFocus(page, stepIds[1]!, 5);
  await expect(timer(page)).toHaveText(/^(5:00|4:5\d)$/);
});

test('the banner on shell pages leads back, and app open returns to the session', async ({
  page,
}) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await page.getByRole('button', { name: /Leave focus mode/ }).click();
  const banner = page.getByTestId('focus-banner');
  await expect(banner).toContainText('Focusing: Open the document');
  await expect(banner).toContainText(/2[45]:\d\d left/);
  await expectNoHorizontalScroll(page);
  await banner.getByRole('link', { name: 'Back to focus' }).click();
  await expect(timer(page)).toBeVisible();

  // Opening the app again brings the player straight back to the running session.
  await page.goto('/quests');
  await expect(page).toHaveURL(/\/focus\/[0-9a-f-]{36}$/);
  await expect(timer(page)).toBeVisible();
});

test('a link for another step resumes the open session and offers a switch', async ({ page }) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await page.goto(`/focus?step=${stepIds[1]}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Open the document' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch step' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Write the intro' })).toBeVisible();
  const sessions = await page.evaluate(() => window.__qlFocus.sessions());
  expect(sessions.map((s) => s.end_reason)).toEqual(['stopped', null]);
});

test('Persian: focus mode, time up and history, with no horizontal scroll', async ({ page }) => {
  await boot(page, 'fa');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const { stepIds } = await seed(page, {
    title: 'نوشتن انشا',
    steps: [{ title: 'باز کردن فایل', guessMinutes: 10 }, { title: 'نوشتن مقدمه' }],
  });
  await startFocus(page, stepIds[0]!);
  await expect(page.getByRole('heading', { level: 1, name: 'باز کردن فایل' })).toBeVisible();
  await expect(timer(page)).toHaveText(/^(۲۵:۰۰|۲۴:۵[۰-۹])$/);
  await expect(page.getByRole('button', { name: 'حواسم پرت شد' })).toBeVisible();
  await expect(page.getByText('بعدی: نوشتن مقدمه')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.clock.fastForward('25:05');
  await expect(page.getByRole('heading', { name: 'وقت تمام شد. چه تمرکز خوبی!' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'این قدم تمام شد' }).click();
  await expect(page.getByRole('heading', { name: 'قدم انجام شد!' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.goto('/focus-history');
  await expect(page.getByRole('heading', { level: 1, name: 'تاریخچهٔ تمرکز' })).toBeVisible();
  await expect(page.getByTestId('history-item')).toContainText('باز کردن فایل');
  await expectNoHorizontalScroll(page);
});

test('quick capture in focus mode lands in the Inbox and leaves the timer alone', async ({
  page,
}) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  const before = (await page.evaluate(() => window.__qlFocus.sessions()))[0]!;
  await page.getByRole('button', { name: 'Quick capture' }).click();
  const sheet = page.getByRole('dialog', { name: 'Quick capture' });
  await sheet.getByRole('textbox').fill('Buy stamps');
  await sheet.getByRole('button', { name: 'Save to Inbox' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Saved to your Inbox')).toBeVisible();
  await expect(timer(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  const inbox = await page.evaluate(() => window.__qlFocus.inbox());
  expect(inbox.map((q) => q.title)).toEqual(['Buy stamps']);
  const after = await page.evaluate(() => window.__qlFocus.sessions());
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({
    id: before.id,
    ended_at: null,
    pauses: [],
    distractions: [],
    planned_ms: before.planned_ms,
  });
  // The Q shortcut opens it too.
  await page.locator('h1').click();
  await page.keyboard.press('q');
  await expect(page.getByRole('dialog', { name: 'Quick capture' })).toBeVisible();
});

test('with two tabs open, time away is recorded once and each alert fires once', async ({
  page,
  context,
}) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  const other = await context.newPage();
  await other.goto('/focus-history');
  await other.waitForFunction(() => !!window.__qlFocus);
  await setHidden(other, true);
  await setHidden(page, true);
  await page.clock.fastForward('01:05');
  const notes = async () => [
    ...(await page.evaluate(() => window.__notes)),
    ...(await other.evaluate(() => window.__notes)),
  ];
  await expect.poll(async () => (await notes()).length).toBe(1);
  await page.clock.fastForward('23:58');
  await expect
    .poll(async () => (await notes()).map((n) => n.title))
    .toEqual(['Still with your quest?', "Time's up. Nice focus!"]);
  const [s] = await page.evaluate(() => window.__qlFocus.sessions());
  expect(s).toMatchObject({ end_reason: 'ended_while_away', focused_ms: 25 * 60_000 });
  expect(s!.distractions).toHaveLength(1);
  expect(s!.away as unknown[]).toHaveLength(1);
});

test('leaving focus mode never traps: shell pages and reloads stay put', async ({
  page,
  context,
}) => {
  await boot(page);
  const { stepIds } = await seed(page, ESSAY);
  await startFocus(page, stepIds[0]!);
  await page.getByRole('button', { name: /Leave focus mode/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Quests', exact: true })
    .click();
  await expect(page).toHaveURL(/\/quests$/);
  await page.reload();
  await expect(page.getByTestId('focus-banner')).toBeVisible();
  await expect(page).toHaveURL(/\/quests$/);
  await page.goto('/');
  await expect(page.getByTestId('focus-banner')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  // Only the banner invites them back; a new tab is a fresh app open and is brought back.
  const fresh = await context.newPage();
  await fresh.goto('/');
  await expect(fresh).toHaveURL(/\/focus\/[0-9a-f-]{36}$/);
});

test('after Done, "stop for now" returns to the quest page it started from', async ({ page }) => {
  await boot(page);
  const { questId } = await seed(page, ESSAY);
  await page.goto(`/quests/${questId}`);
  await page.getByRole('button', { name: 'Start focus on “Open the document”' }).click();
  await expect(timer(page)).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Step done!' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop for now' }).click();
  await expect(page).toHaveURL(new RegExp(`/quests/${questId}$`));
});

test('started from Today in two taps, "stop for now" after Done returns to Today', async ({
  page,
}) => {
  await boot(page);
  await seed(page, ESSAY);
  await page.goto('/');
  await page.getByRole('button', { name: /^Continue/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Open the document' })).toBeVisible();
  await expect(timer(page)).toHaveText(/^(25:00|24:5\d)$/);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Stop for now' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
});
