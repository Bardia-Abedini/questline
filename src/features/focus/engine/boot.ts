/**
 * "On app open with a running session, the player is brought back to it": once per page
 * load, the first shell page checks for an open session (or a timer end waiting for a
 * choice) and opens focus mode. It never happens again in the same visit, so leaving focus
 * mode to look at Today works, and it never happens when the app opened in focus mode.
 */
let bootPath: string | null = null;
let handled = false;

export function noteBootPath(path: string): void {
  bootPath = path;
}

/** True exactly once, and only when the app did not open in focus mode. */
export function claimBootRedirect(): boolean {
  if (handled) return false;
  handled = true;
  return !(bootPath ?? '').startsWith('/focus');
}

/** Focus mode was shown: no redirect is needed any more this visit. */
export function markBootHandled(): void {
  handled = true;
}
