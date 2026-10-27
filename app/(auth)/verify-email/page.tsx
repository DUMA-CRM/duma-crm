'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// Landing page for emailed confirmation links. The link goes to the API first
// (GET /v1/auth/verify-email), which verifies the token and redirects here —
// with `?error=CODE` on failure and nothing on success.
//
// The email-change flow lands here twice with no way to tell the steps apart:
// once after approving from the old inbox, once after confirming the new one.
// Its copy covers both.

const ERRORS: Record<string, string> = {
  TOKEN_EXPIRED: 'This link has expired. Links work for one hour — request a new one.',
  INVALID_TOKEN: 'This link isn’t valid. It may have been copied incompletely, or already replaced by a newer one.',
  USER_NOT_FOUND: 'We couldn’t find the account this link was for.',
  INVALID_USER: 'This link belongs to a different account from the one signed in on this browser. Sign out and open it again.',
};

function Result() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const isEmailChange = searchParams.get('flow') === 'change-email';

  if (error)
    return (
      <>
        <div className="mb-6">
          <p className="text-micro font-semibold uppercase tracking-micro text-destructive">Link not used</p>
          <h1 className="text-2xl font-semibold">We couldn’t confirm this email</h1>
          <p role="alert" className="mt-2 text-sm text-muted-foreground">
            {ERRORS[error] ?? 'Something went wrong with this link. Request a new one and try again.'}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {isEmailChange
            ? 'Start the change again from Settings → Security.'
            : 'Sign in and use “Resend email” on the banner at the top of the page.'}
        </p>
        <Link href={isEmailChange ? '/settings/security' : '/dashboard'} className="mt-5 inline-block font-semibold text-primary">
          {isEmailChange ? 'Go to security settings' : 'Continue to DUMA'}
        </Link>
      </>
    );

  return (
    <>
      <div className="mb-6">
        <p className="text-micro font-semibold uppercase tracking-micro text-primary">{isEmailChange ? 'Email change' : 'Email confirmed'}</p>
        <h1 className="text-2xl font-semibold">{isEmailChange ? 'Step complete' : 'Thanks — your email is confirmed'}</h1>
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {isEmailChange
            ? 'If you just approved the change, we’ve sent a confirmation link to your new address — open it to finish. If you just confirmed the new address, the change is done: sign in with your new email from now on.'
            : 'We’ll use this address for sign-in help and important account messages.'}
        </p>
      </div>
      <Link href={isEmailChange ? '/settings/security' : '/dashboard'} className="inline-block font-semibold text-primary">
        {isEmailChange ? 'Go to security settings' : 'Continue to DUMA'}
      </Link>
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Result />
    </Suspense>
  );
}
