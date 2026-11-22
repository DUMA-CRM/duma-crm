import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { ApiError } from '@/lib/api/client';
import { getSession } from '@/lib/api/auth.service';
import { type InvitationPreview, getInvitationPreview } from '@/lib/api/workspaces.service';

import { InviteAcceptance } from './InviteAcceptance';

// The token is the credential: never send it on in a Referer header.
export const metadata: Metadata = { title: 'Workspace invitation · DUMA', referrer: 'no-referrer' };

/**
 * The emailed invitation link. Read on the server with the visitor's session,
 * so the first paint already says the right thing: accept, sign in, create an
 * account, or switch account — or that the link no longer works.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cookieHeader = (await cookies())
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  const [preview, session] = await Promise.all([
    getInvitationPreview(token).catch((error: unknown): InvitationPreview | null | 'error' =>
      error instanceof ApiError && (error.status === 404 || error.status === 400) ? null : 'error',
    ),
    getSession(cookieHeader).catch(() => null),
  ]);

  return (
    <InviteAcceptance
      token={token}
      preview={preview}
      account={session ? { email: session.user.email, name: session.user.name } : null}
    />
  );
}
