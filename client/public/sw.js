/* noone service worker — мэдэгдэл болон Web Push.
 * Чатын мессежийн агуулгыг мэдэгдэлд ХЭЗЭЭ Ч гаргахгүй. Кэш хийхгүй.
 * Нууц ханын (нийтийн) шинэ бичлэгийн мэдэгдэлд л богино preview байна. */

const MATCH_BODY = 'Хүн олдлоо — чат эхэллээ';
const MESSAGE_BODY = 'Шинэ мессеж ирлээ';
const CALL_BODY = 'Дуудлага ирж байна';

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
  const isWall = data.tag === 'noone-wall';
  const wallUrl = typeof data.url === 'string' && /^\/hana(\/cf_[a-f0-9]{12})?$/.test(data.url) ? data.url : '/hana';
  const isCall = data.tag === 'noone-call';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const focused = windows.some((c) => c.visibilityState === 'visible' && c.focused);
      // Хэрэглэгч чат руугаа харж байвал мэдэгдэл хэрэггүй (Chrome ганц нэг удаа анхааруулж болно)
      if (focused) return;
      if (isWall) {
        await self.registration.showNotification('Нууц хана', {
          body: String(data.body || 'Шинэ нууц нийтлэгдлээ').slice(0, 140),
          tag: 'noone-wall',
          renotify: true,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          data: { url: wallUrl },
        });
        return;
      }
      await self.registration.showNotification('noone', {
        body: isMatch ? MATCH_BODY : isCall ? CALL_BODY : MESSAGE_BODY,
        tag: isMatch ? 'noone-match' : isCall ? 'noone-call' : 'noone-message',
        renotify: true,
        requireInteraction: isCall,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: { url: '/' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  const isWallUrl = url.startsWith('/hana');
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage(isWallUrl ? { type: 'noone:navigate', url } : { type: 'noone:open-chat' });
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});
