import Link from 'next/link';

import { ArrowRight, UserPlus } from '@/components/icons';
import { BrandBackdrop } from '@/components/shared/BrandBackdrop';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';

/**
 * Pre-launch front door: the mark and two ways in. The marketing page this
 * replaced lives in git history (and `components/marketing/`) for when there
 * is a launch to sell.
 */
export default function HomePage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <BrandBackdrop />

      <section className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-700">
          <Logo size={96} className="rounded-[19.4%] shadow-lg sm:size-28" />
        </div>

        <h1 className="mt-8 text-5xl font-semibold tracking-display sm:text-6xl">DUMA</h1>
        <p className="mt-3 text-micro font-semibold uppercase tracking-micro text-muted-foreground">Business OS</p>
        <p className="mt-6 max-w-[38ch] text-base text-muted-foreground sm:text-lg">
          Till, kitchen, stock, people and reporting — one calm workspace for the whole shift.
        </p>

        <div className="mt-10 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:w-auto sm:flex-row">
          <Button asChild size="touch" className="sm:min-w-48">
            <Link href="/dashboard">
              Open the CRM
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="touch" className="sm:min-w-48">
            <Link href="/sign-up">
              <UserPlus data-icon="inline-start" aria-hidden="true" />
              Create a workspace
            </Link>
          </Button>
        </div>
      </section>

      <footer className="flex items-center justify-center gap-4 px-4 pb-6 text-xs text-muted-foreground">
        <span>© 2026 DUMA</span>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="min-h-11 content-center hover:text-foreground">
          Privacy Policy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className="min-h-11 content-center hover:text-foreground">
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}
