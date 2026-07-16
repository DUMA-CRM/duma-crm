'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Input } from '@/components/ui/input';

import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils/cn';

const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
];

export default function SignUpPage() {
  const { register, isLoading, error } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const passwordOk = PASSWORD_RULES.every((r) => r.test(password));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOk) return;
    register(name, email, password);
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Get started</p>
        <h1 className="text-2xl font-semibold text-foreground">Create account</h1>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}
        <Input
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="Jordan Walker"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div>
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* Live requirements checklist */}
          <ul className="mt-2 space-y-1">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li key={rule.label} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-full transition-colors',
                      ok ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Check size={11} strokeWidth={3} className={cn('transition-opacity', ok ? 'opacity-100' : 'opacity-30')} />
                  </span>
                  <span className={cn('transition-colors', ok ? 'text-foreground' : 'text-muted-foreground')}>{rule.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <button
          type="submit"
          disabled={isLoading || !passwordOk}
          className="w-full h-10 mt-2 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-primary hover:text-primary/80 font-semibold transition-colors">
          Sign in
        </Link>
      </p>
    </>
  );
}
