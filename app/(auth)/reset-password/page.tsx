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
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (p.length < 12 || p !== c) {
      setError('Passwords must match and contain at least 12 characters.');
      return;
    }
    try {
      await resetPassword(token, p);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset link is invalid or expired');
    }
  }
  if (done)
    return (
      <>
        <h1 className="text-2xl font-semibold">Password updated</h1>
        <Link href="/sign-in" className="mt-5 inline-block font-semibold text-primary">
          Continue to sign in
        </Link>
      </>
    );
  return (
    <form className="space-y-4" onSubmit={submit}>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Input label="New password" type="password" value={p} onChange={(e) => setP(e.target.value)} required />
      <Input label="Confirm password" type="password" value={c} onChange={(e) => setC(e.target.value)} required />
      <button className="h-10 w-full rounded-xl bg-primary text-sm font-semibold text-white">Set password</button>
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
