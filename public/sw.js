// DUMA service worker — account-scoped offline application access.
//
// Cached per signed-in account:
//   • CRM page navigations and React Server Component payloads
//   • successful same-origin API GET responses under /be/*
//
// Never cached:
//   • mutations
//   • authentication endpoints
//   • cross-origin requests
//
// POS mutations use the application-level offline queue. Other mutations stay
// network-only because each domain needs explicit conflict-resolution rules.

const STATIC_CACHE = 'duma-static-v3';
const USER_CACHE_PREFIX = 'duma-user-v1-';
const CONTEXT_DB = 'duma-offline-context';
const CONTEXT_STORE = 'context';
const CONTEXT_KEY = 'current-user';
const MAX_PAGE_ENTRIES = 120;
const MAX_API_ENTRIES = 500;

let memoryScope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

function openContextDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONTEXT_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CONTEXT_STORE)) {
        request.result.createObjectStore(CONTEXT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readScope() {
  if (memoryScope !== undefined) return memoryScope;
  try {
    const db = await openContextDb();
    memoryScope = await new Promise((resolve, reject) => {
      const request = db.transaction(CONTEXT_STORE, 'readonly').objectStore(CONTEXT_STORE).get(CONTEXT_KEY);
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {
    memoryScope = null;
  }
  return memoryScope;
}

async function writeScope(scope) {
  memoryScope = scope;
  try {
    const db = await openContextDb();
    await new Promise((resolve, reject) => {
      const store = db.transaction(CONTEXT_STORE, 'readwrite').objectStore(CONTEXT_STORE);
      const request = scope ? store.put(scope, CONTEXT_KEY) : store.delete(CONTEXT_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {
    // Cache access can still work for this worker lifetime.
  }
}

async function scopeKey(userId) {
  const bytes = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

const pageCacheName = (scope) => `${USER_CACHE_PREFIX}${scope}-pages`;
const apiCacheName = (scope) => `${USER_CACHE_PREFIX}${scope}-api`;

async function trim(cache, maximum) {
  const keys = await cache.keys();
  if (keys.length <= maximum) return;
  await Promise.all(keys.slice(0, keys.length - maximum).map((key) => cache.delete(key)));
}

function normalizedPageRequest(request) {
  const url = new URL(request.url);
  // Next changes this internal cache-buster between navigations. The response
  // type is still separated below, so removing it makes offline RSC matching
  // reliable without mixing HTML and component payloads.
  url.searchParams.delete('_rsc');
  if (request.headers.get('rsc') === '1') url.searchParams.set('__duma_rsc', '1');
  return new Request(url, { method: 'GET' });
}

async function cacheFirstStatic(event, request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone())));
  }
  return response;
}

async function networkFirst(event, request, cacheName, key, maximum) {
  // Start the network request immediately. Opening Cache Storage first adds
  // measurable latency to every successful online request.
  const cachePromise = caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      event.waitUntil(
        cachePromise.then(async (cache) => {
          await cache.put(key, response.clone());
          await trim(cache, maximum);
        }),
      );
    } else if (response.status >= 500) {
      const cache = await cachePromise;
      const cached = await cache.match(key);
      if (cached) return cached;
    }
    return response;
  } catch {
    const cache = await cachePromise;
    const cached = await cache.match(key);
    if (cached) return cached;
    throw new Error('No offline copy is available');
  }
}

function offlineResponse(isRsc) {
  if (isRsc) return new Response('', { status: 503, headers: { 'Content-Type': 'text/x-component' } });
  return new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>DUMA offline</title><body style="font-family:system-ui;padding:2rem"><h1>This screen is not available offline yet</h1><p>Reconnect once and visit it to save an offline copy.</p></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } },
  );
}

function respondWithLifetime(event, responsePromise) {
  // Register a lifetime promise synchronously. This lets networkFirst attach
  // cache writes after the network response arrives without delaying the
  // response returned to the page.
  event.waitUntil(
    responsePromise.then(
      () => undefined,
      () => undefined,
    ),
  );
  event.respondWith(responsePromise);
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('duma-static-') && key !== STATIC_CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || typeof message.type !== 'string') return;

  if (message.type === 'DUMA_SET_USER' && typeof message.userId === 'string') {
    event.waitUntil(
      (async () => {
        const scope = await scopeKey(message.userId);
        await writeScope(scope);
        event.ports[0]?.postMessage({ ok: true });
      })(),
    );
  }

  if (message.type === 'DUMA_CLEAR_USER') {
    event.waitUntil(
      (async () => {
        const scope = await readScope();
        await writeScope(null);
        if (scope) {
          await Promise.all([caches.delete(pageCacheName(scope)), caches.delete(apiCacheName(scope))]);
        }
        event.ports[0]?.postMessage({ ok: true });
      })(),
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    respondWithLifetime(event, cacheFirstStatic(event, request));
    return;
  }

  if (url.pathname.startsWith('/be/v1/auth/')) return;

  if (url.pathname.startsWith('/be/')) {
    respondWithLifetime(
      event,
      (async () => {
        const scope = await readScope();
        if (!scope) return fetch(request);
        try {
          return await networkFirst(event, request, apiCacheName(scope), request, MAX_API_ENTRIES);
        } catch {
          return new Response(JSON.stringify({ error: 'This data has not been saved for offline use.' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          });
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) return;

  const isNavigation = request.mode === 'navigate';
  const isRsc = request.headers.get('rsc') === '1';
  if (isNavigation || isRsc) {
    respondWithLifetime(
      event,
      (async () => {
        const scope = await readScope();
        if (!scope) return fetch(request);
        const key = normalizedPageRequest(request);
        try {
          return await networkFirst(event, request, pageCacheName(scope), key, MAX_PAGE_ENTRIES);
        } catch {
          return offlineResponse(isRsc);
        }
      })(),
    );
  }
});
