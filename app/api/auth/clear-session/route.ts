import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// Clears the stale session cookie and sends the browser to sign-in.
// Called from the CRM layout when the API reports the session is invalid.
//
// This is a GET because the CRM layout reaches it via redirect(), but a GET
// that mutates state is force-logout-able cross-site — so refuse requests
// that don't originate from our own navigation/fetch.
export async function GET(req: NextRequest) {
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cookieStore = await cookies();
  // The cookie name varies with better-auth config (__Secure- prefix on HTTPS,
  // custom prefixes) — clear every session_token variant we can see.
  for (const c of cookieStore.getAll()) {
    if (c.name.endsWith('session_token')) cookieStore.delete(c.name);
  }
  // Derive the origin from the request itself — no hardcoded localhost fallback.
  return NextResponse.redirect(new URL('/sign-in', req.url));
}
