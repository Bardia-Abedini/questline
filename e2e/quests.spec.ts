import { expect, test, type Page } from '@playwright/test';

/**
 * Quests package: add/edit, steps, Today board and the 2-tap start, step completion and
 * rewards, the no-timer warning, active limit and swap sheet, overdue prompt, recurring
 * quests, templates, quick capture, inbox sorting, search and filters, AI break-down (mock)
 * and a Persian pass. Runs at phone and desktop sizes.
 */

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}

async function open(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.getByTestId('header-level')).toBeVisible();
}

interface NewQuest {
  title: string;
  steps?: Array<[string, number?]>;
  fromToday?: boolean;
  details?: (page: Page) => Promise<void>;
}

/** Adds a quest through the form. From Today it goes to Active (when there is room). */
async function addQuest(page: Page, { title, steps = [], fromToday, details }: NewQuest) {
  await open(page, fromToday ? '/quests/new?from=today' : '/quests/new');
  await page.getByLabel('Quest name').fill(title);
  for (const [step, minutes] of steps) {
    await page.getByPlaceholder('e.g. Open the document').fill(step);
    if (minutes) await page.getByLabel('Minutes for the new step').fill(String(minutes));
    await page.getByPlaceholder('e.g. Open the document').press('Enter');
  }
  if (details) {
    await page.getByRole('button', { name: 'More details' }).click();
    await details(page);
  }
  await page.getByRole('button', { name: 'Save quest' }).click();
  if (fromToday) await expect(page).toHaveURL(/\/$/);
  else await expect(page).toHaveURL(/\/quests\/[0-9a-f-]{36}$/);
}

/** Ids of live steps with this title, read straight from IndexedDB. */
async function stepIds(page: Page, title: string): Promise<string[]> {
  return page.evaluate(
    (t) =>
      new Promise<string[]>((resolve, reject) => {
        const req = indexedDB.open('questline');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const all = req.result.transaction('steps').objectStore('steps').getAll();
          all.onsuccess = () =>
            resolve(
              (all.result as { id: string; title: string; deleted_at: string | null }[])
                .filter((s) => s.title === t && s.deleted_at === null)
                .map((s) => s.id),
            );
        };
      }),
    title,
  );
}

const stepList = (page: Page) => page.getByRole('list', { name: 'Steps' });

/** Open (not ended) focus sessions for a step, read straight from IndexedDB. */
async function openSessions(page: Page, stepId: string): Promise<number> {
  return page.evaluate(
    (id) =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('questline');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const all = req.result
            .transaction('focus_sessions')
            .objectStore('focus_sessions')
            .getAll();
          all.onsuccess = () =>
            resolve(
              (
                all.result as {
                  step_id: string;
                  ended_at: string | null;
                  deleted_at: string | null;
                }[]
              ).filter((x) => x.step_id === id && x.ended_at === null && x.deleted_at === null)
                .length,
            );
        };
      }),
    stepId,
  );
}

/** Focus mode is showing this step with a running timer, backed by one open session. */
async function expectFocusOn(page: Page, stepTitle: string, stepId: string) {
  await expect(page).toHaveURL(/\/focus\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: stepTitle })).toBeVisible();
  const timer = page.getByTestId('focus-timer');
  await expect(timer).toBeVisible();
  const before = await timer.textContent();
  await expect(timer).not.toHaveText(before ?? '', { timeout: 3000 });
  expect(await openSessions(page, stepId)).toBe(1);
}

/** Ends the running session so opening the app no longer returns to focus mode. */
async function stopFocus(page: Page) {
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stop for now' }).click();
  await expect(page.getByRole('heading', { name: 'Saved. Rest is part of it.' })).toBeVisible();
}

async function openTab(page: Page, name: string) {
  await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
}

test('a quest with only a title gets one step named after it', async ({ page }) => {
  const errors = trackErrors(page);
  await addQuest(page, { title: 'Return library books' });
  await expect(stepList(page).getByRole('listitem')).toHaveCount(1);
  await expect(
    stepList(page).getByRole('checkbox', { name: /Return library books/ }),
  ).toBeVisible();
  await expect(page.getByText('Waiting in your backlog', { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('a quest with steps keeps them in order, and editing reorders them', async ({ page }) => {
  await addQuest(page, {
    title: 'Essay',
    steps: [
      ['Open the doc', 2],
      ['Write intro', 15],
      ['Proofread', 10],
    ],
  });
  const items = stepList(page).getByRole('listitem');
  await expect(items).toHaveText([/Open the doc/, /Write intro/, /Proofread/]);
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Move step 3 up' }).click();
  await page.getByRole('button', { name: 'Remove step 1' }).click();
  await page.getByRole('button', { name: 'Save quest' }).click();
  await expect(stepList(page).getByRole('listitem')).toHaveText([/Proofread/, /Write intro/]);
});

test('the first-step hint offers a tiny first step without AI', async ({ page }) => {
  await open(page, '/quests/new');
  await page.getByLabel('Quest name').fill('Clean the garage');
  await page.getByPlaceholder('e.g. Open the document').fill('Sort the boxes');
  await page.getByLabel('Minutes for the new step').fill('30');
  await page.getByPlaceholder('e.g. Open the document').press('Enter');
  await expect(page.getByText(/first step under 5 minutes/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Break it down for me' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add a tiny first step' }).click();
  await expect(page.getByLabel('Step 1', { exact: true })).toBeFocused();
  await page.keyboard.type('Open the garage door');
  await expect(page.getByText(/first step under 5 minutes/)).toHaveCount(0);
});

test('two taps from opening the app land in focus on the right step', async ({ page }) => {
  await addQuest(page, {
    title: 'Math homework',
    steps: [
      ['Find the worksheet', 2],
      ['Do problems 1-5', 20],
    ],
    fromToday: true,
  });
  const [first] = await stepIds(page, 'Find the worksheet');
  // Never started, so the big button says Start; one tap starts the timer on the first step.
  await open(page, '/');
  await expect(page.getByRole('button', { name: /^Continue/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Start/ }).click();
  await expectFocusOn(page, 'Find the worksheet', first!);
  await stopFocus(page);
  // After a session it says Continue.
  await open(page, '/');
  await expect(page.getByRole('button', { name: /^Continue/ })).toBeVisible();
});

test('tapping the quest, then Start, also lands in focus', async ({ page }) => {
  await addQuest(page, {
    title: 'Math homework',
    steps: [
      ['Find the worksheet', 2],
      ['Do problems 1-5', 20],
    ],
    fromToday: true,
  });
  const [first] = await stepIds(page, 'Find the worksheet');
  await open(page, '/');
  await page.getByRole('link', { name: 'Math homework' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expectFocusOn(page, 'Find the worksheet', first!);
});

test('checking off a quick step pays XP and gold; the last step finishes the quest', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await addQuest(page, {
    title: 'Tidy desk',
    steps: [
      ['Clear cups', 2],
      ['File papers', 20],
    ],
  });
  await expect(page.getByTestId('header-gold')).toHaveText(/^Gold:\s*0$/);
  const xpBar = page.getByRole('progressbar', { name: 'Experience' });
  await expect(xpBar).toHaveAttribute('aria-valuenow', '0');

  await page.getByRole('checkbox', { name: /Clear cups/ }).click();
  await expect(page.getByRole('checkbox', { name: /Clear cups/ })).toBeChecked();
  await expect(page.getByTestId('header-gold')).not.toHaveText(/^Gold:\s*0$/);
  await expect(xpBar).not.toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A non-quick step with no focus session: the friendly one-time warning.
  await page.getByRole('checkbox', { name: /File papers/ }).click();
  const dialog = page.getByRole('dialog', { name: 'This one looks like it needs focus time' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Yes, I did it' }).click();
  await expect(page.getByRole('checkbox', { name: /File papers/ })).toBeChecked();
  await expect(page.getByText('Quest complete: Tidy desk')).toBeVisible();
  await expect(page.getByText(/^Finished on/)).toBeVisible();
  await open(page, '/quests?tab=done');
  await expect(page.getByRole('link', { name: 'Tidy desk' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the no-timer warning can start the timer instead, and is shown only once', async ({
  page,
}) => {
  await addQuest(page, {
    title: 'Read chapter',
    steps: [
      ['Read pages 1-20', 30],
      ['Notes', 2],
    ],
  });
  const [id] = await stepIds(page, 'Read pages 1-20');
  await page.getByRole('checkbox', { name: /Read pages 1-20/ }).click();
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expectFocusOn(page, 'Read pages 1-20', id!);
  await stopFocus(page);
  await page.goto('/quests');
  await page.getByRole('link', { name: 'Read chapter' }).click();
  await page.getByRole('checkbox', { name: /Read pages 1-20/ }).click();
  await expect(page.getByRole('checkbox', { name: /Read pages 1-20/ })).toBeChecked();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a 4th quest opens the swap sheet; one tap swaps and starts', async ({ page }) => {
  for (const title of ['Quest A', 'Quest B', 'Quest C'])
    await addQuest(page, { title, fromToday: true });
  await expect(page.getByText('3 of 3')).toBeVisible();
  await addQuest(page, { title: 'Quest D', fromToday: true });
  // Active was full, so it waits in the backlog.
  await expect(page.getByRole('link', { name: 'Quest D' })).toHaveCount(0);
  await open(page, '/quests');
  await page.getByRole('button', { name: 'Start “Quest D”' }).click();
  const sheet = page.getByRole('dialog', { name: 'Your active list is full' });
  await expect(sheet).toBeVisible();
  await expectNoHorizontalScroll(page);
  const [stepD] = await stepIds(page, 'Quest D');
  await sheet.getByRole('button', { name: 'Send “Quest B” to the backlog and swap' }).click();
  await expectFocusOn(page, 'Quest D', stepD!);
  await stopFocus(page);
  await open(page, '/');
  const board = page.getByRole('region', { name: 'Active quests' });
  await expect(board.getByRole('link', { name: 'Quest D' })).toBeVisible();
  await expect(board.getByRole('link', { name: 'Quest B' })).toHaveCount(0);
});

test('the active limit can be changed in settings', async ({ page }) => {
  await open(page, '/settings');
  const group = page.getByRole('radiogroup', { name: 'Active quests at once' });
  await expect(group.getByRole('radio', { name: '3' })).toBeChecked();
  await group.getByRole('radio', { name: '1' }).click();
  await expect(group.getByRole('radio', { name: '1' })).toBeChecked();
  await expectNoHorizontalScroll(page);
  await addQuest(page, { title: 'Only one', fromToday: true });
  await expect(page.getByText('1 of 1')).toBeVisible();
  await open(page, '/quests/new?from=today');
  await expect(page.getByRole('switch', { name: 'Put it on Today' })).toBeDisabled();
  await page.reload();
  await open(page, '/settings');
  await expect(
    page
      .getByRole('radiogroup', { name: 'Active quests at once' })
      .getByRole('radio', { name: '1' }),
  ).toBeChecked();
});

test('an overdue quest is asked about once; No archives it', async ({ page }) => {
  const yesterday = await page.evaluate(() => {
    const d = new Date(Date.now() - 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const pastDue = async (p: Page) => {
    await p.getByLabel('Date', { exact: true }).fill(yesterday);
  };
  const prompt = page.getByRole('dialog', { name: 'Can this still be done?' });
  await addQuest(page, { title: 'Old errand', details: pastDue });
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('Old errand');
  await prompt.getByRole('button', { name: 'No, archive it' }).click();
  await expect(prompt).toHaveCount(0);
  await addQuest(page, { title: 'Old letter', details: pastDue });
  await expect(prompt).toContainText('Old letter');
  await prompt.getByRole('button', { name: 'Yes, keep it' }).click();
  await expect(prompt).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('header-level')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await open(page, '/quests?tab=archived');
  await expect(page.getByRole('link', { name: 'Old errand' })).toBeVisible();
  await openTab(page, 'Backlog');
  await expect(page.getByRole('link', { name: 'Old letter' })).toBeVisible();
});

test('finishing a recurring quest creates the next occurrence', async ({ page }) => {
  await addQuest(page, {
    title: 'Water plants',
    steps: [['Fill the can', 2]],
    fromToday: true,
    details: async (p) => {
      await p.getByLabel('Repeat').selectOption('daily');
    },
  });
  await page.getByRole('link', { name: 'Water plants' }).click();
  await expect(page.getByText('Repeats every day')).toBeVisible();
  await page.getByRole('checkbox', { name: /Fill the can/ }).click();
  await expect(page.getByText('Quest complete: Water plants')).toBeVisible();
  await open(page, '/quests');
  await expect(page.getByRole('link', { name: 'Water plants' })).toHaveCount(1);
  await expect(page.getByText(/Due Tomorrow/)).toBeVisible();
  await openTab(page, 'Done');
  await expect(page.getByRole('link', { name: 'Water plants' })).toHaveCount(1);
});

test('templates: save, create from, delete', async ({ page }) => {
  await addQuest(page, {
    title: 'Weekly review',
    steps: [
      ['Check calendar', 3],
      ['Plan week', 10],
    ],
  });
  await page.getByRole('button', { name: 'Save as template' }).click();
  await expect(page.getByText('Template saved from “Weekly review”')).toBeVisible();
  await open(page, '/quests/templates');
  await page.getByRole('link', { name: 'New quest from “Weekly review”' }).click();
  await expect(page.getByLabel('Quest name')).toHaveValue('Weekly review');
  await expect(page.getByLabel('Step 2', { exact: true })).toHaveValue('Plan week');
  await page.getByRole('button', { name: 'Save quest' }).click();
  await expect(stepList(page).getByRole('listitem')).toHaveText([/Check calendar/, /Plan week/]);
  await open(page, '/quests');
  await expect(page.getByRole('link', { name: 'Weekly review' })).toHaveCount(2);
  await open(page, '/quests/templates');
  await page.getByRole('button', { name: 'Delete template “Weekly review”' }).click();
  await expect(page.getByText('No templates yet')).toBeVisible();
});

test('quick capture with the + button and the Q key lands in the Inbox', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'Quick capture' }).click();
  const dialog = page.getByRole('dialog', { name: 'Quick capture' });
  await dialog.getByLabel('What is on your mind?').fill('Buy stamps');
  await dialog.getByLabel('What is on your mind?').press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Saved to your Inbox')).toBeVisible();

  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('q');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('What is on your mind?')).toBeFocused();
  await page.keyboard.type('Email the teacher');
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);

  // Q while typing in a field does not open it.
  await open(page, '/quests');
  await page.getByRole('searchbox', { name: 'Search quests' }).fill('q');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search quests' }).fill('');

  await openTab(page, 'Inbox');
  await expect(page.getByRole('tab', { name: /^Inbox/ })).toContainText('2');
  await expect(page.getByRole('link', { name: 'Buy stamps', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Email the teacher', exact: true })).toBeVisible();
});

test('inbox items are sorted into real quests quickly', async ({ page }) => {
  await open(page, '/');
  for (const text of ['Plan trip', 'Fix bike']) {
    await page.getByRole('button', { name: 'Quick capture' }).click();
    await page.getByLabel('What is on your mind?').fill(text);
    await page.getByRole('button', { name: 'Save to Inbox' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await open(page, '/quests?tab=inbox');
  await page.getByRole('link', { name: 'Sort “Plan trip” into a quest' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sort into a quest' })).toBeVisible();
  await page.getByPlaceholder('e.g. Open the document').fill('Pick dates');
  await page.getByPlaceholder('e.g. Open the document').press('Enter');
  await page.getByRole('button', { name: 'Save as quest' }).click();
  await expect(page).toHaveURL(/tab=inbox/);
  await page.getByRole('button', { name: 'Move “Fix bike” to the backlog' }).click();
  await expect(page.getByText('Inbox is empty')).toBeVisible();
  await openTab(page, 'Backlog');
  await expect(page.getByRole('link', { name: 'Plan trip' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fix bike' })).toBeVisible();
  await page.getByRole('link', { name: 'Plan trip' }).click();
  await expect(stepList(page).getByRole('listitem')).toHaveText([/Pick dates/]);
});

test('search and filters narrow the quest log', async ({ page }) => {
  await addQuest(page, {
    title: 'Math homework',
    details: async (p) => {
      await p.getByRole('radio', { name: 'High priority' }).click();
      await p.getByRole('button', { name: 'School' }).click();
      await p.getByPlaceholder('Add a tag').fill('exam');
      await p.getByRole('button', { name: 'Add tag' }).click();
    },
  });
  await addQuest(page, {
    title: 'Laundry',
    details: async (p) => {
      await p.getByRole('radio', { name: 'Low priority' }).click();
      await p.getByRole('button', { name: 'Home' }).click();
      await p.getByRole('radio', { name: 'E', exact: true }).click();
    },
  });
  await addQuest(page, { title: 'Call grandma' });
  await open(page, '/quests');
  const search = page.getByRole('searchbox', { name: 'Search quests' });
  await search.fill('math');
  await expect(page.getByRole('link', { name: /Math homework|Laundry|Call grandma/ })).toHaveText([
    'Math homework',
  ]);
  await search.fill('exam');
  await expect(page.getByRole('link', { name: 'Math homework' })).toBeVisible();
  await search.fill('nothing like this');
  await expect(page.getByText('No quests match')).toBeVisible();
  await search.fill('');

  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('link', { name: /Math homework|Laundry|Call grandma/ })).toHaveText([
    'Laundry',
  ]);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'High priority' }).click();
  await expect(page.getByRole('link', { name: /Math homework|Laundry|Call grandma/ })).toHaveText([
    'Math homework',
  ]);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Rank E' }).click();
  await expect(page.getByRole('link', { name: /Math homework|Laundry|Call grandma/ })).toHaveText([
    'Laundry',
  ]);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: '#exam' }).click();
  await expect(page.getByRole('link', { name: /Math homework|Laundry|Call grandma/ })).toHaveText([
    'Math homework',
  ]);
  await expectNoHorizontalScroll(page);
});

test('a thought parked in focus mode shows in the Inbox with its origin and can be sorted', async ({
  page,
}) => {
  await addQuest(page, { title: 'Essay', steps: [['Open the doc', 10]] });
  const [id] = await stepIds(page, 'Open the doc');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expectFocusOn(page, 'Open the doc', id!);
  await page.getByRole('button', { name: 'I got distracted' }).click();
  const sheet = page.getByRole('dialog', { name: 'Park that thought' });
  await sheet.getByLabel('What popped up?').fill('Email the teacher');
  await sheet.getByRole('button', { name: 'Park it in Inbox' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await stopFocus(page);
  await open(page, '/quests?tab=inbox');
  const card = page.getByRole('listitem').filter({ hasText: 'Email the teacher' });
  await expect(card.getByText('From a focus session')).toBeVisible();
  await page.getByRole('link', { name: 'Sort “Email the teacher” into a quest' }).click();
  await page.getByRole('button', { name: 'Save as quest' }).click();
  await expect(page.getByText('Inbox is empty')).toBeVisible();
  await openTab(page, 'Backlog');
  await expect(page.getByRole('link', { name: 'Email the teacher', exact: true })).toBeVisible();
});

test('across packages: add a quest, start from Today, finish the step in focus, see it everywhere', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.clock.install();
  await addQuest(page, {
    title: 'Write the essay',
    steps: [
      ['Open the document', 10],
      ['Write the intro', 15],
    ],
    fromToday: true,
  });
  const [first] = await stepIds(page, 'Open the document');
  await open(page, '/');
  await expect(page.getByTestId('header-gold')).toHaveText(/^Gold:\s*0$/);
  const xpBar = page.getByRole('progressbar', { name: 'Experience' });
  await expect(xpBar).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: /^Start/ }).click();
  await expectFocusOn(page, 'Open the document', first!);
  await page.clock.fastForward('12:00');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Step done!' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop for now' }).click();
  await expect(page).not.toHaveURL(/\/focus/);
  await open(page, '/');
  await expect(page.getByTestId('header-gold')).not.toHaveText(/^Gold:\s*0$/);
  await expect(xpBar).not.toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByRole('button', { name: /^Continue/ })).toBeVisible();
  await page.getByRole('link', { name: 'Write the essay' }).click();
  await expect(page.getByRole('checkbox', { name: /Open the document/ })).toBeChecked();
  await expect(stepList(page).getByText('Guessed 10 min · took 12 min')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Write the intro/ })).not.toBeChecked();
  expect(errors).toEqual([]);
});

test.describe('with the AI mock', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ql.ai.mock', '1'));
  });

  test('break it down, edit the plan, try again, then save', async ({ page }) => {
    const errors = trackErrors(page);
    await open(page, '/quests/new');
    // "Clean room" gives a 3-step plan from the mock.
    await page.getByLabel('Quest name').fill('Clean room');
    await page.getByRole('button', { name: 'Break it down for me' }).click();
    await expect(page.getByText(/Here is a plan/)).toBeVisible();
    await expect(page.getByLabel(/^Step \d$/)).toHaveCount(3);
    // Suggested priority, difficulty and time arrive on their own (overridable).
    await expect(page.getByText(/were suggested for you/)).toBeVisible();
    await page.getByRole('button', { name: 'Remove step 2' }).click();
    await page.getByRole('button', { name: 'Move step 2 up' }).click();
    await page.getByLabel('Step 1', { exact: true }).fill('My own first step');
    await expect(page.getByLabel(/^Step \d$/)).toHaveCount(2);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByLabel(/^Step \d$/)).toHaveCount(3);
    await page.getByRole('button', { name: 'Remove step 3' }).click();
    await page.getByRole('button', { name: 'Save quest' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Clean room' })).toBeVisible();
    await expect(stepList(page).getByRole('listitem')).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  test("I'm stuck splits a step into smaller ones", async ({ page }) => {
    await addQuest(page, { title: 'Report', steps: [['Write the report', 30]] });
    await page.getByRole('button', { name: "I'm stuck on “Write the report”" }).click();
    const sheet = page.getByRole('dialog', { name: "Let's make it smaller" });
    await expect(sheet.getByRole('listitem')).toHaveCount(3);
    await sheet.getByRole('button', { name: 'Use these steps' }).click();
    await expect(stepList(page).getByRole('listitem')).toHaveCount(3);
  });
});

test('Persian: the main quest screens fit at any size with no horizontal scroll', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await open(page, '/settings');
  await page.getByRole('radio', { name: 'فارسی' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expectNoHorizontalScroll(page);

  await open(page, '/quests/new?from=today');
  await page.getByLabel('اسم ماموریت').fill('نوشتن مقالهٔ تاریخ برای کلاس پنجشنبه');
  await page.getByPlaceholder('مثلاً: فایل را باز کنم').fill('باز کردن فایل و نوشتن عنوان');
  await page.getByLabel('دقیقه‌های قدم تازه').fill('۱۵');
  await page.getByPlaceholder('مثلاً: فایل را باز کنم').press('Enter');
  await expect(page.getByText(/کمتر از ۵ دقیقه/)).toBeVisible();
  await page.getByRole('button', { name: 'جزئیات بیشتر' }).click();
  await page.getByLabel('تکرار').selectOption('weekdays');
  await expectNoHorizontalScroll(page);
  await page.getByLabel('تکرار').selectOption('none');
  await page.getByRole('button', { name: 'ذخیرهٔ ماموریت' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: /^شروع/ })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByRole('link', { name: 'نوشتن مقالهٔ تاریخ برای کلاس پنجشنبه' }).click();
  await expect(page.getByText('ماموریت فعال')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await open(page, '/quests');
  await page.getByRole('button', { name: 'فیلترها' }).click();
  await expectNoHorizontalScroll(page);
  await openTab(page, 'صندوق ورودی');
  await expectNoHorizontalScroll(page);

  await open(page, '/quests/categories');
  await expectNoHorizontalScroll(page);
  await page.keyboard.press('q');
  await expect(page.getByRole('dialog', { name: 'ثبت سریع' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});
