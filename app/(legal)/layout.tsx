import Link from 'next/link';

import { BrandBackdrop } from '@/components/shared/BrandBackdrop';
import { Logo } from '@/components/shared/Logo';

import '../(marketing)/marketing.css';

/**
 * Privacy policy, terms of service, the DPA, the GDPR page and company information. Public on purpose — both are linked from
 * the landing page and must be readable before anyone has an account, so the
 * routes are listed in APP_PUBLIC_PATHS (lib/utils/public-paths.ts).
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt relative isolate flex min-h-dvh flex-col overflow-hidden">
      <BrandBackdrop />

      <div className="flex flex-1 flex-col items-center px-4 py-12 sm:py-16">
        <Link href="/" aria-label="DUMA home" className="flex flex-col items-center rounded-md text-center">
          <Logo size={48} className="rounded-[19.4%] shadow-md" />
          <span className="mt-3 text-2xl font-semibold tracking-display text-foreground">DUMA</span>
        </Link>

        <main className="mt-8 w-full max-w-3xl mkt-card p-6 sm:p-10">
          {children}
        </main>
      </div>

      <footer className="flex items-center justify-center gap-4 px-4 pb-6 text-xs text-muted-foreground">
        <span>© 2026 DUMA</span>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="min-h-11 content-center hover:text-foreground">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className="min-h-11 content-center hover:text-foreground">
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/dpa" className="min-h-11 content-center hover:text-foreground">
          DPA
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/gdpr" className="min-h-11 content-center hover:text-foreground">
          GDPR
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/legal" className="min-h-11 content-center hover:text-foreground">
          Company information
        </Link>
      </footer>
    </div>
  );
}
