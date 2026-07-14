import type { AppType } from '@duma-crm/api';
import { hc } from 'hono/client';

// The deployed API lives on a DIFFERENT host than the app (e.g. api.dudych.cc
// vs. localhost / the app's own domain). Cookies are scoped by host, so a
// session cookie set directly by the API host can never be read by our app's
// server — which breaks the server-side session check in the CRM layout.
//
// So we split by execution context:
//   • Browser  → same-origin proxy path (`/be/*`, rewritten to the API in
//                next.config.ts). Set-Cookie then lands on OUR origin.
//   • Server   → call the API host directly and forward the cookie value,
//                which the API validates by token (host-independent).
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777';
const isServer = typeof window === 'undefined';

// Base prefix WITHOUT the `/v1` suffix — exported for callers that build their
// own paths (e.g. the receipt download in the orders page).
export const API_PREFIX = isServer ? API_ORIGIN : '/be';
const API_BASE = `${API_PREFIX}/v1`;

export const apiClient = hc<AppType>(API_BASE, { init: { credentials: 'include' } });

// ---------------------------------------------------------------------------
// Low-level fetch wrapper used by service modules.
//
// Why not axios?  Native fetch works in Next.js Server Components, Edge
// Runtime, and the browser — no adapter needed.  TanStack Query sits on top
// for caching, deduplication, and background refetch.
// ---------------------------------------------------------------------------

interface FetchOptions extends RequestInit {
  // Pass this when calling from a Server Component so the session cookie
  // is forwarded to the API (browsers do this automatically client-side).
  cookieHeader?: string;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { cookieHeader, headers, ...rest } = options;

  const res = await fetch(`${API_BASE}${path}`, {
    // Include credentials so the browser sends the session cookie on client-side calls.
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      // Server-side: forward the full cookie header from the incoming Next.js request.
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...headers,
    },
    ...rest,
  });

  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(message);
  }

  // 204 No Content — return undefined cast as T
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
