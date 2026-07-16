'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Input } from '@/components/ui/input';

import { useAuth } from '@/lib/hooks/useAuth';

export default function SignInPage() {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login(email, password);
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Welcome back</p>
        <h1 className="text-2xl font-semibold text-foreground">Sign in</h1>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}
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

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-10 mt-2 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        No account?{' '}
        <Link href="/sign-up" className="text-primary hover:text-primary/80 font-semibold transition-colors">
          Create one
        </Link>
      </p>
    </>
  );
}
