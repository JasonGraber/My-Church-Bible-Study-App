const CACHE_NAME = 'church-study-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Install: cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for navigations, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// Show notification when triggered by the app via postMessage
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || 'Bible Study Reminder', {
        body: body || "Time for today's Bible study!",
        icon: 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 192 192%27%3E%3Crect fill=%27%239333ea%27 width=%27192%27 height=%27192%27 rx=%2732%27/%3E%3Ctext x=%2796%27 y=%27120%27 font-size=%27100%27 text-anchor=%27middle%27 fill=%27white%27%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E',
        badge: 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 96 96%27%3E%3Crect fill=%27%239333ea%27 width=%2796%27 height=%2796%27 rx=%2716%27/%3E%3Ctext x=%2748%27 y=%2768%27 font-size=%2756%27 text-anchor=%27middle%27 fill=%27white%27%3E%F0%9F%93%96%3C/text%3E%3C/svg%3E',
        tag: tag || 'study-reminder',
        renotify: true,
        requireInteraction: true,
        data: { url: self.registration.scope }
      })
    );
  }
});

// Notification click: focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(url) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
