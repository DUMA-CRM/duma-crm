import Link from 'next/link';

import { ArrowRight, Building2, CloudOff, Layers3, ShieldCheck, Store, Users } from '@/components/icons';
import { LandingShiftTrace } from '@/components/marketing/LandingShiftTrace';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';

const differentiators = [
  {
    title: 'One system. No add-on stack.',
    description: 'POS, kitchen, stock, purchasing, rota, payroll, HR, customer communications, and reporting share one workspace.',
    icon: Layers3,
    tone: 'text-measured',
  },
  {
    title: 'The shift keeps moving offline.',
    description: 'Visited screens stay available, sales queue safely on the device, and rejected syncs remain visible for reconciliation.',
    icon: CloudOff,
    tone: 'text-momentum',
  },
  {
    title: 'Each role gets its own product.',
    description: 'Baristas, people teams, managers, owners, auditors, and platform operators see the work that belongs to them.',
    icon: Users,
    tone: 'text-reference',
  },
  {
    title: 'One shop can become a group.',
    description: 'Location scope, workspaces, audit history, and cross-site comparison are already part of the same operating model.',
    icon: Building2,
    tone: 'text-exception',
  },
];

const roles = [
  {
    name: 'Barista',
    summary: 'Run the floor without navigating the back office.',
    tasks: ['Take orders', 'Work the kitchen queue', 'Check my rota'],
  },
  {
    name: 'Store manager',
    summary: 'Keep one site stocked, staffed, and reconciled.',
    tasks: ['Order and count stock', 'Build the team rota', 'Complete cash-up'],
  },
  {
    name: 'Group owner',
    summary: 'Read every location without flattening their differences.',
    tasks: ['Compare locations', 'Review the audit trail', 'Set group controls'],
  },
];

export default function HomePage() {
  return (
    <main className="min-h-dvh text-foreground">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <header className="flex min-h-18 items-center justify-between border-x border-b border-rule bg-background px-3 sm:px-5">
          <Link href="/" className="flex min-h-11 items-center gap-3" aria-label="DUMA home">
            <Logo size={36} className="rounded-sm" />
            <span>
              <span className="block text-sm font-semibold tracking-tight">DUMA</span>
              <span className="hidden text-micro font-semibold uppercase tracking-micro text-muted-foreground sm:block">
                Coffee Business OS
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild size="touch" className="px-3 text-sm sm:px-4">
              <Link href="/sign-in">Open workspace</Link>
            </Button>
          </div>
        </header>

        <section className="border-x border-b border-rule bg-card lg:grid lg:grid-cols-[minmax(0,0.82fr)_minmax(34rem,1.18fr)]">
          <div className="flex flex-col justify-between border-b border-rule p-5 sm:p-8 lg:border-r lg:border-b-0 lg:p-10 xl:p-14">
            <div>
              <h1 className="max-w-[12ch] text-4xl font-semibold tracking-display sm:text-5xl xl:text-6xl">
                Run a coffee business from open to close.
              </h1>
              <p className="mt-6 max-w-[58ch] text-base text-muted-foreground sm:text-lg">
                Take the sale, move the kitchen queue, count stock, build the rota, run payroll, and read the day—without stitching together
                another stack of tools.
              </p>
            </div>

            <div className="mt-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="touch">
                  <Link href="/sign-in">
                    Open DUMA
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="touch">
                  <Link href="#shift-trace">See the system work</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Pre-launch workspace · Access is currently by invitation</p>
            </div>
          </div>

          <div id="shift-trace" className="scroll-mt-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-rule bg-band px-4 py-3 sm:px-5">
              <div>
                <p className="text-label font-semibold uppercase tracking-label text-muted-foreground">Shift continuity</p>
                <p className="mt-0.5 text-sm font-medium">A connection drop becomes a visible event—not a stopped till.</p>
              </div>
              <span className="annot text-momentum">Sales continue</span>
            </div>
            <LandingShiftTrace />
            <div className="grid border-t border-rule sm:grid-cols-3">
              <div className="flex gap-3 border-b border-rule p-4 sm:border-r sm:border-b-0">
                <CloudOff className="mt-0.5 shrink-0 text-measured" size={18} aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold">Connection drops</p>
                  <p className="mt-1 text-xs text-muted-foreground">The operator keeps taking orders.</p>
                </div>
              </div>
              <div className="flex gap-3 border-b border-rule p-4 sm:border-r sm:border-b-0">
                <ShieldCheck className="mt-0.5 shrink-0 text-momentum" size={18} aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold">Orders queue safely</p>
                  <p className="mt-1 text-xs text-muted-foreground">Every sale stays attached to the right account and location.</p>
                </div>
              </div>
              <div className="flex gap-3 p-4">
                <ArrowRight className="mt-0.5 shrink-0 text-reference" size={18} aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold">Reconnect and reconcile</p>
                  <p className="mt-1 text-xs text-muted-foreground">Queued work replays once; rejected sales remain visible.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-x border-b border-rule bg-background lg:grid lg:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-rule p-5 sm:p-8 lg:border-r lg:border-b-0 lg:p-10">
            <h2 className="max-w-[14ch] text-3xl font-semibold tracking-display sm:text-4xl">
              Four differences that survive a busy shift.
            </h2>
            <p className="mt-5 max-w-[48ch] text-base leading-7 text-muted-foreground">
              DUMA is not a dashboard placed over disconnected modules. These decisions are built into how the product stores, scopes, and
              presents the work.
            </p>
          </div>

          <div className="divide-y divide-rule">
            {differentiators.map(({ title, description, icon: Icon, tone }) => (
              <article key={title} className="grid gap-3 bg-card p-5 sm:grid-cols-[2.5rem_0.72fr_1.28fr] sm:items-start sm:gap-5 sm:p-6">
                <span className="flex size-9 items-center justify-center rounded-sm border border-rule bg-field" aria-hidden="true">
                  <Icon className={tone} size={18} />
                </span>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-x border-b border-rule bg-card">
          <div className="grid border-b border-rule lg:grid-cols-[1fr_1fr]">
            <div className="p-5 sm:p-8 lg:border-r lg:border-rule lg:p-10">
              <h2 className="max-w-[15ch] text-3xl font-semibold tracking-display sm:text-4xl">
                The right workspace for the person holding it.
              </h2>
            </div>
            <div className="border-t border-rule p-5 sm:p-8 lg:border-t-0 lg:p-10">
              <p className="max-w-[58ch] text-base leading-7 text-muted-foreground">
                Roles are assembled from explicit capabilities and can match the jobs in each business. A team member on a shared tablet
                does not inherit an owner’s back office with half the controls removed.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3">
            {roles.map((role, index) => (
              <article key={role.name} className={`p-5 sm:p-6 ${index > 0 ? 'border-t border-rule md:border-t-0 md:border-l' : ''}`}>
                <span className="annot text-reference">{role.name}</span>
                <p className="mt-4 text-lg font-semibold">{role.summary}</p>
                <ul className="mt-5 divide-y divide-rule border-y border-rule text-sm">
                  {role.tasks.map((task) => (
                    <li key={task} className="flex items-center gap-2 py-2.5">
                      <span className="size-1.5 rounded-full bg-measured" aria-hidden="true" />
                      {task}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="border-x border-b border-rule bg-background p-5 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <h2 className="max-w-[13ch] text-3xl font-semibold tracking-display sm:text-4xl">
                Start with one shop. Keep the same system.
              </h2>
              <p className="mt-5 max-w-[52ch] text-base leading-7 text-muted-foreground">
                A single-site team sees the shop it runs. Add locations later and the same workspace opens into group comparison, shared
                controls, and an audit trail—without a migration.
              </p>
            </div>

            <div className="grid border border-rule bg-card sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
              <div className="p-5">
                <Store className="text-measured" size={20} aria-hidden="true" />
                <p data-figure className="mt-5 text-xl font-semibold">
                  1 site
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Orders, people, stock, cash-up, and reports for the shop in front of you.
                </p>
              </div>
              <div
                className="flex items-center justify-center border-y border-rule bg-band px-3 py-2 sm:border-x sm:border-y-0"
                aria-hidden="true"
              >
                <ArrowRight className="rotate-90 text-reference sm:rotate-0" size={18} />
              </div>
              <div className="p-5">
                <Building2 className="text-reference" size={20} aria-hidden="true" />
                <p data-figure className="mt-5 text-xl font-semibold">
                  Group view
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Compare locations, govern shared settings, and inspect who changed what.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid border-x border-b border-rule bg-foreground text-background lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="p-5 sm:p-8 lg:p-10">
            <h2 className="max-w-[15ch] text-3xl font-semibold tracking-display sm:text-4xl">
              See the whole business without leaving the shift.
            </h2>
            <p className="mt-4 max-w-[62ch] text-base leading-7 text-background/75">
              DUMA is in pre-launch. Workspace access is currently set up directly with each team.
            </p>
          </div>
          <div className="border-t border-background/30 p-5 sm:p-8 lg:border-t-0 lg:border-l lg:p-10">
            <Button
              asChild
              variant="outline"
              size="touch"
              className="w-full border-background bg-background text-foreground hover:bg-band lg:w-auto"
            >
              <Link href="/sign-in">
                Open DUMA
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-x border-b border-rule bg-background px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p>© 2026 DUMA · Coffee Business OS</p>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="min-h-11 content-center hover:text-foreground">
              Sign in
            </Link>
            <Link href="/support" className="min-h-11 content-center hover:text-foreground">
              Support
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
