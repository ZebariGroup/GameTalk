/* Minevine service worker — static asset cache + offline fallback for navigations */
const CACHE = 'minevine-static-v2';
const PRECACHE_URLS = ['/offline.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const STATIC_EXT = /\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$/i;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('/offline.html').then((r) => r || new Response('Offline', { status: 503, statusText: 'Offline' }))
      )
    );
    return;
  }

  if (STATIC_EXT.test(url.pathname) || url.pathname.endsWith('/manifest.json')) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        });
      })
    );
  }
});
