/**
 * System notifications for focus nudges and timer ends. Permission is never asked on load:
 * only from a button the player taps (the welcome-back offer after a first nudge, or the
 * focus settings).
 */

export type PermissionState = NotificationPermission | 'unsupported';

export function notificationPermission(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationPermission() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationPermission();
  }
}

export interface NotifyOptions {
  title: string;
  body: string;
  /** Same tag replaces the previous notification instead of stacking. */
  tag: string;
  onClick?: () => void;
}

/** Shows a notification when permission is granted. Returns whether one was shown. */
export function notify({ title, body, tag, onClick }: NotifyOptions): boolean {
  if (notificationPermission() !== 'granted') return false;
  const options: NotificationOptions = { body, tag, icon: '/icons/icon-192.png', silent: true };
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
    return true;
  } catch {
    // Some mobile browsers only allow notifications through the service worker.
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, options))
        .catch(() => {});
      return true;
    }
    return false;
  }
}
