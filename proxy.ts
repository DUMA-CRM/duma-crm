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
const PUBLIC_PATHS = ['/sign-in', '/sign-up', '/forgot-password', '/api/auth', '/be'];

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
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next.js internals and static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
