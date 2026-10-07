import Link from 'next/link';

import { BrandBackdrop } from '@/components/shared/BrandBackdrop';
import { Logo } from '@/components/shared/Logo';

/**
 * Sign-in, password reset and activation share the landing page's ground: one
 * centred column, the mark above a single card. The green split panel this
 * replaced made the front door and the sign-in screen look like two products.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <BrandBackdrop />

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16">
        <Link href="/" aria-label="DUMA home" className="flex flex-col items-center rounded-md text-center">
          <Logo size={56} className="rounded-[19.4%] shadow-md" />
          <span className="mt-4 text-3xl font-semibold tracking-display text-foreground">DUMA</span>
          <span className="mt-1.5 text-micro font-semibold uppercase tracking-micro text-muted-foreground">Business OS</span>
        </Link>

        <main className="mt-8 w-full max-w-md rounded-xl border border-rule/60 bg-card/95 p-6 shadow-lg backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 sm:p-8">
          {children}
        </main>
      </div>

      <footer className="flex items-center justify-center gap-4 px-4 pb-6 text-xs text-muted-foreground">
        <span>© 2026 DUMA</span>
        <span aria-hidden="true">·</span>
        <Link href="/support" className="min-h-11 content-center hover:text-foreground">
          Support
        </Link>
      </footer>
    </div>
  );
}
