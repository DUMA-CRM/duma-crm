import type { Metadata } from 'next';
import Link from 'next/link';

import { BrandBackdrop } from '@/components/shared/BrandBackdrop';
import { Logo } from '@/components/shared/Logo';
import { PublicFooter } from '@/components/shared/PublicFooter';

import '../(marketing)/marketing.css';

// Account screens, not content: kept out of search so a query for "DUMA" lands
// on the home page rather than a sign-in form. Links on them are still followed.
export const metadata: Metadata = { robots: { index: false, follow: true } };

/**
 * Sign-in, password reset and activation share the marketing site's paper and
 * chalk curves: one centred column, the mark above a single card. Arriving from
 * "Sign in" on the home page should not feel like changing products.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt relative isolate flex min-h-dvh flex-col overflow-hidden">
      <BrandBackdrop />

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16">
        <Link href="/" aria-label="DUMA home" className="flex flex-col items-center rounded-md text-center">
          <Logo size={56} className="rounded-[19.4%] shadow-md" />
          <span className="mt-4 text-3xl font-semibold tracking-display text-foreground">DUMA</span>
          <span className="mt-1.5 text-micro font-semibold uppercase tracking-micro text-muted-foreground">Business OS</span>
        </Link>

        <main className="mt-8 w-full max-w-md mkt-card p-6 shadow-[0_20px_44px_-18px_rgb(32_55_45/0.3)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 sm:p-8">
          {children}
        </main>
      </div>

      <PublicFooter />
    </div>
  );
}
