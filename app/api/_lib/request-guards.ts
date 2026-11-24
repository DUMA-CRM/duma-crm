// ---------------------------------------------------------------------------
// Small, pure guards shared by the app's own /api route handlers. Kept free of
// Next and React imports so tests/unit can import the real functions.
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/** The tab-scoping header apiFetch sends (lib/utils/workspace-context.ts WORKSPACE_HEADER). */
const WORKSPACE_HEADER = 'x-duma-workspace';

/**
 * The workspace an /api request is for: the tab's own header when the caller
 * sent one, then a workspace named in the body, then the person's home
 * workspace. Only a UUID is accepted from the request — the API still checks
 * membership on whatever is forwarded, so this only ever narrows.
 */
export function requestWorkspaceId(headers: Headers, ...fallbacks: Array<string | null | undefined>): string | null {
  const header = headers.get(WORKSPACE_HEADER);
  if (isUuid(header)) return header;
  for (const candidate of fallbacks) if (isUuid(candidate)) return candidate;
  return null;
}

export type CappedBody = { ok: true; bytes: ArrayBuffer } | { ok: false; reason: 'empty' | 'too-large' };

/**
 * Read a request body, refusing it once it passes `maxBytes`.
 *
 * `request.arrayBuffer()` buffers whatever arrives: a missing (chunked) or false
 * Content-Length let an upload route hold an unbounded body in memory before the
 * size check ran. This stops reading — and cancels the stream — at the cap.
 */
export async function readCappedBody(
  request: { headers: Headers; body: ReadableStream<Uint8Array> | null },
  maxBytes: number,
): Promise<CappedBody> {
  const declared = request.headers.get('content-length');
  if (declared !== null && Number(declared) > maxBytes) return { ok: false, reason: 'too-large' };
  if (!request.body) return { ok: false, reason: 'empty' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, reason: 'too-large' };
    }
    chunks.push(value);
  }
  if (total === 0) return { ok: false, reason: 'empty' };
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes: bytes.buffer };
}

/**
 * Whether the server may fetch this asset address itself.
 *
 * A rendition URL is data from the API (a bucket's public URL), and the server
 * fetching it is an SSRF primitive: an internal address or a metadata endpoint
 * would be read with this process's network position. Only the API's own
 * origin (or an API-relative `/v1/` path) and Vercel Blob's public storage are
 * fetched; anything else returns null and the caller falls back to the API.
 */
export function allowedAssetUrl(raw: string, apiOrigin: string): URL | null {
  let url: URL;
  let api: URL;
  try {
    api = new URL(apiOrigin);
    url = raw.startsWith('/v1/') ? new URL(raw, api) : new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.origin === api.origin) return url;
  const host = url.hostname.toLowerCase();
  if (url.protocol === 'https:' && host.endsWith('.public.blob.vercel-storage.com') && host !== '.public.blob.vercel-storage.com') return url;
  return null;
}
