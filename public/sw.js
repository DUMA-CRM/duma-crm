// DUMA service worker — account-scoped offline application access.
//
// Cached per signed-in account:
//   • CRM page navigations and React Server Component payloads
//   • successful same-origin API GET responses under /be/*, keyed by the
//     workspace the request named (X-Duma-Workspace / X-Duma-Context) as well
//     as its URL — the workspace travels in a header, so a URL-only key served
//     one workspace's menu or customers to a tab in another
//
// Never cached:
//   • mutations
//   • authentication endpoints
//   • cross-origin requests
//   • API responses marked no-store or private
//   • personal and credential data (SENSITIVE_API_PREFIXES): a shared till
//     must not keep HR, customer or payroll records on disk
//
// Every cached copy carries the time it was stored and is not served once it
// is older than its maximum age.
//
// POS mutations use the application-level offline queue. Other mutations stay
// network-only because each domain needs explicit conflict-resolution rules.

const STATIC_CACHE = 'duma-static-v3';
const USER_CACHE_PREFIX = 'duma-user-v2-';
/** v1 keyed API responses by URL only — mixed across workspaces, so dropped on activate. */
const RETIRED_USER_CACHE_PREFIXES = ['duma-user-v1-'];
const CONTEXT_DB = 'duma-offline-context';
const CONTEXT_STORE = 'context';
const CONTEXT_KEY = 'current-user';
const MAX_PAGE_ENTRIES = 120;
const MAX_API_ENTRIES = 500;
const MAX_PAGE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_API_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const CACHED_AT_HEADER = 'x-duma-cached-at';
const WORKSPACE_HEADER = 'x-duma-workspace';
const CONTEXT_HEADER = 'x-duma-context';

/** API paths never written to the offline cache: personal, payroll and credential data. */
const SENSITIVE_API_PREFIXES = [
  '/be/v1/hr',
  '/be/v1/staff',
  '/be/v1/customers',
  '/be/v1/employee-documents',
  '/be/v1/api-keys',
  '/be/v1/payroll',
  '/be/v1/chatgpt-auth',
  '/be/v1/staff-invitations',
];
/** The signed-in person's own profile: theirs, already scoped to this account's cache, and needed offline. */
const SENSITIVE_API_EXCEPTIONS = new Set(['/be/v1/staff/me']);

function isSensitiveApiPath(pathname) {
  if (SENSITIVE_API_EXCEPTIONS.has(pathname)) return false;
  return SENSITIVE_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Whether the API allowed this response to be kept. */
function isStorableApiResponse(response) {
  const cacheControl = response.headers.get('cache-control') ?? '';
  return !/\b(no-store|private)\b/i.test(cacheControl);
}

/** The cache key for an API GET: its URL plus the workspace (or platform context) it was asked in. */
function apiCacheKey(request) {
  const url = new URL(request.url);
  const workspace = request.headers.get(WORKSPACE_HEADER);
  const context = request.headers.get(CONTEXT_HEADER);
  url.searchParams.set('__duma_scope', workspace ? `w:${workspace}` : context ? `c:${context}` : 'home');
  return new Request(url, { method: 'GET' });
}

/** A copy of the response stamped with when it was stored. */
async function stamped(response) {
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT_HEADER, String(Date.now()));
  const body = await response.blob();
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

/** A cached copy still inside its maximum age, else null (and the stale copy is removed). */
async function freshMatch(cache, key, maxAgeMs) {
  const cached = await cache.match(key);
  if (!cached) return null;
  const storedAt = Number(cached.headers.get(CACHED_AT_HEADER));
  if (!storedAt || Date.now() - storedAt > maxAgeMs) {
    await cache.delete(key);
    return null;
  }
  return cached;
}

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

async function networkFirst(event, request, cacheName, key, { maximum, maxAgeMs, storable = () => true }) {
  // Start the network request immediately. Opening Cache Storage first adds
  // measurable latency to every successful online request.
  const cachePromise = caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      if (storable(response)) {
        const copy = response.clone();
        event.waitUntil(
          cachePromise.then(async (cache) => {
            await cache.put(key, await stamped(copy));
            await trim(cache, maximum);
          }),
        );
      }
    } else if (response.status >= 500) {
      const cached = await freshMatch(await cachePromise, key, maxAgeMs);
      if (cached) return cached;
    }
    return response;
  } catch {
    const cached = await freshMatch(await cachePromise, key, maxAgeMs);
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
      await Promise.all(
        keys
          .filter(
            (key) =>
              (key.startsWith('duma-static-') && key !== STATIC_CACHE) ||
              RETIRED_USER_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)),
          )
          .map((key) => caches.delete(key)),
      );
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

  // Authentication and private agreement copies always require a live request.
  if (url.pathname.startsWith('/be/v1/auth/')
    || /^\/be\/v1\/marketplace\/creator-agreements(?:\/|$)/.test(url.pathname)
    || url.pathname === '/shared-agreement') return;

  // Personal and credential data goes straight to the network, never to disk.
  if (url.pathname.startsWith('/be/') && isSensitiveApiPath(url.pathname)) return;

  if (url.pathname.startsWith('/be/')) {
    respondWithLifetime(
      event,
      (async () => {
        const scope = await readScope();
        if (!scope) return fetch(request);
        try {
          return await networkFirst(event, request, apiCacheName(scope), apiCacheKey(request), {
            maximum: MAX_API_ENTRIES,
            maxAgeMs: MAX_API_AGE_MS,
            storable: isStorableApiResponse,
          });
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
          // Pages are not filtered on Cache-Control: Next marks every dynamic
          // page no-store, and keeping them is the point of offline access.
          return await networkFirst(event, request, pageCacheName(scope), key, {
            maximum: MAX_PAGE_ENTRIES,
            maxAgeMs: MAX_PAGE_AGE_MS,
          });
        } catch {
          return offlineResponse(isRsc);
        }
      })(),
    );
  }
});
