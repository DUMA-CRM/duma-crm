'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';

import { useAuth } from '@/lib/hooks/useAuth';

function SignInForm() {
  const { login, isLoading, error } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const sessionExpired = searchParams.get('reason') === 'session-expired';

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
    login(email, password);
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-headline text-foreground">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to pick up where your team left off.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {sessionExpired && (
          <p className="rounded-sm border border-rule bg-band px-3 py-2 text-sm text-foreground">
            Your session expired. Sign in again to continue.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-sm bg-destructive/6 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-semibold text-primary transition-colors hover:text-primary/80">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-10 mt-2 bg-primary hover:bg-primary-hover active:translate-y-px text-primary-foreground text-sm font-semibold rounded-md shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-xs text-muted-foreground">
        <p>New team member? Your manager can invite you from the Staff workspace.</p>
        <p>
          Setting up DUMA for your business?{' '}
          <Link href="/sign-up" className="font-semibold text-primary transition-colors hover:text-primary-hover">
            Create a workspace
          </Link>
        </p>
      </div>
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
