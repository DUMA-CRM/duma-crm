'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Loader2 } from '@/components/icons';
import { GoogleMark } from '@/components/shared/GoogleMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { signOut, startGoogleSignIn } from '@/lib/api/auth.service';
import { type InvitationPreview, acceptInvitationLink, signUpFromInvitation } from '@/lib/api/workspaces.service';
import { MIN_PASSWORD_LENGTH, passwordLengthHint } from '@/lib/auth/password-policy';
import { formatInstant } from '@/lib/utils/workspace-time';

const linkClass = 'font-semibold text-primary transition-colors hover:text-primary-hover';

function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-micro font-semibold uppercase tracking-micro text-primary">{eyebrow}</p>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children && <p className="mt-2 text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

function Dead({ title, body }: { title: string; body: string }) {
  return (
    <>
      <Heading eyebrow="Invitation" title={title}>
        {body}
      </Heading>
      <Button asChild size="touch" variant="outline" className="w-full">
        <Link href="/sign-in">Go to sign in</Link>
      </Button>
    </>
  );
}

/**
 * Every state an invitation link can be opened in. The address is the
 * invitation's, never typed: a new account is created for exactly that inbox,
 * and a signed-in account with another address is asked to switch.
 */
export function InviteAcceptance({
  token,
  preview,
  account,
}: {
  token: string;
  preview: InvitationPreview | null | 'error';
  account: { email: string; name: string } | null;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'accept' | 'signup' | 'google' | 'signout' | null>(null);

  if (preview === 'error') {
    return (
      <>
        <Heading eyebrow="Invitation" title="This invitation couldn’t be loaded">
          DUMA didn’t answer. Check your connection and try again.
        </Heading>
        <Button size="touch" className="w-full" onClick={() => router.refresh()}>
          Try again
        </Button>
      </>
    );
  }
  if (!preview) return <Dead title="This link isn’t valid" body="It may have been copied incompletely, or replaced by a newer invitation. Ask for a new one." />;
  if (preview.state === 'expired') {
    return <Dead title="This invitation has expired" body={`Ask ${preview.inviterName ?? 'whoever invited you'} to send a new one from ${preview.workspaceName}.`} />;
  }
  if (preview.state === 'revoked') return <Dead title="This invitation was cancelled" body={`Ask ${preview.workspaceName} for a new invitation if you still need access.`} />;
  if (preview.state === 'accepted') {
    return (
      <>
        <Heading eyebrow="Invitation" title="Already accepted">
          {preview.email} is a member of {preview.workspaceName}.
        </Heading>
        <Button asChild size="touch" className="w-full">
          <Link href="/dashboard">Open DUMA</Link>
        </Button>
      </>
    );
  }

  const run = async (kind: NonNullable<typeof busy>, action: () => Promise<unknown>) => {
    setBusy(kind);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setBusy(null);
    }
  };
  // A full load, not a client navigation: the workspace cookie and session are new.
  const enter = () => window.location.assign(new URL('/dashboard', window.location.origin));
  const google = () =>
    run('google', async () => {
      const here = `${window.location.origin}/invite/${encodeURIComponent(token)}`;
      window.location.assign(await startGoogleSignIn(here, here));
    });

  const signedInAsInvitee = account && account.email.toLowerCase() === preview.email;
  const invitedBy = preview.inviterName ? `${preview.inviterName} invited you` : 'You’ve been invited';

  return (
    <>
      <Heading eyebrow="Invitation" title={`Join ${preview.workspaceName}`}>
        {invitedBy} to join as {preview.roleName}. The invitation is for <strong className="text-foreground">{preview.email}</strong> and
        expires {formatInstant(preview.expiresAt, { dateStyle: 'medium' })}.
      </Heading>

      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {signedInAsInvitee ? (
        <Button size="touch" className="w-full" disabled={busy !== null} onClick={() => void run('accept', async () => { await acceptInvitationLink(token); enter(); })}>
          {busy === 'accept' ? 'Joining…' : `Accept and open ${preview.workspaceName}`}
        </Button>
      ) : account ? (
        <>
          <p className="mb-4 rounded-sm bg-band/60 p-3 text-sm text-muted-foreground">
            You’re signed in as <strong className="text-foreground">{account.email}</strong>. Sign out, then sign in as {preview.email} to accept.
          </p>
          <Button
            size="touch"
            className="w-full"
            disabled={busy !== null}
            onClick={() => void run('signout', async () => { await signOut(); window.location.reload(); })}
          >
            {busy === 'signout' ? 'Signing out…' : 'Sign out and continue'}
          </Button>
        </>
      ) : preview.accountExists ? (
        <>
          <Button asChild size="touch" className="w-full">
            <Link href={`/sign-in?${new URLSearchParams({ email: preview.email, next: `/invite/${token}` })}`}>Sign in to accept</Link>
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Forgot your password?{' '}
            <Link href="/forgot-password" className={linkClass}>
              Reset it
            </Link>
          </p>
        </>
      ) : (
        <>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run('signup', async () => { await signUpFromInvitation(token, { name: name.trim(), password }); enter(); });
            }}
          >
            <Input label="Email" type="email" value={preview.email} readOnly disabled hint="The invitation was sent here" />
            <Input label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} required />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              hint={passwordLengthHint(password) ?? `At least ${MIN_PASSWORD_LENGTH} characters`}
              required
            />
            <Button type="submit" size="touch" disabled={busy !== null} className="w-full">
              {busy === 'signup' ? 'Creating your account…' : 'Create account and join'}
            </Button>
          </form>
          <div className="mt-6 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-rule/60" />
            <span className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-rule/60" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={busy !== null}
            onClick={() => void google()}
            className="mt-6 w-full bg-[var(--mkt-card)] hover:bg-[var(--mkt-ground)]"
          >
            {busy === 'google' ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : <GoogleMark />}
            Continue with Google
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">Use the Google account for {preview.email}.</p>
        </>
      )}
    </>
  );
}
