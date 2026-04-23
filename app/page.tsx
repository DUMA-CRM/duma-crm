import { ArrowRight, Coffee, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

const highlights = [
  {
    title: 'Orders Without Chaos',
    description: 'Track in-store and takeaway flow in one clean workspace, even during peak rush.',
    icon: Zap,
  },
  {
    title: 'Customer Memory Built In',
    description: 'Capture preferences, loyalty behavior, and notes so every visit feels personal.',
    icon: Sparkles,
  },
  {
    title: 'Operational Confidence',
    description: 'Get clear inventory and menu visibility to avoid stockouts and protect margin.',
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_38%),radial-gradient(circle_at_82%_12%,color-mix(in_oklch,var(--warning)_20%,transparent),transparent_34%),linear-gradient(to_bottom,color-mix(in_oklch,var(--background)_88%,white),var(--background))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-6 pb-24 pt-8 sm:px-10 lg:px-14">
        <header className="mb-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Coffee size={18} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">DUMA</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Coffee Business OS</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="h-9 px-4 text-sm">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild className="h-9 px-4 text-sm">
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </div>
        </header>

        <section className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary">
              Built for modern specialty coffee teams
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Run your entire coffee business from one system.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              DUMA is the all-in-one operating layer for coffee brands: POS, warehouse, loyalty, barista learning, invoicing, receipts, and
              leadership control in one workspace.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-11 px-5 text-sm">
                <Link href="/sign-up">
                  Start Free
                  <ArrowRight className="ml-1" size={16} aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 px-5 text-sm">
                <Link href="/dashboard">View Demo Workspace</Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-2xl font-semibold tracking-tight">3 min</p>
                <p className="text-muted-foreground">Average setup time</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">24/7</p>
                <p className="text-muted-foreground">Team visibility</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">All modules</p>
                <p className="text-muted-foreground">In one connected platform</p>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-[0_18px_50px_-28px_color-mix(in_oklch,var(--foreground)_35%,transparent)] backdrop-blur-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between border-b border-border/70 pb-4">
              <p className="text-sm font-medium">Today at DUMA Soho</p>
              <span className="rounded-full bg-success-highlight px-2.5 py-1 text-xs font-medium text-success">Live</span>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs text-muted-foreground">Open Orders</p>
                <p className="mt-1 text-2xl font-semibold">34</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs text-muted-foreground">Returning Guests</p>
                  <p className="mt-1 text-xl font-semibold">62%</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs text-muted-foreground">Low Stock Alerts</p>
                  <p className="mt-1 text-xl font-semibold">4</p>
                </div>
              </div>
              <div className="rounded-xl border border-primary/35 bg-primary/10 p-4">
                <p className="text-xs text-primary">Recommendation</p>
                <p className="mt-1 text-sm font-medium">Restock oat milk and prep the weekend seasonal batch.</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {highlights.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-border/70 bg-card/80 p-5">
              <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
                <Icon size={16} aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </article>
          ))}
        </section>

        <footer className="mt-10 border-t border-border/70 pt-6 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>© 2026 DUMA Coffee CRM</p>
            <div className="flex gap-4">
              <Link href="/sign-in" className="hover:text-foreground">
                Sign In
              </Link>
              <Link href="/sign-up" className="hover:text-foreground">
                Get Started
              </Link>
              <Link href="/dashboard" className="hover:text-foreground">
                Demo
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
