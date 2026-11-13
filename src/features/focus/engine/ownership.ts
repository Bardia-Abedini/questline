/**
 * One tab owns the focus engine's writes and alerts.
 *
 * With several tabs open, only the owner ends sessions, records time away, nudges and shows
 * notifications, so nothing is written or announced twice. Ownership uses the Web Locks API
 * (the lock is held for the tab's lifetime and passes to a waiting tab when the owner
 * closes). Without Web Locks, a short lease in localStorage is renewed by the owner and
 * claimed by another tab once it expires. Without either, every tab owns itself (a single
 * tab, which is the normal case).
 *
 * Presence is shared too: every tab broadcasts whether it is visible and focused, and the
 * player counts as "here" when any tab is. Sounds play in the tab the player is looking at,
 * or in the owner tab when they are not looking at any.
 */

export const LOCK_NAME = 'ql-focus-engine';
export const LEASE_KEY = 'ql.focus.owner';
export const LEASE_MS = 6000;
export const RENEW_MS = 2000;
export const HEARTBEAT_MS = 10_000;
export const PRESENCE_STALE_MS = 25_000;

export interface Lease {
  tabId: string;
  until: number;
}

export function parseLease(raw: string | null): Lease | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Lease>;
    return typeof v.tabId === 'string' && typeof v.until === 'number'
      ? { tabId: v.tabId, until: v.until }
      : null;
  } catch {
    return null;
  }
}

/** A tab may take (or keep) the lease when nobody holds it, it holds it, or it expired. */
export function canClaim(lease: Lease | null, tabId: string, now: number): boolean {
  return !lease || lease.tabId === tabId || lease.until <= now;
}

export interface PresenceEntry {
  present: boolean;
  at: number;
}

/** Whether the player is looking at any tab (stale reports from closed tabs are ignored). */
export function anyTabPresent(
  others: ReadonlyMap<string, PresenceEntry>,
  selfPresent: boolean,
  now: number,
): boolean {
  if (selfPresent) return true;
  for (const e of others.values()) if (e.present && now - e.at < PRESENCE_STALE_MS) return true;
  return false;
}

/** Which tab plays a chime: the one being looked at, else the owner. Exactly one of them. */
export function shouldPlayAlert(input: {
  selfPresent: boolean;
  anyPresent: boolean;
  isOwner: boolean;
}): boolean {
  return input.selfPresent || (!input.anyPresent && input.isOwner);
}

interface LockLike {
  request(
    name: string,
    options: { signal?: AbortSignal },
    callback: () => Promise<void>,
  ): Promise<unknown>;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface OwnershipOptions {
  tabId: string;
  now: () => number;
  locks?: LockLike | null;
  storage?: StorageLike | null;
  onChange: (owner: boolean) => void;
  setInterval?: (fn: () => void, ms: number) => number;
  clearInterval?: (id: number) => void;
}

export interface Ownership {
  isOwner(): boolean;
  stop(): void;
}

export function createOwnership(opts: OwnershipOptions): Ownership {
  let owner = false;
  const set = (v: boolean) => {
    if (v === owner) return;
    owner = v;
    opts.onChange(v);
  };

  if (opts.locks) {
    const abort = new AbortController();
    let release: (() => void) | null = null;
    opts.locks
      .request(LOCK_NAME, { signal: abort.signal }, () => {
        set(true);
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      })
      .catch(() => {
        /* aborted while waiting, or locks unavailable */
      });
    return {
      isOwner: () => owner,
      stop() {
        abort.abort();
        release?.();
        set(false);
      },
    };
  }

  const storage = opts.storage;
  if (storage) {
    const every = opts.setInterval ?? ((fn, ms) => window.setInterval(fn, ms));
    const clear = opts.clearInterval ?? ((id) => window.clearInterval(id));
    const tick = () => {
      try {
        const now = opts.now();
        if (canClaim(parseLease(storage.getItem(LEASE_KEY)), opts.tabId, now)) {
          storage.setItem(LEASE_KEY, JSON.stringify({ tabId: opts.tabId, until: now + LEASE_MS }));
        }
        set(parseLease(storage.getItem(LEASE_KEY))?.tabId === opts.tabId);
      } catch {
        set(true);
      }
    };
    tick();
    const id = every(tick, RENEW_MS);
    return {
      isOwner: () => owner,
      stop() {
        clear(id);
        try {
          if (parseLease(storage.getItem(LEASE_KEY))?.tabId === opts.tabId) {
            storage.removeItem(LEASE_KEY);
          }
        } catch {
          /* ignore */
        }
        set(false);
      },
    };
  }

  set(true);
  return { isOwner: () => owner, stop: () => set(false) };
}
