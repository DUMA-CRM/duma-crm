import Link from 'next/link';

import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-6">
        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Account recovery</p>
        <h1 className="text-2xl font-semibold text-foreground">Reset password</h1>
        <p className="text-sm text-muted-foreground mt-2">Enter your email and we'll send a reset link.</p>
      </div>

      <form className="space-y-4">
        <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" />
        <button
          type="submit"
          className="w-full h-11 mt-2 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Send reset link
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Remembered it?{' '}
        <Link href="/sign-in" className="text-primary hover:text-primary/80 font-semibold transition-colors">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
