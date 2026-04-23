import type { AppType } from '@duma-crm/api';
import { hc } from 'hono/client';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/v1`;

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
