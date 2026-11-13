/**
 * "On app open with a running session, the player is brought back to it", without ever
 * trapping them in focus mode:
 *
 * - The first shell page of a page load checks once for an open session (or a timer end
 *   waiting for a choice) and opens focus mode. Never when the app opened in focus mode.
 * - Once the player leaves focus mode for a session, this tab remembers it (sessionStorage),
 *   so later shell pages and reloads in the same tab session stay put; only the banner
 *   invites them back. Going back into focus mode clears that, and a new tab or window
 *   (a fresh app open) is brought back again.
 *
 * It also remembers the last shell page, so "stop for now" can return to the quest the
 * player started from.
 */
let bootPath: string | null = null;
let handled = false;

const LEFT_KEY = 'ql.focus.left';
const LAST_SHELL_KEY = 'ql.focus.lastShell';

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable: worst case the banner is all there is */
  }
}

export function noteBootPath(path: string): void {
  bootPath = path;
}

/**
 * True exactly once per page load, only when the app did not open in focus mode and the
 * player has not left focus mode for `sessionId` in this tab.
 */
export function claimBootRedirect(sessionId: string | null): boolean {
  if (handled) return false;
  handled = true;
  if (!sessionId || (bootPath ?? '').startsWith('/focus')) return false;
  return read(LEFT_KEY) !== sessionId;
}

/** Focus mode is showing `sessionId`: no redirect is needed this visit. */
export function enteredFocus(): void {
  handled = true;
  write(LEFT_KEY, null);
}

/** The player left focus mode while on `sessionId`. */
export function leftFocus(sessionId: string): void {
  write(LEFT_KEY, sessionId);
}

export function noteShellPath(path: string): void {
  write(LAST_SHELL_KEY, path);
}

export function lastShellPath(): string | null {
  return read(LAST_SHELL_KEY);
}
