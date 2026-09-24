'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Input } from '@/components/ui/input';

import { MIN_PASSWORD_LENGTH, passwordLengthHint } from '@/lib/auth/password-policy';
import { resetPassword } from '@/lib/modules/identity/client';

function Form() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const isActivation = searchParams.get('activation') === '1';
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (p.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`);
      return;
    }
    if (p !== c) {
      setError('The passwords don’t match. Enter the same password in both fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(token, p);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This reset link is invalid or has expired. Request a new link.');
    } finally {
      setLoading(false);
    }
  }
  if (done)
    return (
      <>
        <h1 className="text-2xl font-semibold">{isActivation ? 'Account activated' : 'Password updated'}</h1>
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {isActivation ? 'Your workspace account is ready. Sign in to get started.' : 'You can now sign in with your new password.'}
        </p>
        <Link href="/sign-in" className="mt-5 inline-block font-semibold text-primary">
          Continue to sign in
        </Link>
      </>
    );
  return (
    <form className="space-y-4" onSubmit={submit}>
      <h1 className="text-2xl font-semibold">{isActivation ? 'Activate your account' : 'Choose a new password'}</h1>
      <p className="text-sm text-muted-foreground">
        {isActivation ? 'Create the password you’ll use to sign in.' : 'Replace your old password with a new one.'} Use at least{' '}
        {MIN_PASSWORD_LENGTH} characters.
      </p>
      {error && (
        <p id="reset-password-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        value={p}
        onChange={(e) => setP(e.target.value)}
        required
        minLength={MIN_PASSWORD_LENGTH}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'reset-password-error' : undefined}
        hint={passwordLengthHint(p)}
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={c}
        onChange={(e) => setC(e.target.value)}
        required
        minLength={MIN_PASSWORD_LENGTH}
        aria-invalid={Boolean(c && p !== c)}
        aria-describedby={error ? 'reset-password-error' : undefined}
        hint={c && p !== c ? 'Passwords do not match yet.' : undefined}
      />
      <button disabled={loading} className="h-10 w-full rounded-sm bg-primary text-sm font-semibold text-white disabled:opacity-60">
        {loading ? (isActivation ? 'Activating account…' : 'Updating password…') : isActivation ? 'Activate account' : 'Update password'}
      </button>
    </form>
  );
}
export default function Page() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
