import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke test: the shell loads, every tab works, theme and language switch, there is never
 * horizontal scrolling, and nothing logs an error. Runs at phone and desktop sizes
 * (see playwright.config.ts projects), in English and in Persian.
 */

const LABELS = {
  en: {
    nav: 'Main',
    tabs: [
      ['Today', '/', 'Today'],
      ['Quests', '/quests', 'Quests'],
      ['Home', '/home', 'Home'],
      ['Shop', '/shop', 'Shop'],
      ['Stats', '/stats', 'Stats'],
      ['Settings', '/settings', 'Settings'],
    ],
    dark: 'Dark',
    light: 'Light',
    level: 'Level 1',
  },
  fa: {
    nav: 'اصلی',
    tabs: [
      ['امروز', '/', 'امروز'],
      ['ماموریت‌ها', '/quests', 'ماموریت‌ها'],
      ['خانه', '/home', 'خانه'],
      ['فروشگاه', '/shop', 'فروشگاه'],
      ['آمار', '/stats', 'آمار'],
      ['تنظیمات', '/settings', 'تنظیمات'],
    ],
    dark: 'تیره',
    light: 'روشن',
    level: 'سطح ۱',
  },
} as const;

type Lang = keyof typeof LABELS;

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

async function openTab(page: Page, lang: Lang, name: string) {
  await page
    .getByRole('navigation', { name: LABELS[lang].nav })
    .getByRole('link', { name, exact: true })
    .click();
}

async function switchLanguage(page: Page, to: Lang) {
  const from: Lang = to === 'fa' ? 'en' : 'fa';
  await openTab(page, from, LABELS[from].tabs[5][0]);
  await page.getByRole('radio', { name: to === 'fa' ? 'فارسی' : 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', to);
  await expect(page.locator('html')).toHaveAttribute('dir', to === 'fa' ? 'rtl' : 'ltr');
}

for (const lang of ['en', 'fa'] as const) {
  test(`shell, tabs, theme and language (${lang})`, async ({ page }) => {
    const errors = trackErrors(page);
    const L = LABELS[lang];
    await page.goto('/');
    await expect(page.getByTestId('header-level')).toBeVisible();
    if (lang === 'fa') await switchLanguage(page, 'fa');

    await expect(page.getByTestId('header-level')).toHaveText(L.level);
    await expect(page.getByRole('progressbar').first()).toBeVisible();
    await expect(page.getByTestId('header-gold')).toBeVisible();
    await expect(page.getByTestId('header-streak')).toBeVisible();

    for (const [label, path, heading] of L.tabs) {
      await openTab(page, lang, label);
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : path}$`));
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(
        page
          .getByRole('navigation', { name: L.nav })
          .getByRole('link', { name: label, exact: true }),
      ).toHaveAttribute('aria-current', 'page');
      await expectNoHorizontalScroll(page);
    }

    // Theme: on the Settings page now.
    await page.getByRole('radio', { name: L.dark }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectNoHorizontalScroll(page);
    await openTab(page, lang, L.tabs[0][0]);
    await expectNoHorizontalScroll(page);
    await openTab(page, lang, L.tabs[5][0]);
    await page.getByRole('radio', { name: L.light }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Settings survive a reload (they live in the local database).
    await page.getByRole('radio', { name: L.dark }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('lang', lang);

    // Language toggles both ways.
    const other: Lang = lang === 'en' ? 'fa' : 'en';
    await switchLanguage(page, other);
    await expect(
      page.getByRole('heading', { level: 1, name: LABELS[other].tabs[5][2] }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);

    expect(errors).toEqual([]);
  });
}

test('focus mode is full screen with no app chrome', async ({ page }) => {
  await page.goto('/focus');
  await expect(page.getByRole('heading', { name: 'Focus mode' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByTestId('header-level')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test('unknown paths show a friendly page inside the shell', async ({ page }) => {
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { name: 'This path leads nowhere' })).toBeVisible();
  await expect(page.getByTestId('header-level')).toBeVisible();
});

test('the design-system gallery renders all four variants', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/dev/ui');
  for (const id of ['light-en', 'light-fa', 'dark-en', 'dark-fa']) {
    await expect(page.getByTestId(`gallery-${id}`)).toBeVisible();
  }
  await expect(page.getByTestId('gallery-light-fa')).toHaveAttribute('dir', 'rtl');
  await expectNoHorizontalScroll(page);
  await page.getByTestId('gallery-light-en').getByRole('button', { name: 'Open modal' }).click();
  await expect(page.getByRole('dialog', { name: 'Swap an active quest' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('works offline after the first visit', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'one size is enough for the service worker');
  await page.goto('/');
  await expect(page.getByTestId('header-level')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await context.setOffline(true);
  await page.goto('/quests');
  await expect(page.getByRole('heading', { level: 1, name: 'Quests' })).toBeVisible();
  await context.setOffline(false);
  // The "works offline" toast is shown once per device, never again on later visits.
  await page.reload();
  await expect(page.getByTestId('header-level')).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByText('Questline now works offline')).toHaveCount(0);
});

test('a brand-new device keeps all cached appearance preferences', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(
      'ql:prefs',
      JSON.stringify({ theme: 'dark', textSize: 'larger', font: 'dyslexic', motion: 'reduce' }),
    );
  });
  await page.goto('/');
  await expect(page.getByTestId('header-level')).toBeVisible();
  await page.reload(); // the settings row, not the cache, decides now
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-text-size', 'larger');
  await expect(html).toHaveAttribute('data-font', 'dyslexic');
  await expect(html).toHaveAttribute('data-motion', 'reduce');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Settings', exact: true })
    .click();
  await expect(page.getByRole('radio', { name: 'Larger' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Dyslexia-friendly font' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expectNoHorizontalScroll(page);
});
