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
  await page.keyboard.press('Escape');

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
