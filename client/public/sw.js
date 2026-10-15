/* noone service worker — мэдэгдэл болон Web Push.
 * Мессежийн агуулгыг мэдэгдэлд ХЭЗЭЭ Ч гаргахгүй. Кэш хийхгүй. */

const MATCH_BODY = 'Хүн олдлоо — чат эхэллээ';
const MESSAGE_BODY = 'Шинэ мессеж ирлээ';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const isMatch = data.tag === 'noone-match';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const focused = windows.some((c) => c.visibilityState === 'visible' && c.focused);
      // Хэрэглэгч чат руугаа харж байвал мэдэгдэл хэрэггүй (Chrome ганц нэг удаа анхааруулж болно)
      if (focused) return;
      await self.registration.showNotification('noone', {
        body: isMatch ? MATCH_BODY : MESSAGE_BODY,
        tag: isMatch ? 'noone-match' : 'noone-message',
        renotify: true,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: { url: '/' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'noone:open-chat' });
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow('/');
    })(),
  );
});
