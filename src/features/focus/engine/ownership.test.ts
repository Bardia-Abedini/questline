import { describe, expect, it, vi } from 'vitest';
import {
  anyTabPresent,
  canClaim,
  createOwnership,
  LEASE_KEY,
  LEASE_MS,
  parseLease,
  PRESENCE_STALE_MS,
  RENEW_MS,
  shouldPlayAlert,
} from './ownership';

/** A minimal Web Locks stand-in: one holder at a time, waiters queue, abort leaves the queue. */
function fakeLocks() {
  let held = false;
  const queue: Array<{ cb: () => Promise<void>; resolve: () => void; signal?: AbortSignal }> = [];
  const next = () => {
    if (held) return;
    const w = queue.shift();
    if (!w) return;
    held = true;
    void w.cb().then(() => {
      held = false;
      w.resolve();
      next();
    });
  };
  return {
    request(_name: string, opts: { signal?: AbortSignal }, cb: () => Promise<void>) {
      return new Promise<void>((resolve, reject) => {
        const entry = { cb, resolve, signal: opts.signal };
        opts.signal?.addEventListener('abort', () => {
          const i = queue.indexOf(entry);
          if (i >= 0) {
            queue.splice(i, 1);
            reject(new DOMException('aborted', 'AbortError'));
          }
        });
        queue.push(entry);
        next();
      });
    },
  };
}

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('lease rules', () => {
  it('claims a free, own or expired lease only', () => {
    expect(canClaim(null, 'a', 0)).toBe(true);
    expect(canClaim({ tabId: 'a', until: 10 }, 'a', 5)).toBe(true);
    expect(canClaim({ tabId: 'b', until: 10 }, 'a', 5)).toBe(false);
    expect(canClaim({ tabId: 'b', until: 10 }, 'a', 10)).toBe(true);
  });
  it('parses only well-formed leases', () => {
    expect(parseLease('{"tabId":"a","until":3}')).toEqual({ tabId: 'a', until: 3 });
    expect(parseLease('nope')).toBeNull();
    expect(parseLease('{"tabId":1}')).toBeNull();
    expect(parseLease(null)).toBeNull();
  });
});

describe('presence and alerts', () => {
  it('the player is here when any fresh tab is visible', () => {
    const others = new Map([['b', { present: true, at: 1000 }]]);
    expect(anyTabPresent(others, false, 1000 + PRESENCE_STALE_MS - 1)).toBe(true);
    expect(anyTabPresent(others, false, 1000 + PRESENCE_STALE_MS)).toBe(false);
    expect(anyTabPresent(new Map(), true, 0)).toBe(true);
    expect(anyTabPresent(new Map([['b', { present: false, at: 0 }]]), false, 0)).toBe(false);
  });
  it('exactly one tab plays a sound', () => {
    // Looking at tab B (not owner): B plays, owner A stays quiet.
    expect(shouldPlayAlert({ selfPresent: true, anyPresent: true, isOwner: false })).toBe(true);
    expect(shouldPlayAlert({ selfPresent: false, anyPresent: true, isOwner: true })).toBe(false);
    // Looking at nothing: only the owner plays.
    expect(shouldPlayAlert({ selfPresent: false, anyPresent: false, isOwner: true })).toBe(true);
    expect(shouldPlayAlert({ selfPresent: false, anyPresent: false, isOwner: false })).toBe(false);
  });
});

describe('ownership with Web Locks', () => {
  it('one owner at a time; the next tab takes over when the owner stops', async () => {
    const locks = fakeLocks();
    const a = vi.fn();
    const b = vi.fn();
    const oa = createOwnership({ tabId: 'a', now: () => 0, locks, onChange: a });
    const ob = createOwnership({ tabId: 'b', now: () => 0, locks, onChange: b });
    await flush();
    expect([oa.isOwner(), ob.isOwner()]).toEqual([true, false]);
    oa.stop();
    await flush();
    expect([oa.isOwner(), ob.isOwner()]).toEqual([false, true]);
    expect(a.mock.calls).toEqual([[true], [false]]);
    expect(b.mock.calls).toEqual([[true]]);
    ob.stop();
  });
  it('a waiting tab that stops leaves the queue quietly', async () => {
    const locks = fakeLocks();
    const oa = createOwnership({ tabId: 'a', now: () => 0, locks, onChange: () => {} });
    const ob = createOwnership({ tabId: 'b', now: () => 0, locks, onChange: () => {} });
    ob.stop();
    oa.stop();
    await flush();
    expect(ob.isOwner()).toBe(false);
  });
});

describe('ownership fallback (localStorage lease)', () => {
  it('keeps one owner, renews, and hands over after the lease expires', () => {
    const storage = fakeStorage();
    let now = 0;
    const timers: Array<() => void> = [];
    const every = (fn: () => void) => timers.push(fn) - 1;
    const oa = createOwnership({
      tabId: 'a',
      now: () => now,
      storage,
      onChange: () => {},
      setInterval: every,
      clearInterval: () => {},
    });
    const ob = createOwnership({
      tabId: 'b',
      now: () => now,
      storage,
      onChange: () => {},
      setInterval: every,
      clearInterval: () => {},
    });
    expect([oa.isOwner(), ob.isOwner()]).toEqual([true, false]);
    // A keeps renewing: B never gets it.
    for (let i = 0; i < 5; i++) {
      now += RENEW_MS;
      timers.forEach((t) => t());
    }
    expect([oa.isOwner(), ob.isOwner()]).toEqual([true, false]);
    // A freezes (closed without cleanup): after the lease runs out, B takes over.
    now += LEASE_MS;
    timers[1]!();
    expect(ob.isOwner()).toBe(true);
    expect(parseLease(storage.getItem(LEASE_KEY))?.tabId).toBe('b');
    ob.stop();
    expect(storage.getItem(LEASE_KEY)).toBeNull();
  });
  it('with neither locks nor storage, the tab owns itself', () => {
    const o = createOwnership({ tabId: 'a', now: () => 0, onChange: () => {} });
    expect(o.isOwner()).toBe(true);
  });
});
