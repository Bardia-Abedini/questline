// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '../../../public/push-sw.js'), 'utf8');
const ORIGIN = 'https://questline.example';

interface FakeClient {
  url: string;
  focused: boolean;
  focus(): Promise<FakeClient>;
  navigate(url: string): Promise<FakeClient>;
}

function client(url: string): FakeClient {
  const c: FakeClient = {
    url,
    focused: false,
    focus: async () => ((c.focused = true), c),
    navigate: async (to) => ((c.url = to), c),
  };
  return c;
}

/** Loads the service worker script in a sandbox with a fake `self`. */
function loadWorker(clients: FakeClient[]) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const opened: string[] = [];
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (name: string, fn: (e: unknown) => void) => (listeners[name] = fn),
    clients: {
      matchAll: async () => clients,
      openWindow: async (url: string) => (opened.push(url), null),
    },
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) =>
        shown.push({ title, options }),
    },
  };
  const context = { self, URL, console } as Record<string, unknown>;
  runInNewContext(source, context);
  const target = context.qlNotificationTarget as (n: object, origin: string) => string;
  async function click(notification: { tag?: string; data?: unknown }) {
    let work: Promise<unknown> = Promise.resolve();
    listeners.notificationclick!({
      notification: { ...notification, close: () => undefined },
      waitUntil: (p: Promise<unknown>) => (work = p),
    });
    await work;
  }
  async function push(data: unknown) {
    let work: Promise<unknown> = Promise.resolve();
    listeners.push!({ data: { json: () => data }, waitUntil: (p: Promise<unknown>) => (work = p) });
    await work;
  }
  return { target, click, push, opened, shown };
}

describe('service worker notification clicks', () => {
  it('works out the target page', () => {
    const { target } = loadWorker([]);
    expect(target({ tag: 'ql-focus-end' }, ORIGIN)).toBe(`${ORIGIN}/focus`);
    expect(target({ tag: 'ql-focus-nudge' }, ORIGIN)).toBe(`${ORIGIN}/focus`);
    expect(target({ tag: 'due:q1', data: { url: '/quests/q1' } }, ORIGIN)).toBe(
      `${ORIGIN}/quests/q1`,
    );
    expect(target({ tag: 'anything' }, ORIGIN)).toBe(`${ORIGIN}/`);
    // Never somewhere else.
    expect(target({ data: { url: 'https://evil.example/x' } }, ORIGIN)).toBe(`${ORIGIN}/`);
  });

  it('focuses an open window and brings it to the focus session', async () => {
    const open = client(`${ORIGIN}/quests`);
    const sw = loadWorker([open]);
    await sw.click({ tag: 'ql-focus-end' });
    expect(open.focused).toBe(true);
    expect(open.url).toBe(`${ORIGIN}/focus`);
    expect(sw.opened).toEqual([]);
  });

  it('opens the app when no window is open', async () => {
    const sw = loadWorker([]);
    await sw.click({ tag: 'ql-focus-nudge' });
    expect(sw.opened).toEqual([`${ORIGIN}/focus`]);
  });

  it('shows pushed reminders only when the app is not visible', async () => {
    const hidden = { ...client(`${ORIGIN}/`), visibilityState: 'hidden' };
    const sw = loadWorker([hidden]);
    await sw.push({ title: 'Due soon', body: 'x', tag: 'due:q1', url: '/quests/q1' });
    expect(sw.shown).toEqual([
      {
        title: 'Due soon',
        options: expect.objectContaining({ tag: 'due:q1', data: { url: '/quests/q1' } }),
      },
    ]);
    const visible = { ...client(`${ORIGIN}/`), visibilityState: 'visible' };
    const sw2 = loadWorker([visible]);
    await sw2.push({ title: 'Due soon', tag: 'due:q1' });
    expect(sw2.shown).toEqual([]);
  });
});
