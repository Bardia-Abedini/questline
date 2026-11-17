import { expect, test, type Page } from '@playwright/test';

/**
 * The whole first run, as a new player meets it, in English and in Persian, at phone and
 * desktop sizes: onboarding (language, adventurer, first quest), a real 5-minute focus
 * session, the reward, the level in the header, buying and enjoying a real-life reward,
 * and the stats. Also the What-now pick, the energy check and the weekly recap offer.
 */

// These specs meet onboarding: start without the default "skip onboarding" flag.
test.use({ storageState: { cookies: [], origins: [] } });

const L = {
  en: {
    welcome: 'Welcome to Questline',
    begin: "Let's begin",
    adventurer: 'Create your adventurer',
    skin: 'Porcelain',
    hair: 'Long and flowing',
    next: 'Continue',
    firstQuest: 'Add your first quest',
    example: 'Tidy my desk',
    add: 'Add quest',
    session: 'Try just 5 minutes',
    start5: 'Start 5 minutes',
    done: 'Done',
    complete: 'Quest complete!',
    backToday: 'Back to Today',
    today: 'Today',
    level: 'Level 1',
    nav: 'Main',
    shop: 'Shop',
    newReward: 'New reward',
    rewardLabel: 'Reward',
    price: 'Price in gold',
    save: 'Save',
    rewardTitle: 'Tea break',
    buy: 'Buy: Tea break',
    enjoy: 'Enjoy Tea break',
    stats: 'Stats',
    stepsTile: 'Steps finished',
    whatNow: 'What should I do now?',
    energyLow: 'Low',
  },
  fa: {
    welcome: 'به کوئست‌لاین خوش آمدی',
    begin: 'بزن بریم',
    adventurer: 'ماجراجویت را بساز',
    skin: 'چینی',
    hair: 'بلند و رها',
    next: 'ادامه',
    firstQuest: 'اولین ماموریتت را اضافه کن',
    example: 'مرتب کردن میزم',
    add: 'افزودن ماموریت',
    session: 'فقط ۵ دقیقه امتحان کن',
    start5: 'شروع ۵ دقیقه',
    done: 'تمام شد',
    complete: 'ماموریت کامل شد!',
    backToday: 'برگشت به امروز',
    today: 'امروز',
    level: 'سطح ۱',
    nav: 'اصلی',
    shop: 'فروشگاه',
    newReward: 'جایزهٔ تازه',
    rewardLabel: 'جایزه',
    price: 'قیمت به سکه',
    save: 'ذخیره',
    rewardTitle: 'چای و استراحت',
    buy: 'خرید: چای و استراحت',
    enjoy: 'لذت بردن از چای و استراحت',
    stats: 'آمار',
    stepsTile: 'قدم‌های تمام‌شده',
    whatNow: 'الان چه کار کنم؟',
    energyLow: 'کم',
  },
} as const;

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

const tab = (page: Page, lang: 'en' | 'fa', name: string) =>
  page.getByRole('navigation', { name: L[lang].nav }).getByRole('link', { name, exact: true });

for (const lang of ['en', 'fa'] as const) {
  test(`first run: onboarding, first session, reward, shop and stats (${lang})`, async ({
    page,
  }) => {
    const errors = trackErrors(page);
    const t = L[lang];
    await page.goto('/');

    // 1. Welcome and language.
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole('heading', { level: 1, name: L.en.welcome })).toBeVisible();
    if (lang === 'fa') {
      await page.getByRole('radio', { name: 'فارسی' }).click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    }
    await expect(page.getByRole('heading', { level: 1, name: t.welcome })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: t.begin }).click();

    // 2. Adventurer.
    await expect(page.getByRole('heading', { level: 1, name: t.adventurer })).toBeVisible();
    await page.getByRole('radio', { name: t.skin }).click();
    await expect(page.getByRole('radio', { name: t.skin })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: t.hair }).click();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: t.next }).click();

    // Closing the app midway resumes on the same screen.
    await expect(page.getByRole('heading', { level: 1, name: t.firstQuest })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: t.firstQuest })).toBeVisible();

    // 3. First quest from an example.
    await page.getByRole('button', { name: t.example }).click();
    await page.getByRole('button', { name: t.add }).click();

    // 4. A real 5-minute session.
    await expect(page.getByRole('heading', { level: 1, name: t.session })).toBeVisible();
    await page.getByRole('button', { name: t.start5 }).click();
    await expect(page).toHaveURL(/\/focus/);
    await expect(page.getByRole('heading', { level: 1, name: t.example })).toBeVisible();
    await page.getByRole('button', { name: t.done, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.complete })).toBeVisible();
    await page.getByRole('link', { name: t.backToday }).first().click();

    // Back on Today, onboarding is never shown again; level and gold are in the header.
    await expect(page.getByRole('heading', { level: 1, name: t.today })).toBeVisible();
    await expect(page.getByTestId('header-level')).toHaveText(t.level);
    await expect(page.getByTestId('header-gold')).toHaveText(/[1-9۱-۹]/);
    await page.reload();
    await expect(page).not.toHaveURL(/welcome/);

    // 5. Buy and enjoy a real-life reward with the gold.
    await tab(page, lang, t.shop).click();
    await page.getByRole('button', { name: t.newReward }).click();
    const dialog = page.getByRole('dialog', { name: t.newReward });
    await dialog.getByLabel(t.rewardLabel, { exact: true }).fill(t.rewardTitle);
    await dialog.getByLabel(t.price).fill('5');
    await dialog.getByRole('button', { name: t.save }).click();
    await page.getByRole('button', { name: t.buy }).click();
    await page.getByTestId('reward-inventory').getByRole('button', { name: t.enjoy }).click();
    await expect(page.getByTestId('reward-history')).toContainText(t.rewardTitle);

    // 6. Stats show the win.
    await tab(page, lang, t.stats).click();
    await expect(page.getByRole('heading', { level: 1, name: t.stats })).toBeVisible();
    await expect(page.getByText(t.stepsTile, { exact: true })).toBeVisible();
    await expect(page.getByTestId('chart-steps')).toBeVisible();
    await expectNoHorizontalScroll(page);

    expect(errors).toEqual([]);
  });
}

test('skipping onboarding at any step never shows it again', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: "Let's begin" }).click();
  await page.getByRole('button', { name: 'Skip setup' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await expect(page).not.toHaveURL(/welcome/);
});

test('energy check and "What should I do now?" work offline from local rules', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => localStorage.setItem('ql.onboarding.skip', '1'));
  await page.goto('/quests/new?from=today');
  await page.getByLabel('Quest name').fill('Read two pages');
  await page.getByRole('button', { name: 'Save quest' }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await context.setOffline(true);

  const energy = page.getByRole('radiogroup', { name: "How's your energy?" });
  await energy.getByRole('radio', { name: 'Low' }).click();
  await expect(
    page.getByRole('radiogroup', { name: 'Your energy right now' }).getByRole('radio', {
      name: 'Low',
    }),
  ).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'What should I do now?' }).click();
  const pick = page.getByTestId('what-now');
  await expect(pick).toBeVisible();
  await expect(pick.getByRole('heading')).toHaveText('Read two pages');
  await expect(pick.getByTestId('what-now-reason')).not.toBeEmpty();
  // Back online only so the focus page's code can load in this fresh, not yet installed tab
  // (an installed app has it precached).
  await context.setOffline(false);
  await pick.getByRole('button', { name: /^Start.*Read two pages/ }).click();
  await expect(page).toHaveURL(/\/focus/);
  await expect(page.getByRole('heading', { level: 1, name: 'Read two pages' })).toBeVisible();
});

test('"What should I do now?" can pick a backlog quest; with Active full the swap sheet opens', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('ql.onboarding.skip', '1'));
  // Three active quests fill Active (limit 3); the fourth waits in the backlog.
  for (const title of ['Email the tutor', 'Tidy the desk', 'Read two pages', 'Plan the trip']) {
    await page.goto('/quests/new?from=today');
    await page.getByLabel('Quest name').fill(title);
    await page.getByRole('button', { name: 'Save quest' }).click();
    await expect(page).not.toHaveURL(/\/new/);
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'What should I do now?' }).click();
  const pick = page.getByTestId('what-now');
  // Active quests come first; the backlog quest is the fourth offer.
  for (let i = 0; i < 3; i++) {
    await expect(pick.getByRole('heading')).not.toHaveText('Plan the trip');
    await pick.getByRole('button', { name: 'Not this one' }).click();
  }
  await expect(pick.getByRole('heading')).toHaveText('Plan the trip');
  await expect(pick).toContainText('From your backlog');
  await pick.getByRole('button', { name: /^Start.*Plan the trip/ }).click();

  const sheet = page.getByRole('dialog', { name: 'Your active list is full' });
  await expect(sheet).toBeVisible();
  await sheet
    .getByRole('button', { name: /to the backlog and swap/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/focus/);
  await expect(page.getByRole('heading', { level: 1, name: 'Plan the trip' })).toBeVisible();
});

for (const lang of ['en', 'fa'] as const) {
  test(`larger text and the dyslexia font fit every main screen (${lang})`, async ({ page }) => {
    await page.addInitScript((l) => {
      localStorage.setItem('ql.onboarding.skip', '1');
      if (sessionStorage.getItem('prefs')) return;
      sessionStorage.setItem('prefs', '1');
      localStorage.setItem(
        'ql:prefs',
        JSON.stringify({ textSize: 'larger', font: 'dyslexic', language: l }),
      );
    }, lang);
    for (const path of ['/', '/quests', '/quests/new', '/home', '/shop', '/stats', '/settings']) {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      // The header's level text is never cut off.
      const clipped = await page
        .getByTestId('header-level')
        .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(clipped, `header level clipped on ${path}`).toBe(false);
    }
  });
}
