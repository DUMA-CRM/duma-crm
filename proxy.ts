// Next.js Edge Proxy — runs before every request.
//
// Responsibility: fast route protection at the CDN edge.
// It only checks if the session cookie EXISTS — full cryptographic validation
// happens in the CRM layout (server-side, against the real API).
//
// Why two layers?
//   Proxy = cheap redirect, zero API calls, runs on the edge.
//   CRM layout = validates the session is still active/not expired.
import { NextRequest, NextResponse } from 'next/server';

import { CSP_IMAGE_HOSTS } from '@/lib/utils/image-src';
import { MARKDOWN_RENDER_HEADER, prefersMarkdown, servesMarkdown } from '@/lib/utils/markdown-for-agents';
import { needsSignIn } from '@/lib/utils/public-paths';

// better-auth's session cookie. The exact name varies with configuration —
// `better-auth.session_token` plain, `__Secure-better-auth.session_token` on
// HTTPS, or a custom cookiePrefix — so match by suffix, not equality.
const SESSION_COOKIE_SUFFIX = 'session_token';

/**
 * The home page's Link header: same-origin, so the proxy needs none of the
 * developer registries. /.well-known/api-catalog lists every API with its
 * OpenAPI document and status; /auth.md is how an agent gets a key.
 */
const HOME_LINKS = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</developers>; rel="service-doc"; type="text/html"',
  '</llms.txt>; rel="describedby"; type="text/plain"',
  '</auth.md>; rel="describedby"; type="text/markdown"',
].join(', ');

/**
 * Content Security Policy.
 *
 * The reason this exists is `components/shared/Markdown.tsx`: Ask DUMA renders
 * model output into the DOM, and until now a hand-rolled sanitiser was the only
 * thing standing between a prompt-injected tool result and a script tag. A CSP
 * is the layer that does not depend on that sanitiser being perfect.
 *
 * `script-src` is the part that matters and is strict: a per-request nonce plus
 * `strict-dynamic`, so nothing executes unless Next itself emitted it. Next
 * reads the nonce from the `x-nonce` request header and stamps its own
 * bootstrap scripts with it.
 *
 * `style-src` deliberately keeps `unsafe-inline`. CSP applies `style-src` to
 * inline `style=""` attributes, which is what every React `style={{…}}` prop
 * compiles to — the draggable agent panel, the mascot, the charts. Locking that
 * down means rewriting them to classes for a far smaller prize than script
 * injection. Noted rather than quietly omitted.
 *
 * `img-src` (`CSP_IMAGE_HOSTS`) mirrors the `remotePatterns` in next.config.ts; if one changes the
 * other must too, or images fail with no visible error.
 *
 * Set `CSP_REPORT_ONLY=true` to switch to the report-only header while
 * verifying a change in a browser.
 *
 * > [!warning] Do not gate this on NODE_ENV.
 * > The Next guide writes `const isDev = process.env.NODE_ENV === 'development'`.
 * > In this project that is **`'development'` inside the compiled proxy even in
 * > a production build** — measured, not assumed — so the guide's version ships
 * > `'unsafe-eval'` to production and quietly removes most of the protection
 * > `strict-dynamic` was bought for. `CSP_ALLOW_EVAL` is opt-in instead: absent
 * > means strict, which is the right way for this switch to fail.
 */
function contentSecurityPolicy(nonce: string, allowEval: boolean, frameable: 'none' | 'self' | 'any' = 'none') {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${allowEval ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${CSP_IMAGE_HOSTS.map((host) => `https://${host}`).join(' ')}`,
    "font-src 'self' data:",
    // Browser API calls go to /be on this origin; the service worker is ours.
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    // blob: lets Media preview a video it compressed in the browser before uploading it.
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // The guest QR page may be framed by this app alone (the settings preview);
    // a hosted form by any website — embedding it is the point. It holds no
    // session-bound action: the form endpoints are public and ignore cookies.
    frameable === 'any' ? 'frame-ancestors *' : frameable === 'self' ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // One host: www.duma-business.com served a full duplicate of the site. A
  // permanent redirect folds its links into the apex domain for search engines.
  const host = req.headers.get('host') ?? '';
  if (host.startsWith('www.')) {
    const url = req.nextUrl.clone();
    url.host = host.slice(4);
    return NextResponse.redirect(url, 301);
  }

  const hasSession = req.cookies.getAll().some((c) => c.name.endsWith(SESSION_COOKIE_SUFFIX) && c.value.length > 0);
  // Which routes need a session, and which are public: lib/utils/public-paths.ts.
  // Unauthenticated user visiting an app section → send to sign-in. An unknown
  // URL falls through to the real 404 instead (needsSignIn), so a crawler never
  // sees a login page for a page that does not exist.
  // Preserve `?next=` so we can redirect back after a successful login.
  //
  // Note: we intentionally do NOT redirect authenticated users away from public
  // pages here. The cookie only proves a token exists — not that the session is
  // still valid. If the session has expired, the CRM layout will redirect to
  // sign-in, and blindly bouncing back to /dashboard from here would loop.
  if (!hasSession && needsSignIn(pathname)) {
    const url = new URL('/sign-in', req.url);
    url.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // An agent asking for `Accept: text/markdown` gets the page as Markdown (app/md/route.ts);
  // browsers, and the conversion's own fetch of the page, carry on to the HTML. The rewrite runs
  // before any cache, which keys on /md/<page>, so neither form can be served in place of the other.
  // (A `Vary: Accept` set here would not reach the HTML: Next replaces Vary when it renders.)
  const negotiable = (req.method === 'GET' || req.method === 'HEAD') && servesMarkdown(pathname);
  if (negotiable && !req.headers.has(MARKDOWN_RENDER_HEADER) && prefersMarkdown(req.headers.get('accept'))) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === '/' ? '/md' : `/md${pathname}`;
    return NextResponse.rewrite(url);
  }

  // A fresh nonce per request — a predictable one is no nonce at all.
  const nonce = crypto.randomUUID().replaceAll('-', '');
  // React uses eval in development for readable error stacks. Opt in locally.
  const frameable = pathname.startsWith('/f/') ? 'any' : pathname.startsWith('/order/') ? 'self' : 'none';
  const csp = contentSecurityPolicy(nonce, process.env.CSP_ALLOW_EVAL === 'true', frameable);
  const header = process.env.CSP_REPORT_ONLY === 'true' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

  // Next reads both of these off the *request* to stamp its own scripts.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(header, csp);
  // Agent discovery from the home page (RFC 8288, RFC 9727 §3). The catalog carries the API links themselves.
  if (pathname === '/') response.headers.set('Link', HOME_LINKS);
  return response;
}

export const config = {
  // Run on everything except Next.js internals and files served from public/.
  // Those were behind the sign-in redirect, so anything fetching them without a
  // session — email clients loading the logo, link previews reading the share image, the
  // browser reading the manifest before sign-in — got the sign-in page instead.
  // Every image format public/ may hold is listed — a .webp or .jpg missing here
  // silently became a redirect for every signed-out visitor.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|webp|avif|gif|svg|ico|webmanifest|js)$).*)'],
};
