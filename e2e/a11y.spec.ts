import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Automated accessibility check (axe-core, WCAG 2.1 A and AA) over the main screens, in the
 * light and dark themes, in English and Persian, at phone and desktop sizes. The screens have
 * real content: one active quest with a finished step and a focus session.
 */

const SCREENS = [
  '/',
  '/quests',
  '/quests/new',
  '/home',
  '/shop',
  '/stats',
  '/settings',
  '/focus',
  '/account',
  '/brain-dump',
  '/calendar',
] as const;

async function seed(page: Page) {
  await page.goto('/quests/new?from=today');
  await page.getByLabel('Quest name').fill('Write the essay');
  await page.getByRole('button', { name: 'Save quest' }).click();
  await expect(page).not.toHaveURL(/\/new/);
  await page.goto('/');
  await page
    .getByRole('button', { name: /^(Start|Continue)/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/focus/);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quest complete!' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Today' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
}

/** The language saved in the local database's settings row. */
function storedLanguage(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const req = indexedDB.open('questline');
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction('settings').objectStore('settings').getAll();
          get.onsuccess = () => {
            resolve((get.result as Array<{ language: string }>).map((r) => r.language).join());
            db.close();
          };
        };
      }),
  );
}

async function scan(page: Page, where: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Reward pop-ups animate in and out; they are checked on the screens they sit on.
    .exclude('[data-testid="reward-float"]')
    .analyze();
  const summary = results.violations.map(
    (v) => `${where} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(summary, `axe on ${where}`).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  for (const lang of ['en', 'fa'] as const) {
    test(`axe finds no problems on the main screens (${theme}, ${lang})`, async ({ page }) => {
      test.slow();
      await page.addInitScript((t) => {
        if (sessionStorage.getItem('seeded-prefs')) return;
        sessionStorage.setItem('seeded-prefs', '1');
        localStorage.setItem('ql:prefs', JSON.stringify({ theme: t, language: 'en' }));
      }, theme);
      await seed(page);
      if (lang === 'fa') {
        await page.goto('/settings');
        await page.getByRole('radio', { name: 'فارسی' }).click();
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        // Wait until the choice is stored before the page reloads on the next screens.
        await expect.poll(() => storedLanguage(page)).toBe('fa');
      }
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const path of SCREENS) {
        await page.goto(path);
        await expect(page.locator('h1').first()).toBeVisible();
        await page.waitForTimeout(250);
        await scan(page, `${path} (${theme}, ${lang})`);
      }
      // The welcome screens and a dialog.
      await page.goto('/welcome?replay=1');
      await expect(page.locator('h1').first()).toBeVisible();
      await scan(page, `/welcome (${theme}, ${lang})`);
    });
  }
}
