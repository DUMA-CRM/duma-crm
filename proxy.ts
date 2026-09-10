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

// better-auth's session cookie. The exact name varies with configuration —
// `better-auth.session_token` plain, `__Secure-better-auth.session_token` on
// HTTPS, or a custom cookiePrefix — so match by suffix, not equality.
const SESSION_COOKIE_SUFFIX = 'session_token';

// Routes that are accessible without a session. '/' must be matched exactly —
// a startsWith('/') check matches every path and disables the guard entirely.
//
// '/be' is the same-origin API proxy: it MUST stay exempt or unauthenticated
// API calls (sign-in itself!) get redirected to the sign-in HTML page, which
// then fails JSON parsing in the client. The API enforces its own auth.
const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/forgot-password', '/order', '/api/auth', '/be'];

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
 * `img-src` mirrors the `remotePatterns` in next.config.ts; if one changes the
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
function contentSecurityPolicy(nonce: string, allowEval: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${allowEval ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://mdm-assets.integration.costacoffee.com https://duma-coffee.vercel.app",
    "font-src 'self' data:",
    // Browser API calls go to /be on this origin; the service worker is ours.
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.getAll().some((c) => c.name.endsWith(SESSION_COOKIE_SUFFIX) && c.value.length > 0);
  const isPublic = pathname === '/' || PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Unauthenticated user visiting a protected page → send to sign-in.
  // Preserve `?next=` so we can redirect back after a successful login.
  //
  // Note: we intentionally do NOT redirect authenticated users away from public
  // pages here. The cookie only proves a token exists — not that the session is
  // still valid. If the session has expired, the CRM layout will redirect to
  // sign-in, and blindly bouncing back to /dashboard from here would loop.
  if (!hasSession && !isPublic) {
    const url = new URL('/sign-in', req.url);
    url.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // A fresh nonce per request — a predictable one is no nonce at all.
  const nonce = crypto.randomUUID().replaceAll('-', '');
  // React uses eval in development for readable error stacks. Opt in locally.
  const csp = contentSecurityPolicy(nonce, process.env.CSP_ALLOW_EVAL === 'true');
  const header = process.env.CSP_REPORT_ONLY === 'true' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

  // Next reads both of these off the *request* to stamp its own scripts.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(header, csp);
  return response;
}

export const config = {
  // Run on everything except Next.js internals and static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
