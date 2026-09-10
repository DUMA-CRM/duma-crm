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

/** One field-level complaint from the API's Zod validation. */
export interface ApiFieldIssue {
  field: string;
  message: string;
}

/**
 * Error thrown for non-2xx API responses — carries the HTTP status so callers
 * can special-case 401/403/404.
 *
 * `issues` and `capability` used to be dropped on the floor. The API sends
 * `{ error, code: 'validation_failed', issues: [{ field, message }] }` for a bad
 * payload and `{ error, code: 'missing_capability', capability }` for a refusal
 * (verified in duma-api `src/lib/errors.ts` and `src/middleware/require-capability.ts`),
 * and both were flattened to one sentence. A form could not mark the offending
 * field, and Ask DUMA had to guess which permission was missing from prose it
 * was handed — so it apologised vaguely instead of naming the capability.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly request?: string,
    /** Field-level validation failures, in the API's own order. */
    public readonly issues: ApiFieldIssue[] = [],
    /** The capability the caller was missing, when the API named one. */
    public readonly capability?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function normaliseErrorMessage(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const message = value
    .replaceAll(/[\u0000-\u001F\u007F]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  return message ? message.slice(0, 300) : fallback;
}

// Pull a human-readable message out of an error response body. The API sends
// JSON ({ message } / { error }); anything else (HTML error pages, plain text)
// falls back to the status text rather than dumping markup into toasts.
/** Field issues, clamped the same way messages are — this text reaches the DOM and a model. */
function normaliseIssues(value: unknown): ApiFieldIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 50)
    .map((entry) => {
      const issue = entry as { field?: unknown; message?: unknown; path?: unknown };
      const field = typeof issue.field === 'string' ? issue.field : Array.isArray(issue.path) ? String(issue.path[0] ?? '') : '';
      const message = normaliseErrorMessage(issue.message, '');
      return { field: field.slice(0, 100), message };
    })
    .filter((issue) => issue.field || issue.message);
}

async function extractErrorMessage(res: Response): Promise<{
  message: string;
  code?: string;
  issues: ApiFieldIssue[];
  capability?: string;
}> {
  const fallback = `${res.status} ${res.statusText}`.trim();
  try {
    const text = await res.text();
    if (!text) return { message: fallback, issues: [] };
    try {
      const body = JSON.parse(text) as {
        message?: unknown;
        error?: unknown;
        code?: unknown;
        issues?: unknown;
        capability?: unknown;
      };
      return {
        message: normaliseErrorMessage(body.message ?? body.error, fallback),
        code: typeof body.code === 'string' ? body.code.slice(0, 100) : undefined,
        issues: normaliseIssues(body.issues),
        capability: typeof body.capability === 'string' ? body.capability.slice(0, 100) : undefined,
      };
    } catch {
      // Plain-text body: use it only if it doesn't look like an HTML page.
      return { message: text.trimStart().startsWith('<') ? fallback : normaliseErrorMessage(text, fallback), issues: [] };
    }
  } catch {
    return { message: fallback, issues: [] };
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
    const { message, code, issues, capability } = await extractErrorMessage(res);
    // Keep request internals on the error for diagnostics without putting API
    // paths into every customer-facing toast and inline validation message.
    throw new ApiError(res.status, message, code, `${method} ${path}`, issues, capability);
  }

  // 204 No Content — return undefined cast as T
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
