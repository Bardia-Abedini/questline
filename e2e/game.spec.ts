import { expect, test, type Page } from '@playwright/test';

/**
 * Game package: shop, cosmetics, cottage, power-ups, daily quests, achievements, reward
 * effects and level-ups. Gold and progress are seeded through Game's test-only hooks
 * (`window.__qlGame`, enabled by `localStorage['ql.game.testHooks']`), which call the same
 * services the app uses. Runs at phone and desktop sizes.
 */

interface Hooks {
  grant(gold: number, xp?: number): Promise<void>;
  finishQuest(o?: { difficulty?: string; boss?: boolean }): Promise<void>;
  setDailyQuests(keys: string[]): Promise<void>;
}
declare global {
  interface Window {
    __qlGame: Hooks;
  }
}

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function start(page: Page, path = '/', prefs?: Record<string, string>) {
  await page.addInitScript((p) => {
    localStorage.setItem('ql.game.testHooks', '1');
    if (p && !sessionStorage.getItem('prefs-seeded')) {
      sessionStorage.setItem('prefs-seeded', '1');
      localStorage.setItem('ql:prefs', JSON.stringify(p));
    }
  }, prefs ?? null);
  await page.goto(path);
  await page.waitForFunction(() => !!window.__qlGame);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}

const grant = (page: Page, gold: number, xp = 0) =>
  page.evaluate(([g, x]) => window.__qlGame.grant(g!, x), [gold, xp]);

test('user reward: create, not enough gold, earn, buy, redeem', async ({ page }) => {
  const errors = trackErrors(page);
  await start(page, '/shop');
  await page.getByRole('button', { name: 'New reward' }).click();
  const dialog = page.getByRole('dialog', { name: 'New reward' });
  await dialog.getByLabel('Reward', { exact: true }).fill('Movie night');
  await dialog.getByLabel('Price in gold').fill('40');
  await dialog.getByRole('button', { name: '🎬' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  const card = page.getByTestId('user-reward').filter({ hasText: 'Movie night' });
  await expect(card).toBeVisible();
  // Friendly not-enough-gold state, never an error.
  await expect(card.getByTestId('need-more')).toContainText('40 more gold to go');

  await grant(page, 50);
  await card.getByRole('button', { name: 'Buy: Movie night' }).click();
  await expect(page.getByTestId('shop-balance')).toHaveText('10 gold');
  const inventory = page.getByTestId('reward-inventory');
  await expect(inventory).toContainText('Movie night');
  await inventory.getByRole('button', { name: 'Enjoy Movie night' }).click();
  await expect(page.getByTestId('reward-note-redeem')).toBeVisible();
  await expect(page.getByTestId('reward-history')).toContainText('Movie night');
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('cosmetics: locked item shows its level; buy and equip changes the header avatar', async ({
  page,
}) => {
  await start(page, '/shop?tab=cosmetics');
  await page.getByTestId('cosmetic-outfit_star_robe').click();
  await expect(page.getByTestId('locked-note')).toHaveText('Unlocks at level 10');
  // Close with the dialog's own button and wait until it is gone. (Escape raced the
  // dialog's key listener, which is attached in an effect after the first paint; when it
  // was lost the open dialog made the page inert and the next click waited until timeout.)
  const preview = page.getByRole('dialog', { name: 'Stargazer robe' });
  await preview.getByRole('button', { name: 'Close' }).click();
  await expect(preview).toHaveCount(0);

  await page.getByTestId('cosmetic-hat_beanie').click();
  await expect(page.getByTestId('need-more')).toContainText('50 more gold');
  await grant(page, 60);
  await page.getByRole('button', { name: 'Buy for 50 gold' }).click();
  await page.getByRole('button', { name: 'Use' }).click();
  await expect(page.getByTestId('avatar-badge').first()).toHaveAttribute(
    'data-look',
    /"hat":"hat_beanie"/,
  );
  await expectNoHorizontalScroll(page);
});

test('cottage: a placed decoration stays after reload', async ({ page }) => {
  await start(page, '/shop?tab=cosmetics&item=corner_plant');
  await grant(page, 40);
  await page.getByRole('button', { name: 'Buy for 40 gold' }).click();
  await expect(page.getByRole('button', { name: 'Use' })).toBeVisible();
  await page.goto('/home');
  await page.getByRole('button', { name: 'Decorate' }).click();
  const sheet = page.getByRole('dialog', { name: 'Decorate your room' });
  await sheet.getByRole('button', { name: 'Corner' }).click();
  await sheet.getByRole('button', { name: 'Tall leafy plant' }).click();
  await expect(sheet.getByRole('button', { name: 'Tall leafy plant' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await sheet.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await expect(
    page.getByRole('img', { name: 'Your cottage room' }).locator('[data-slot="corner"]'),
  ).toHaveAttribute('data-item', 'corner_plant');
  await page.getByRole('radio', { name: 'Outside' }).click();
  await expect(page.getByRole('img', { name: 'Your cottage from outside' })).toBeVisible();
});

test('power-ups: buy and use each one, reroll a daily quest', async ({ page }) => {
  await start(page, '/shop?tab=powerups');
  await grant(page, 200);
  for (const name of ['Lucky charm', 'Double-XP potion', 'Daily quest reroll']) {
    await page.getByRole('button', { name: `Buy: ${name}` }).click();
  }
  const charm = page.getByTestId('powerup-lucky_charm');
  await expect(charm.getByTestId('powerup-count')).toHaveText('You have 1');
  await charm.getByRole('button', { name: 'Use one: Lucky charm' }).click();
  await expect(charm.getByTestId('powerup-active')).toContainText('left');
  await expect(charm.getByTestId('powerup-count')).toHaveText('You have 0');

  const potion = page.getByTestId('powerup-double_xp_potion');
  await potion.getByRole('button', { name: 'Use one: Double-XP potion' }).click();
  await expect(potion.getByTestId('powerup-active')).toHaveText(
    'Waiting for your next focus session',
  );

  await page.goto('/');
  await expect(page.getByTestId('daily-quest')).toHaveCount(3);
  const before = await page.getByTestId('daily-quest').allInnerTexts();
  await page.getByRole('button', { name: /^Swap/ }).first().click();
  await expect(page.getByText('Swapped for a fresh goal')).toBeVisible();
  await expect.poll(() => page.getByTestId('daily-quest').allInnerTexts()).not.toEqual(before);
  await expect(page.getByRole('button', { name: /^Swap/ })).toHaveCount(0);
});

test('daily quests: three show and one completes from an event', async ({ page }) => {
  await start(page, '/');
  await expect(page.getByTestId('daily-quest')).toHaveCount(3);
  await page.evaluate(() => window.__qlGame.setDailyQuests(['steps_1', 'focus_50', 'energy_1']));
  await expect(page.getByTestId('daily-quest').first()).toContainText('Finish 1 step');
  await page.evaluate(() => window.__qlGame.finishQuest());
  await expect(page.getByTestId('daily-quest').first()).toHaveAttribute('data-done', 'true');
  await expect(page.getByTestId('daily-quest').nth(1)).toHaveAttribute('data-done', 'false');
  await expect(page.getByTestId('reward-note-daily')).toBeVisible();
});

test('reward effects and achievement toast and gallery', async ({ page }) => {
  await start(page, '/');
  await page.evaluate(() => window.__qlGame.finishQuest());
  await expect(page.getByTestId('reward-float').first()).toBeVisible();
  await expect(page.getByTestId('reward-float').first()).toContainText('XP');
  const note = page.getByTestId('reward-note-achievement');
  await expect(note).toBeVisible();
  await note.getByRole('button', { name: 'See it' }).click();
  await expect(page).toHaveURL(/\/home\?tab=achievements/);
  await expect(page.getByTestId('achievement-first_step')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('achievement-steps_100')).toHaveAttribute('data-unlocked', 'false');
  await expectNoHorizontalScroll(page);
});

test('reward effects show in focus mode too', async ({ page }) => {
  await start(page, '/focus');
  await page.evaluate(() => window.__qlGame.finishQuest());
  await expect(page.getByTestId('reward-float').first()).toBeVisible();
});

test('level-up celebration appears and can be dismissed; boss defeat celebrates', async ({
  page,
}) => {
  await start(page, '/');
  await grant(page, 0, 150);
  const card = page.getByRole('dialog', { name: 'Level 2!' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Gift: 20 gold');
  await card.getByRole('button', { name: 'Nice!' }).click();
  await expect(card).toHaveCount(0);
  // The page stays usable underneath (the celebration is not modal).
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Home', exact: true })
    .click();
  await page.evaluate(() => window.__qlGame.finishQuest({ difficulty: 'E', boss: true }));
  await expect(page.getByRole('dialog', { name: 'Boss defeated!' })).toBeVisible();
});

test('Persian pass: home and shop in RTL with no horizontal scroll', async ({ page }) => {
  const errors = trackErrors(page);
  await start(page, '/home', { language: 'fa' });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.evaluate(() => window.__qlGame.finishQuest());
  await expect(page.getByRole('heading', { level: 1, name: 'خانه' })).toBeVisible();
  for (const tab of ['کلبه', 'ماجراجو', 'نشان‌ها']) {
    await page.getByRole('tab', { name: tab }).click();
    await expectNoHorizontalScroll(page);
  }
  await page.goto('/shop');
  await expect(page.getByRole('heading', { level: 1, name: 'فروشگاه' })).toBeVisible();
  for (const tab of ['جایزه‌های من', 'تزئینی', 'نیروزاها']) {
    await page.getByRole('tab', { name: tab }).click();
    await expectNoHorizontalScroll(page);
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ماموریت‌های روزانه' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(errors).toEqual([]);
});

/* ------------------------------------------ with the real Quests and Focus screens */

/** Adds a quest through the real form and lands on its detail page. */
async function addRealQuest(
  page: Page,
  title: string,
  steps: Array<[string, number]>,
  difficulty?: string,
) {
  await page.goto('/quests/new');
  await page.getByLabel('Quest name').fill(title);
  for (const [step, minutes] of steps) {
    await page.getByPlaceholder('e.g. Open the document').fill(step);
    await page.getByLabel('Minutes for the new step').fill(String(minutes));
    await page.getByPlaceholder('e.g. Open the document').press('Enter');
  }
  if (difficulty) {
    await page.getByRole('button', { name: 'More details' }).click();
    await page.getByRole('radio', { name: difficulty, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Save quest' }).click();
  await expect(page).toHaveURL(/\/quests\/[0-9a-f-]{36}$/);
}

/** Nothing (a reward pill or card) sits on top of this button's centre. */
async function expectUncovered(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toBeVisible();
  const covered = await button.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !(top && (el === top || el.contains(top)));
  });
  expect(covered, `${name} is covered`).toBe(false);
}

test('core loop on the real screens: finish a step, see the reward, spend the gold', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByTestId('header-gold')).toHaveText(/^Gold:\s*0$/);
  await addRealQuest(page, 'Water the plants', [['Fill the can', 2]]);
  await page.getByRole('checkbox', { name: /Fill the can/ }).click();
  await expect(page.getByTestId('reward-float').first()).toBeVisible();
  await expect(page.getByTestId('reward-float').first()).toContainText('XP');
  await expect(page.getByTestId('header-gold')).not.toHaveText(/^Gold:\s*0$/);
  // The pill is short-lived.
  await expect(page.getByTestId('reward-float')).toHaveCount(0, { timeout: 4000 });

  // Spend it: round glasses cost 35 gold (the quest and first badges pay more than that).
  await page.goto('/shop?tab=cosmetics&item=acc_glasses');
  await page.getByRole('button', { name: 'Buy for 35 gold' }).click();
  await page.getByRole('button', { name: 'Use' }).click();
  await expect(page.getByTestId('avatar-badge').first()).toHaveAttribute(
    'data-look',
    /"accessory":"acc_glasses"/,
  );
  expect(errors).toEqual([]);
});

test('daily quests progress from real actions on Today', async ({ page }) => {
  await start(page, '/');
  // Fix today's goals so the test knows which ones the actions complete.
  await page.evaluate(() => window.__qlGame.setDailyQuests(['steps_1', 'quest_1', 'focus_50']));
  await addRealQuest(page, 'Reply to Sam', [['Write two lines', 3]]);
  await page.getByRole('checkbox', { name: /Write two lines/ }).click();
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Today', exact: true })
    .click();
  const goals = page.getByTestId('daily-quest');
  await expect(goals).toHaveCount(3);
  await expect(goals.nth(0)).toHaveAttribute('data-done', 'true');
  await expect(goals.nth(1)).toHaveAttribute('data-done', 'true');
  await expect(goals.nth(2)).toHaveAttribute('data-done', 'false');
});

test('focus mode Done shows reward effects without covering the next action', async ({ page }) => {
  await page.goto('/');
  await addRealQuest(page, 'Essay', [
    ['Outline the essay', 15],
    ['Write the intro', 20],
  ]);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Outline the essay' })).toBeVisible();
  await expectUncovered(page, 'Done');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByTestId('reward-float').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Step done!' })).toBeVisible();
  await expectUncovered(page, 'Start next step');
});

test('a real boss quest celebrates its defeat', async ({ page }) => {
  await page.goto('/');
  await addRealQuest(page, 'Tax forms', [['Find the letter', 3]], 'S');
  await page.getByRole('button', { name: 'Turn into a boss' }).click();
  await page.getByRole('checkbox', { name: /Find the letter/ }).click();
  // An S-rank finish also levels up; celebrations come one at a time.
  const boss = page.getByRole('dialog', { name: 'Boss defeated!' });
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Nice!' }).first().waitFor();
    if (await boss.isVisible()) break;
    await page.getByRole('button', { name: 'Nice!' }).first().click();
  }
  await expect(boss).toBeVisible();
});

/* ------------------------------------------------------------ focus mode stays clear */

const FOCUS = {
  en: { keep: 'Keep going', done: 'Done', next: 'Start next step' },
  fa: { keep: 'ادامه می‌دهم', done: 'تمام شد', next: 'شروع قدم بعدی' },
} as const;

/** The reward note never overlaps the timer, any heading or any button on the screen. */
async function expectNoteClear(page: Page, screen: string) {
  const note = page.getByTestId('focus-reward-note');
  await expect(note, `note on ${screen}`).toBeVisible();
  const overlaps = await page.evaluate(() => {
    const n = document.querySelector('[data-testid="focus-reward-note"]')!.getBoundingClientRect();
    const hit = (r: DOMRect) =>
      r.width > 0 &&
      r.height > 0 &&
      r.left < n.right &&
      r.right > n.left &&
      r.top < n.bottom &&
      r.bottom > n.top;
    const targets = [
      ...document.querySelectorAll(
        'main h1, main h2, main button, main a, main [role="timer"], [data-testid="focus-timer"], main svg',
      ),
    ];
    return targets
      .filter((el) => !el.closest('[data-testid="reward-effects"]'))
      .filter((el) => hit(el.getBoundingClientRect()))
      .map((el) => `${el.tagName} ${el.textContent?.slice(0, 30) ?? ''}`);
  });
  expect(overlaps, `overlaps on ${screen}`).toEqual([]);
  // One small note at a time, no cards over focus mode.
  await expect(page.getByTestId('focus-reward-note')).toHaveCount(1);
  await expect(page.getByTestId(/^celebration-/)).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath(`${screen.replace(/\W+/g, '-')}.png`) });
}

for (const lang of ['en', 'fa'] as const) {
  test(`focus mode keeps the timer, headings and buttons clear (${lang})`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'phone', 'phone layout is the tight one');
    const L = FOCUS[lang];
    await page.context().addInitScript((lang) => {
      localStorage.setItem('ql.focus.e2e', '1');
      localStorage.setItem('ql.game.testHooks', '1');
      if (lang === 'fa' && !sessionStorage.getItem('ql.fa')) {
        sessionStorage.setItem('ql.fa', '1');
        localStorage.setItem('ql:prefs', JSON.stringify({ language: 'fa' }));
      }
    }, lang);
    await page.clock.install();
    await page.goto('/');
    await page.waitForFunction(() => !!window.__qlGame && !!(window as never)['__qlFocus']);
    const { stepIds } = (await page.evaluate(() =>
      (
        window as unknown as { __qlFocus: { seedQuest(i: unknown): Promise<unknown> } }
      ).__qlFocus.seedQuest({
        title: 'Essay',
        difficulty: 'C',
        steps: [
          { title: 'Outline', guessMinutes: 10 },
          { title: 'Intro', guessMinutes: 15 },
        ],
      }),
    )) as { stepIds: string[] };
    await page.goto(`/focus?step=${stepIds[0]}`);
    await expect(page.getByTestId('focus-timer')).toBeVisible();

    // A queue of several rewards at once: a level-up, badges, a lucky find, a daily quest.
    const burst = () =>
      page.evaluate(async () => {
        const g = window.__qlGame;
        await g.grant(0, 150);
        g.emit('loot.dropped', { kind: 'gold', amount: 5, stepId: 'x' });
        g.emit('achievement.unlocked', { achievementId: 'first_step' });
        g.emit('achievement.unlocked', { achievementId: 'quick_10' });
      });
    await burst();
    await expectNoteClear(page, 'timer');

    await page.clock.fastForward('25:05');
    await expect(
      page
        .getByRole('heading', { level: 2 })
        .or(page.getByRole('heading', { level: 1 }))
        .first(),
    ).toBeVisible();
    await burst();
    await expectNoteClear(page, "time's up");

    await page.getByRole('button', { name: L.keep }).click();
    await page.clock.fastForward('01:00');
    await page.getByRole('button', { name: L.done, exact: true }).click();
    await expect(page.getByRole('button', { name: L.next })).toBeVisible();
    await burst();
    await expectNoteClear(page, 'step done');

    await page.getByRole('button', { name: L.next }).click();
    await page.clock.fastForward('01:00');
    await page.getByRole('button', { name: L.done, exact: true }).click();
    await expect(page.getByTestId('focus-timer')).toHaveCount(0);
    await burst();
    await expectNoteClear(page, 'quest finish');

    // Notes play one after another (never more than one) and then go away by themselves.
    const note = page.getByTestId('focus-reward-note');
    for (let i = 0; i < 20 && (await note.count()) > 0; i++) {
      expect(await note.count()).toBeLessThanOrEqual(1);
      await page.clock.fastForward('00:03');
      await page.waitForTimeout(50);
    }
    await expect(note).toHaveCount(0);
  });
}
