/* Questline web push, imported into the generated service worker (vite.config.ts,
 * workbox.importScripts). OWNER: Cloud.
 * - push: shows the reminder, unless the app is open and visible (it shows its own toast).
 * - notificationclick: focuses an open Questline window, or opens one at the reminder's url. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Questline', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
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
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === url.origin && 'focus' in client) {
          if ('navigate' in client) client.navigate(url.href).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
