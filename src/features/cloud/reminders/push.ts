/**
 * Web push on this device. Permission is asked only when the player turns a reminder on.
 */
import { updateNotificationPrefs } from '@/data';
import { b64urlDecode } from '../../../../supabase/functions/_shared/webpush.ts';
import { callFunction } from '../functions';
import { useCloud } from '../store';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function pushSupported(): boolean {
  return notificationsSupported() && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** Asks for notification permission if it was never asked. Returns whether it is granted. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'default') await Notification.requestPermission();
  return Notification.permission === 'granted';
}

export type PushResult = 'enabled' | 'denied' | 'unsupported' | 'unconfigured' | 'guest' | 'failed';

/** Subscribes this browser and turns push on for the account. */
export async function enablePush(): Promise<PushResult> {
  if (useCloud.getState().auth !== 'signed_in') return 'guest';
  if (!pushSupported()) return 'unsupported';
  try {
    const config = await callFunction<{ configured: boolean; publicKey: string | null }>('push', {
      action: 'config',
    });
    if (!config.configured || !config.publicKey) return 'unconfigured';
    if (!(await ensureNotificationPermission())) return 'denied';
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64urlDecode(config.publicKey) as BufferSource,
      }));
    await callFunction('push', {
      action: 'subscribe',
      subscription: sub.toJSON(),
      userAgent: navigator.userAgent,
    });
    await updateNotificationPrefs({ push_enabled: true });
    return 'enabled';
  } catch {
    return 'failed';
  }
}

/** Unsubscribes this browser; push stays on for the account's other devices. */
export async function disablePush(): Promise<void> {
  await updateNotificationPrefs({ push_enabled: false });
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await callFunction('push', { action: 'unsubscribe', endpoint: sub.endpoint }).catch(
    () => undefined,
  );
  await sub.unsubscribe().catch(() => undefined);
}
