'use client';
import Link from 'next/link';
import { useState } from 'react';

import { Loader2 } from '@/components/icons';
import { GoogleMark } from '@/components/shared/GoogleMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { apiFetch } from '@/lib/api/client';
import { MIN_PASSWORD_LENGTH, passwordLengthHint } from '@/lib/auth/password-policy';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * An account with no workspace yet — for someone joining a team. They land on
 * "ask your manager to add you", where invitations to their (confirmed)
 * address appear. A new business uses /sign-up instead.
 */
export default function CreateAccountPage() {
  const { loginWithGoogle, isGoogleLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const busy = loading || isGoogleLoading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiFetch('/auth/sign-up/email', { method: 'POST', body: JSON.stringify({ name: name.trim(), email: email.trim(), password }) });
      // A full load: the new session decides what the app shows.
      window.location.assign(new URL('/dashboard', window.location.origin));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The account wasn’t created. Try again.');
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-micro font-semibold uppercase tracking-micro text-primary">Join your team</p>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your manager adds you to their workspace once you have an account.</p>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Input label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} required />
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
        <Button type="submit" size="touch" disabled={busy} className="w-full">
          {loading ? 'Creating account…' : 'Create account'}
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
        disabled={busy}
        onClick={() => void loginWithGoogle()}
        className="mt-6 w-full bg-[var(--mkt-card)] hover:bg-[var(--mkt-ground)]"
      >
        {isGoogleLoading ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : <GoogleMark />}
        Continue with Google
      </Button>
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-semibold text-primary transition-colors hover:text-primary-hover">
          Sign in
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href="/sign-up" className="font-semibold text-primary transition-colors hover:text-primary-hover">
          Set up a business
        </Link>
      </p>
    </>
  );
}
