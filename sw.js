const CACHE = 'chormanager-v2';

// ===== INSTALL =====
self.addEventListener('install', e => {
  self.skipWaiting();
});

// ===== ACTIVATE =====
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ===== PUSH: empfange Benachrichtigung =====
self.addEventListener('push', e => {
  let data = { title: 'Chormanager', body: 'Neue Info' };
  try { data = e.data?.json() || data; } catch (_) {}

  const options = {
    body: data.body || '',
    icon: '/chor-manager/icon-192.png',
    badge: '/chor-manager/icon-192.png',
    tag: 'chormanager-info',       // überschreibt vorherige Notification
    renotify: true,
    data: { url: data.url || '/chor-manager/' },
    actions: [
      { action: 'open', title: 'Öffnen' },
      { action: 'close', title: 'Schließen' }
    ]
  };

  e.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      // Badge setzen (Zahl auf App-Icon)
      self.registration.badge
        ? self.registration.badge.set(data.badgeCount || 1)
        : (navigator.setAppBadge ? navigator.setAppBadge(data.badgeCount || 1) : Promise.resolve())
    ])
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'close') return;

  const url = e.notification.data?.url || '/chor-manager/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // App schon offen? Fokussieren
      for (const client of clients) {
        if (client.url.includes('chor-manager') && 'focus' in client) {
          return client.focus();
        }
      }
      // Sonst neu öffnen
      return self.clients.openWindow(url);
    })
  );
});

// ===== PUSH SUBSCRIPTION CHANGE =====
self.addEventListener('pushsubscriptionchange', e => {
  // Subscription erneuern — wird vom App-Code behandelt
  console.log('Push subscription changed');
});
