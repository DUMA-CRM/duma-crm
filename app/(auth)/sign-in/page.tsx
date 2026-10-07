'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { ArrowRight, Building2, Eye, EyeOff, Loader2, Users } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useAuth } from '@/lib/hooks/useAuth';

function SignInForm() {
  const { login, isLoading, error } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div>
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-semibold tracking-headline text-foreground sm:text-3xl">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to pick up where your team left off.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {sessionExpired && (
          <p role="status" className="rounded-md border border-rule bg-band px-3 py-2 text-sm text-foreground">
            Your session expired. Sign in again to continue.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/6 px-3 py-2 text-sm text-destructive">
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
          autoFocus
          required
        />
        <div>
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        <Button type="submit" size="touch" disabled={isLoading} className="mt-2 w-full">
          {isLoading ? (
            <>
              <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-8">
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-rule/60" />
          <span className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">New to DUMA?</span>
          <span className="h-px flex-1 bg-rule/60" />
        </div>

        <Link
          href="/sign-up"
          className="group mt-5 flex items-center gap-4 rounded-lg border border-rule/70 bg-field p-4 transition-[border-color,background-color,box-shadow] duration-150 outline-none hover:border-primary/50 hover:bg-band/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
            <Building2 size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Create a workspace</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Set up DUMA for your business in a few minutes.</span>
          </span>
          <ArrowRight
            className="shrink-0 text-muted-foreground transition-[color,translate] duration-150 group-hover:text-primary motion-safe:group-hover:translate-x-0.5"
            size={18}
            aria-hidden="true"
          />
        </Link>

        <p className="mt-4 flex items-start justify-center gap-2 text-center text-xs text-muted-foreground">
          <Users className="mt-px shrink-0" size={14} aria-hidden="true" />
          <span>Joining an existing team? Ask your manager to invite you from Staff.</span>
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
