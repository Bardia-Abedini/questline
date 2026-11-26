import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureLocalData } from '@/data/bootstrap';
import { getSettings } from '@/data/repositories';
import { resetAll } from '@/test/db';
import { snapshotAsSettings } from './preferences/preferences';
import { showOfflineReadyOnce } from './pwa/offlineReady';

beforeEach(async () => {
  await resetAll();
});

describe('offline-ready toast', () => {
  it('shows once ever on a device, across visits', async () => {
    const show = vi.fn();
    expect(await showOfflineReadyOnce(show)).toBe(true);
    expect(await showOfflineReadyOnce(show)).toBe(false);
    expect(show).toHaveBeenCalledTimes(1);
  });
});

describe('seeding settings from cached preferences', () => {
  it('maps every valid cached preference to its settings column', () => {
    expect(
      snapshotAsSettings({
        theme: 'dark',
        language: 'fa',
        textSize: 'larger',
        font: 'dyslexic',
        motion: 'reduce',
        sound: false,
        haptics: false,
      }),
    ).toEqual({
      theme: 'dark',
      language: 'fa',
      text_size: 'larger',
      font: 'dyslexic',
      motion: 'reduce',
      sound: false,
      haptics: false,
    });
  });

  it('drops invalid values', () => {
    expect(
      snapshotAsSettings({ theme: 'neon' as never, textSize: 'huge' as never, sound: true }),
    ).toEqual({
      sound: true,
    });
    expect(snapshotAsSettings({})).toEqual({});
  });

  it('a brand-new settings row takes the cached preferences', async () => {
    await ensureLocalData({
      language: 'en',
      settings: snapshotAsSettings({
        theme: 'dark',
        textSize: 'large',
        font: 'dyslexic',
        motion: 'reduce',
        sound: false,
      }),
    });
    expect(await getSettings()).toMatchObject({
      theme: 'dark',
      text_size: 'large',
      font: 'dyslexic',
      motion: 'reduce',
      sound: false,
      language: 'en',
      active_limit: 3,
    });
  });

  it('an existing settings row is never overwritten by the cache', async () => {
    await ensureLocalData({ language: 'en' });
    await ensureLocalData({ language: 'fa', settings: { theme: 'dark' } });
    expect(await getSettings()).toMatchObject({ theme: 'system', language: 'en' });
  });
});
