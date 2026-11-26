/* Questline notifications, imported into the generated service worker (vite.config.ts,
 * workbox.importScripts). OWNER: Cloud.
 * - push: shows a reminder, unless the app is open and visible (it shows its own toast).
 * - notificationclick (reminders and Focus notifications): focuses an open Questline window
 *   and brings it to the notification's page, or opens one there. */

/** Where a click should lead: data.url, else Focus notifications (tags "ql-focus-*") go to
 * /focus (Focus resumes the open session there), else the app's start page. Same origin only. */
function qlNotificationTarget(notification, origin) {
  const data = notification.data || {};
  let path = typeof data.url === 'string' ? data.url : '';
  if (!path) path = String(notification.tag || '').indexOf('ql-focus') === 0 ? '/focus' : '/';
  const url = new URL(path, origin);
  return url.origin === origin ? url.href : origin + '/';
}

function qlWait(event, promise) {
  try {
    event.waitUntil(promise);
  } catch (e) {
    // Synthetic events (tests) cannot extend their lifetime; the promise still runs.
  }
  return promise;
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Questline', body: event.data ? event.data.text() : '' };
  }
  qlWait(
    event,
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const visible = clients.some((c) => c.visibilityState === 'visible');
      if (visible && data.tag !== 'test') return undefined;
      return self.registration.showNotification(data.title || 'Questline', {
        body: data.body || '',
        tag: data.tag || undefined,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: data.url || '/' },
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = qlNotificationTarget(event.notification, self.location.origin);
  qlWait(
    event,
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        // Focusing can be refused (no user activation); the window still moves to the page.
        const focused = Promise.resolve()
          .then(() => ('focus' in client ? client.focus() : client))
          .catch(() => client);
        const moved =
          client.url === target || !('navigate' in client)
            ? Promise.resolve(client)
            : client.navigate(target).catch(() => client);
        return Promise.all([focused, moved]).then(() => client);
      }
      return self.clients.openWindow(target);
    }),
  );
});
