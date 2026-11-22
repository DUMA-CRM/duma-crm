'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { ArrowRight, Eye, EyeOff, Loader2, Mail } from '@/components/icons';
import { GoogleMark } from '@/components/shared/GoogleMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useAuth } from '@/lib/hooks/useAuth';
import { chatgptOAuthQuery } from '@/lib/utils/chatgpt-connection';
import { googleSignInError } from '@/lib/utils/sign-in';

function SignInForm() {
  const { login, loginWithGoogle, isLoading, isGoogleLoading, error } = useAuth();
  const searchParams = useSearchParams();
  // Identifier first, as Google, Microsoft and Linear do: one question at a
  // time, and the email step is where "Continue with Google" sits beside it.
  const [step, setStep] = useState<'email' | 'password'>('email');
  // An invitation link sends the invited address along, so it is filled in.
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [urlErrorDismissed, setUrlErrorDismissed] = useState(false);
  const sessionExpired = searchParams.get('reason') === 'session-expired';
  const recentSignIn = searchParams.get('reason') === 'recent-sign-in';
  // Google comes back here with ?error=CODE when it can't sign someone in.
  const googleError = urlErrorDismissed ? null : googleSignInError(searchParams.get('error'));
  const busy = isLoading || isGoogleLoading;
  const connectingChatGpt = Boolean(chatgptOAuthQuery(searchParams.toString()));

  useEffect(() => {
    if (!sessionExpired) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          const worker = navigator.serviceWorker.controller ?? registration.active;
          worker?.postMessage({ type: 'DUMA_CLEAR_USER' });
        })
        .catch(() => {});
    }
    if ('caches' in window) {
      void caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((key) => key.startsWith('duma-user-') || key.startsWith('duma-pages-')).map((key) => caches.delete(key))),
        );
    }
  }, [sessionExpired]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUrlErrorDismissed(true);
    // A password manager that filled both fields gets a one-click sign-in.
    if (step === 'password' || password) login(email, password);
    else setStep('password');
  }

  function changeEmail() {
    setPassword('');
    setShowPassword(false);
    setStep('email');
  }

  return (
    <div>
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-semibold tracking-headline text-foreground sm:text-3xl">
          {connectingChatGpt ? 'Sign in to connect ChatGPT' : 'Welcome back'}
        </h1>
      </div>

      <form method="post" className="space-y-4" onSubmit={handleSubmit}>
        {sessionExpired && (
          <p role="status" className="rounded-md border border-rule bg-band px-3 py-2 text-sm text-foreground">
            Your session expired. Sign in again to continue.
          </p>
        )}
        {recentSignIn && (
          <p role="status" className="rounded-md border border-rule bg-band px-3 py-2 text-sm text-foreground">
            Sign in again to view your active sessions. You’ll return to Account settings.
          </p>
        )}
        {(error ?? googleError) && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/6 px-3 py-2 text-sm text-destructive">
            {error ?? googleError}
          </p>
        )}

        {step === 'email' ? (
          <>
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
            {/* Off-screen so a password manager can still fill it on this step. */}
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </>
        ) : (
          <div className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
            <div className="flex items-center gap-3 rounded-md border border-border bg-band/40 px-3 py-2.5">
              <Mail className="shrink-0 text-muted-foreground" size={16} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{email}</span>
              <button
                type="button"
                onClick={changeEmail}
                className="shrink-0 rounded-sm text-sm font-semibold text-primary transition-colors outline-none hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Change
              </button>
            </div>
            {/* Tells the password manager which account this password belongs to. */}
            <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                rightAction={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                }
              />
              <div className="mt-2 flex justify-end">
                <Link href="/forgot-password" className="text-sm font-semibold text-primary transition-colors hover:text-primary-hover">
                  Forgot password?
                </Link>
              </div>
            </div>
          </div>
        )}

        <Button type="submit" size="touch" disabled={busy} className="mt-2 w-full">
          {isLoading ? (
            <>
              <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            <>
              {step === 'email' && !password ? 'Continue' : 'Sign in'}
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>

      {step === 'email' && (
        <>
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
            onClick={() => {
              setUrlErrorDismissed(true);
              void loginWithGoogle();
            }}
            className="mt-6 w-full bg-[var(--mkt-card)] hover:bg-[var(--mkt-ground)]"
          >
            {isGoogleLoading ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : <GoogleMark />}
            Continue with Google
          </Button>
        </>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        New to DUMA?{' '}
        <Link href="/sign-up" className="font-semibold text-primary transition-colors hover:text-primary-hover">
          Create a workspace
        </Link>{' '}
        or{' '}
        <Link href="/create-account" className="font-semibold text-primary transition-colors hover:text-primary-hover">
          join your team
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
