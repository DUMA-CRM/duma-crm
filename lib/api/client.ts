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
  // Abort the request after this many ms. Important for the POS: behind the
  // same-origin proxy an unreachable API doesn't fail fast — it hangs.
  timeoutMs?: number;
}

/** Error thrown for non-2xx API responses — carries the HTTP status so callers can special-case 401/403/404. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Pull a human-readable message out of an error response body. The API sends
// JSON ({ message } / { error }); anything else (HTML error pages, plain text)
// falls back to the status text rather than dumping markup into toasts.
async function extractErrorMessage(res: Response): Promise<{ message: string; code?: string }> {
  const fallback = `${res.status} ${res.statusText}`.trim();
  try {
    const text = await res.text();
    if (!text) return { message: fallback };
    try {
      const body = JSON.parse(text) as { message?: string; error?: string; code?: string };
      return { message: body.message ?? body.error ?? fallback, code: body.code };
    } catch {
      // Plain-text body: use it only if it doesn't look like an HTML page.
      return { message: text.startsWith('<') ? fallback : text.slice(0, 300) };
    }
  } catch {
    return { message: fallback };
  }
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { cookieHeader, headers, timeoutMs, ...rest } = options;

  // We always send `Content-Type: application/json`, and the API rejects a JSON
  // content type with an empty body ("Invalid JSON in request body"). So for
  // body-bearing methods with no explicit body (e.g. sign-out, revoke-other-
  // sessions) default to an empty object rather than sending nothing.
  const method = (rest.method ?? 'GET').toUpperCase();
  const needsBody = method !== 'GET' && method !== 'HEAD';
  const body = rest.body ?? (needsBody ? '{}' : undefined);

  const res = await fetch(`${API_BASE}${path}`, {
    // Include credentials so the browser sends the session cookie on client-side calls.
    credentials: 'include',
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    headers: {
      'Content-Type': 'application/json',
      // Server-side: forward the full cookie header from the incoming Next.js request.
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...headers,
    },
    ...rest,
    body,
  });

  if (!res.ok) {
    const { message, code } = await extractErrorMessage(res);
    throw new ApiError(res.status, message, code);
  }

  // 204 No Content — return undefined cast as T
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
