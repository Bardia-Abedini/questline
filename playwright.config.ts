import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// This container ships a Chromium build that may not match the pinned @playwright/test version.
// Use it when present; otherwise Playwright's own managed browser is used.
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined;

// E2E_PORT lets several worktrees run e2e at the same time (default 4173). When it is set,
// an existing server on that port is never reused, so each run tests its own build.
const PORT = Number(process.env.E2E_PORT ?? 4173);
const reuseExistingServer = !process.env.CI && !process.env.E2E_PORT;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npx vite build --logLevel warn && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer,
    timeout: 180_000,
  },
});
