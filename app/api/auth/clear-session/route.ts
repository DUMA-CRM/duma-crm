import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Clears the stale session cookie and sends the browser to sign-in.
// Called from the CRM layout when the API reports the session is invalid.
export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete('better-auth.session_token');
  return NextResponse.redirect(new URL('/sign-in', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'));
}
