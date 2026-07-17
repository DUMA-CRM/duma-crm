// DUMA service worker — keeps the app shell usable through a Wi-Fi blip.
//
// Strategy (deliberately conservative to avoid stale-deploy bugs):
//   • /_next/static/*  → cache-first. Filenames are content-hashed, so a cached
//     chunk can never be stale.
//   • page navigations → network-first, falling back to the last cached copy of
//     that page when offline. Online behaviour is byte-identical to no-SW.
//   • /be/* and /api/* → untouched. Order queueing/sync happens in the app
//     layer (offlineOrdersStore), never here.

const STATIC_CACHE = 'duma-static-v1';
const PAGE_CACHE = 'duma-pages-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('<h1>Offline</h1><p>Reconnect to keep using DUMA.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/be/') || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  }
});
