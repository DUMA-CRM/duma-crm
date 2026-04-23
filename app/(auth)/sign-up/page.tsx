import Link from 'next/link';

import { Input } from '@/components/ui/input';

export default function SignUpPage() {
  return (
    <>
      <div className="mb-6">
        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Get started</p>
        <h1 className="text-2xl font-semibold text-foreground">Create account</h1>
      </div>

      <form className="space-y-4">
        <Input label="Full name" type="text" autoComplete="name" placeholder="Jordan Walker" />
        <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" />
        <Input label="Password" type="password" autoComplete="new-password" placeholder="••••••••" />

        <button
          type="submit"
          className="w-full h-11 mt-2 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Create account
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
