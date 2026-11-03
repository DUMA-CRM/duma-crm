// better-auth's session cookie. The exact name varies with configuration —
// `better-auth.session_token` plain, `__Secure-better-auth.session_token` on
// HTTPS, or a custom cookiePrefix — so match by suffix, not equality.
const SESSION_COOKIE_SUFFIX = 'session_token';

/**
 * Whether the request carries a session cookie. It proves a token exists, not
 * that the session is still valid — the CRM layout checks that against the
 * API. Good enough to route (proxy.ts) or to pick a label (the marketing
 * header), never to authorise.
 */
export function hasSessionCookie(cookies: ReadonlyArray<{ name: string; value: string }>): boolean {
  return cookies.some((cookie) => cookie.name.endsWith(SESSION_COOKIE_SUFFIX) && cookie.value.length > 0);
}
