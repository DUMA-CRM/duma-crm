import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-6">
        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Account recovery</p>
        <h1 className="text-2xl font-semibold text-foreground">Reset password</h1>
        <p className="text-sm text-muted-foreground mt-2">Enter your email and we'll send a reset link.</p>
      </div>

      <form className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150"
          />
        </div>

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
