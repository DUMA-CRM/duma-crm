import { randomBytes } from 'node:crypto';

import { ApiError, apiFetch } from '@/lib/api/client';

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

// Only the wrapper can forward a port to the CRM. The publisher frame
// remains opaque and the port closes with the document that opened it.
const bridge = `
window.addEventListener('message', (event) => {
  if (event.source !== document.getElementById('duma-app')?.contentWindow ||
      event.origin !== 'null' || event.data !== 'duma:connect:v1' || event.ports.length !== 1) return;
  window.parent.postMessage('duma:connect:v1', window.location.origin, event.ports);
});
`;

function frameDocument(body: string, status: number, origin?: string, nonce?: string) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DUMA app</title><style>html,body,iframe{width:100%;height:100%;margin:0;border:0}iframe{display:block}p{margin:1rem;font:1rem system-ui}</style>${nonce ? `<script nonce="${nonce}">${bridge}</script>` : ''}</head><body>${body}</body></html>`, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src ${nonce ? `'nonce-${nonce}'` : "'none'"}; frame-src ${origin ?? "'none'"}; frame-ancestors 'self'; base-uri 'none'; form-action 'none'`,
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=()',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paramsQuery = new URL(request.url).searchParams;
  const workspaceId = paramsQuery.get('workspace');
  const surface = paramsQuery.get('surface');
  const revision = paramsQuery.get('revision');
  const cookies = request.headers.get('cookie');
  const site = request.headers.get('sec-fetch-site');
  if ((site && site !== 'same-origin') || !cookies || !workspaceId ||
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(workspaceId) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return frameDocument('<p>Open this app from its workspace in DUMA.</p>', 403);
  }

  const query = new URLSearchParams();
  if (surface) query.set('surface', surface);
  if (revision) query.set('revision', revision);
  try {
    const launch = await apiFetch<{ name: string; url: string }>(`/marketplace/${slug}/launch?${query}`, {
      method: 'POST', cookieHeader: cookies, workspaceId, cache: 'no-store', timeoutMs: 10_000,
    });
    const url = new URL(launch.url);
    if (!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::[0-9]+)?$/i.test(url.origin) || url.username || url.password) {
      return frameDocument('<p>Invalid app address.</p>', 502);
    }
    return frameDocument(
      `<iframe id="duma-app" sandbox="allow-scripts allow-forms" referrerpolicy="no-referrer" title="${escapeAttribute(launch.name)}" src="${escapeAttribute(url.href)}"></iframe>`,
      200,
      url.origin,
      surface ? randomBytes(24).toString('base64url') : undefined,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) return frameDocument('<p>This app page is unavailable in this workspace.</p>', 403);
    return frameDocument('<p>The app could not be opened. Reload DUMA to try again.</p>', 502);
  }
}
