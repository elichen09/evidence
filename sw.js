/*
 * sw.js — offline cache for Evidence.
 *
 * The app is one HTML file plus a manifest and icons, so the whole thing is
 * cached on install and served from cache thereafter. Once you have opened it
 * once, it runs with no network at all: on a locked-down school connection, in
 * a tournament room with no wifi, on a plane.
 *
 * BUMP THIS WHEN YOU UPLOAD A NEW VERSION.
 * A service worker only replaces its cache when the cache name changes. Leave
 * it alone and the browser will keep serving the old copy indefinitely, which
 * is the usual reason a web app appears "stuck" on an old version.
 */
const VERSION = 'evidence-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== VERSION).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/*
 * Cache first, network second.
 *
 * Deliberate: this app has no server data to be stale about — your library
 * lives in IndexedDB on the device. Speed and working-offline matter far more
 * than picking up a new build the moment it lands, and the version bump above
 * is what handles updates.
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;

      return fetch(req)
        .then((res) => {
          // Only cache our own successful, basic responses.
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => {
          // Offline and not cached: fall back to the app shell for navigations
          // so a refresh never lands on the browser's dinosaur.
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});
