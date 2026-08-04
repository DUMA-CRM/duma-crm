'use client';
import Link from 'next/link';
import { useState } from 'react';

import { Input } from '@/components/ui/input';

import { requestPasswordReset } from '@/lib/api/auth.service';

export default function Page() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await requestPasswordReset(email, `${window.location.origin}/reset-password`);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset link');
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Account recovery</p>
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter your email and we’ll send a single-use reset link.</p>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        {sent && <p className="rounded-lg bg-success/10 p-3 text-sm text-success">If that account exists, a reset link has been sent.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button disabled={loading} className="h-10 w-full rounded-xl bg-primary text-sm font-semibold text-white">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-center text-xs">
        <Link href="/sign-in" className="font-semibold text-primary">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
