/**
 * Runs once at app start, after the database is ready. OWNER: Focus.
 * Starts the focus engine (timer ends, time away, nudges) for every route, and remembers
 * where the app opened so the shell can bring the player back to a running session once.
 */
import { startFocusEngine } from './engine/engine';
import { noteBootPath } from './engine/boot';

const E2E_FLAG = 'ql.focus.e2e';

export function setup(): (() => void) | void {
  noteBootPath(window.location.pathname);
  const stop = startFocusEngine();
  let e2e = false;
  try {
    e2e = localStorage.getItem(E2E_FLAG) === '1';
  } catch {
    /* storage unavailable */
  }
  // Test-only seeding helpers for the Playwright suite; never loaded otherwise.
  if (e2e) void import('./testing/e2eHooks').then((m) => m.install());
  return stop;
}
