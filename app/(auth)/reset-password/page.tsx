'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Input } from '@/components/ui/input';

import { resetPassword } from '@/lib/api/auth.service';

function Form() {
  const token = useSearchParams().get('token') ?? '';
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (p.length < 12) {
      setError('Use at least 12 characters for your new password.');
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
        <h1 className="text-2xl font-semibold">Password updated</h1>
        <p role="status" className="mt-2 text-sm text-muted-foreground">You can now sign in with your new password.</p>
        <Link href="/sign-in" className="mt-5 inline-block font-semibold text-primary">
          Continue to sign in
        </Link>
      </>
    );
  return (
    <form className="space-y-4" onSubmit={submit}>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <p className="text-sm text-muted-foreground">Use at least 12 characters.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Input label="New password" type="password" autoComplete="new-password" value={p} onChange={(e) => setP(e.target.value)} required />
      <Input label="Confirm new password" type="password" autoComplete="new-password" value={c} onChange={(e) => setC(e.target.value)} required />
      <button disabled={loading} className="h-10 w-full rounded-sm bg-primary text-sm font-semibold text-white disabled:opacity-60">
        {loading ? 'Updating password…' : 'Update password'}
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
