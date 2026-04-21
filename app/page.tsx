import Link from 'next/link';
import { ArrowRight, CheckCircle2, Coffee, ShieldCheck, Sparkles, Store, Timer, Users, Zap } from 'lucide-react';
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

const examples = [
  {
    title: 'Morning Rush Control',
    text: 'Queue spikes at 8:30? DUMA highlights bottlenecks and surfaces top repeat orders so baristas stay ahead.',
    metric: '22% faster ticket completion',
    icon: Timer,
  },
  {
    title: 'Multi-Location Visibility',
    text: 'Compare performance across Soho, Shoreditch, and Camden from one dashboard with shared standards.',
    metric: '3 locations synced in one view',
    icon: Store,
  },
  {
    title: 'Loyalty That Actually Sticks',
    text: 'Recognize returning guests instantly, track visit patterns, and trigger the right offer at the right time.',
    metric: '62% returning customer rate',
    icon: Users,
  },
];

const steps = [
  'Connect your workspace and locations in minutes.',
  'Import menu, stock items, and team roles.',
  'Launch with live dashboards and smart alerts.',
];

const testimonials = [
  {
    quote: 'We replaced three disconnected tools with one calm workflow. Team onboarding got dramatically easier.',
    author: 'Alicia M.',
    role: 'Operations Lead, Harbor Coffee',
  },
  {
    quote: 'The low-stock and returning-guest signals changed our daily decisions almost immediately.',
    author: 'Marcus P.',
    role: 'Owner, Sunline Roasters',
  },
];

const faqs = [
  {
    q: 'How quickly can we go live?',
    a: 'Most teams set up core workflows in one afternoon, then fine-tune automations over the first week.',
  },
  {
    q: 'Does DUMA work for single and multi-location cafes?',
    a: 'Yes. Start with one shop and scale to multiple locations with shared standards and local controls.',
  },
  {
    q: 'Can staff access only the modules they need?',
    a: 'Yes. Role-based access keeps sensitive settings secure while making daily operations simple for front-line teams.',
  },
];

const moduleGroups = [
  {
    area: 'Sales & Front of House',
    modules: ['POS & checkout', 'Orders & tabs', 'Menu management', 'Receipt generation', 'Invoice generation'],
  },
  {
    area: 'Customers & Loyalty',
    modules: ['Customer profiles', 'Loyalty wallet', 'Visit history', 'Campaigns & offers', 'Feedback tracking'],
  },
  {
    area: 'Warehouse & Inventory',
    modules: ['Warehouse stock', 'Supplier purchase orders', 'Ingredient-level usage', 'Transfer between locations', 'Waste tracking'],
  },
  {
    area: 'People & Learning',
    modules: ['HT / HR records', 'Shift scheduling', 'Barista learning system', 'SOP playbooks', 'Performance checklists'],
  },
  {
    area: 'Finance & Control',
    modules: ['Cash reconciliation', 'Invoices & payments', 'Tax-ready exports', 'Daily P&L snapshots', 'Role-based approvals'],
  },
  {
    area: 'Leadership & Multi-Store',
    modules: ['Multi-location dashboard', 'KPI scorecards', 'Alerts & automation', 'Audit logs', 'Owner command center'],
  },
];

const kpiBars = [
  { label: 'Mon', value: 52 },
  { label: 'Tue', value: 68 },
  { label: 'Wed', value: 61 },
  { label: 'Thu', value: 77 },
  { label: 'Fri', value: 92 },
  { label: 'Sat', value: 84 },
  { label: 'Sun', value: 58 },
];

const modulePreviews: Record<
  string,
  {
    badge: string;
    tone: 'success' | 'info' | 'warning' | 'primary';
    metrics: Array<{ label: string; value: string }>;
    note: string;
  }
> = {
  'Sales & Front of House': {
    badge: 'Service Live',
    tone: 'success',
    metrics: [
      { label: 'Active Tabs', value: '26' },
      { label: 'Tickets / Hour', value: '89' },
      { label: 'Avg Checkout', value: '£7.80' },
    ],
    note: 'POS queue stable. Seasonal drinks performing 18% above forecast.',
  },
  'Customers & Loyalty': {
    badge: 'CRM Synced',
    tone: 'info',
    metrics: [
      { label: 'Returning Guests', value: '62%' },
      { label: 'Loyalty Redeems', value: '148' },
      { label: 'Campaign CTR', value: '22%' },
    ],
    note: 'Best segment today: weekday commuters ordering before 9:00.',
  },
  'Warehouse & Inventory': {
    badge: '4 Alerts',
    tone: 'warning',
    metrics: [
      { label: 'Low Stock SKUs', value: '4' },
      { label: 'POs Drafted', value: '3' },
      { label: 'Waste This Week', value: '1.8%' },
    ],
    note: 'Recommend oat milk replenishment before Friday demand window.',
  },
  'People & Learning': {
    badge: 'Shift Ready',
    tone: 'success',
    metrics: [
      { label: 'Coverage Today', value: '92%' },
      { label: 'Training Due', value: '3' },
      { label: 'SOP Completion', value: '97%' },
    ],
    note: 'Barista calibration module assigned to new joiners for this week.',
  },
  'Finance & Control': {
    badge: 'Books Healthy',
    tone: 'info',
    metrics: [
      { label: 'Receipts Issued', value: '1,284' },
      { label: 'Invoices Pending', value: '12' },
      { label: 'Cash Variance', value: '0.3%' },
    ],
    note: 'All daily receipts exported and ready for accounting handoff.',
  },
  'Leadership & Multi-Store': {
    badge: 'HQ View',
    tone: 'primary',
    metrics: [
      { label: 'Locations Online', value: '3 / 3' },
      { label: 'Top Store Growth', value: '+14%' },
      { label: 'Critical Alerts', value: '1' },
    ],
    note: 'Soho leads revenue today; Camden needs afternoon labor rebalance.',
  },
};

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

        <section className="mt-18 rounded-3xl border border-border/70 bg-card/70 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Complete platform</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">All modules needed to run a coffee business</h2>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
            From front counter to back office, training, and executive reporting, every team works inside the same source of truth.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {moduleGroups.map(({ area, modules }) => (
              <article key={area} className="rounded-2xl border border-border/70 bg-background/65 p-5">
                <h3 className="text-sm font-semibold tracking-wide text-foreground">{area}</h3>
                <div className="mt-3 space-y-2">
                  {modules.map((moduleName) => (
                    <p key={moduleName} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 size={14} className="text-primary" aria-hidden="true" />
                      {moduleName}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-border/70 bg-card/70 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Module previews</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Visual cards for every platform area</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {moduleGroups.map(({ area, modules }) => {
              const preview = modulePreviews[area];
              const toneStyles = {
                success: 'bg-success-highlight text-success',
                info: 'bg-info-highlight text-info',
                warning: 'bg-warning-highlight text-warning',
                primary: 'bg-primary/10 text-primary',
              }[preview.tone];

              return (
                <article key={`${area}-preview`} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-2.5">
                    <p className="text-sm font-medium">{area}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneStyles}`}>{preview.badge}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {preview.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-lg border border-border/70 bg-card/80 p-2.5">
                        <p className="text-[10px] text-muted-foreground">{metric.label}</p>
                        <p className="mt-1 text-sm font-semibold">{metric.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-lg border border-primary/30 bg-primary/8 p-2.5">
                    <p className="text-[11px] font-medium text-primary">System insight</p>
                    <p className="mt-1 text-xs text-foreground/90">{preview.note}</p>
                  </div>

                  <p className="mt-3 text-[11px] text-muted-foreground">Includes: {modules.slice(0, 2).join(' • ')} • +more</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-18 rounded-3xl border border-border/70 bg-card/70 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Visual walkthrough</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">See the modules your team will use daily</h2>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
            Each workspace area is designed as a focused panel so front-line staff and managers can act quickly without tool switching.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-border/70 bg-background/70 p-5">
              <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
                <p className="text-sm font-medium">KPI Command Center</p>
                <span className="rounded-full bg-info-highlight px-2.5 py-1 text-xs font-medium text-info">Live KPI</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                  <p className="text-[11px] text-muted-foreground">Revenue</p>
                  <p className="mt-1 text-lg font-semibold">£12.4k</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                  <p className="text-[11px] text-muted-foreground">Avg Ticket</p>
                  <p className="mt-1 text-lg font-semibold">£7.80</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                  <p className="text-[11px] text-muted-foreground">Labor %</p>
                  <p className="mt-1 text-lg font-semibold">29%</p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-border/70 bg-card/80 p-3">
                <p className="text-xs text-muted-foreground">Weekly Sales Trend</p>
                <div className="mt-3 flex h-24 items-end gap-2">
                  {kpiBars.map((bar) => (
                    <div key={bar.label} className="flex flex-1 flex-col items-center gap-1">
                      <div className="w-full rounded-md bg-primary/70" style={{ height: `${bar.value}%` }} />
                      <span className="text-[10px] text-muted-foreground">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-border/70 bg-background/70 p-5">
              <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
                <p className="text-sm font-medium">HT / HR & Shift Planner</p>
                <span className="rounded-full bg-success-highlight px-2.5 py-1 text-xs font-medium text-success">Covered</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-muted-foreground">Morning Shift (06:00 - 12:00)</p>
                    <p className="font-medium">5 / 5 assigned</p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div className="h-2 w-full rounded-full bg-success" />
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-muted-foreground">Afternoon Shift (12:00 - 18:00)</p>
                    <p className="font-medium">4 / 5 assigned</p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div className="h-2 w-4/5 rounded-full bg-warning" />
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-primary/10 p-3">
                  <p className="text-xs text-primary">Barista Learning</p>
                  <p className="mt-1 text-sm font-medium">3 team members are due for espresso calibration training today.</p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-border/70 bg-background/70 p-5">
              <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
                <p className="text-sm font-medium">Warehouse & Stock</p>
                <span className="rounded-full bg-warning-highlight px-2.5 py-1 text-xs font-medium text-warning">4 alerts</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                  <p className="text-xs text-muted-foreground">Oat Milk</p>
                  <p className="mt-1 text-base font-semibold">18 cartons remaining</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                  <p className="text-xs text-muted-foreground">Espresso Beans</p>
                  <p className="mt-1 text-base font-semibold">42 kg in central warehouse</p>
                </div>
                <div className="rounded-xl border border-primary/35 bg-primary/10 p-3">
                  <p className="text-xs text-primary">Auto Suggestion</p>
                  <p className="mt-1 text-sm font-medium">Create supplier PO for oat milk before Friday peak period.</p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-border/70 bg-background/70 p-5">
              <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
                <p className="text-sm font-medium">Receipts & Invoicing</p>
                <span className="rounded-full bg-info-highlight px-2.5 py-1 text-xs font-medium text-info">Auto Synced</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                  <p className="text-xs text-muted-foreground">Receipts Issued</p>
                  <p className="mt-1 text-lg font-semibold">1,284</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-3">
                  <p className="text-xs text-muted-foreground">Invoices Pending</p>
                  <p className="mt-1 text-lg font-semibold">12</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-border/70 bg-card/80 p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-1 text-sm font-medium">All location receipts exported and ready for accounting handoff.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-border/70 bg-card/70 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">HR deep preview</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">People & Learning pages at a glance</h2>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
            A closer look at the HT/HR area: scheduling, employee detail, and barista training are all connected.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <p className="text-[11px] text-muted-foreground">Total Team</p>
              <p className="mt-1 text-lg font-semibold">47</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <p className="text-[11px] text-muted-foreground">On Shift Now</p>
              <p className="mt-1 text-lg font-semibold">18</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <p className="text-[11px] text-muted-foreground">Training Due</p>
              <p className="mt-1 text-lg font-semibold">3</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <p className="text-[11px] text-muted-foreground">Open Roles</p>
              <p className="mt-1 text-lg font-semibold">2</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-2.5">
                <p className="text-sm font-medium">HR Roster Page</p>
                <span className="rounded-full bg-success-highlight px-2.5 py-1 text-xs font-medium text-success">Today</span>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Ava M. • Head Barista</p>
                    <p className="text-muted-foreground">06:00 - 14:00</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Leo K. • Barista</p>
                    <p className="text-muted-foreground">07:00 - 15:00</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Mia R. • Floor Lead</p>
                    <p className="text-muted-foreground">12:00 - 20:00</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-2.5">
                <p className="text-[11px] text-primary">Coverage</p>
                <p className="mt-1 text-xs font-medium">Shift staffing is at 92%, one backup needed for late rush.</p>
              </div>
            </article>

            <article className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-2.5">
                <p className="text-sm font-medium">Employee Profile</p>
                <span className="rounded-full bg-info-highlight px-2.5 py-1 text-xs font-medium text-info">Active</span>
              </div>
              <div className="rounded-lg border border-border/70 bg-card/80 p-3">
                <p className="text-xs text-muted-foreground">Team Member</p>
                <p className="mt-1 text-sm font-semibold">Ava Martinez</p>
                <p className="text-xs text-muted-foreground">Head Barista • Soho</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5">
                  <p className="text-[10px] text-muted-foreground">Attendance</p>
                  <p className="mt-1 text-sm font-semibold">98%</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5">
                  <p className="text-[10px] text-muted-foreground">Skill Level</p>
                  <p className="mt-1 text-sm font-semibold">Advanced</p>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-border/70 bg-card/80 p-2.5">
                <p className="text-[11px] text-muted-foreground">Certifications</p>
                <p className="mt-1 text-xs">Espresso calibration, latte art, grinder maintenance.</p>
              </div>
            </article>

            <article className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-2.5">
                <p className="text-sm font-medium">Barista Learning Page</p>
                <span className="rounded-full bg-warning-highlight px-2.5 py-1 text-xs font-medium text-warning">3 Due</span>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <p>Espresso Dial-in Standard</p>
                    <p className="font-medium">100%</p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 w-full rounded-full bg-success" />
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <p>Milk Texture Fundamentals</p>
                    <p className="font-medium">78%</p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 w-4/5 rounded-full bg-warning" />
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <p>POS Exception Handling</p>
                    <p className="font-medium">64%</p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 w-2/3 rounded-full bg-primary" />
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-success/30 bg-success-highlight p-2.5">
                <p className="text-[11px] text-success">Next action</p>
                <p className="mt-1 text-xs font-medium text-foreground">Assign “POS Exception Handling” refresher to two new starters.</p>
              </div>
            </article>

            <article className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-2.5">
                <p className="text-sm font-medium">Payroll & Timesheets</p>
                <span className="rounded-full bg-info-highlight px-2.5 py-1 text-xs font-medium text-info">Period Open</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5">
                  <p className="text-[10px] text-muted-foreground">Hours Logged</p>
                  <p className="mt-1 text-sm font-semibold">1,126h</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5">
                  <p className="text-[10px] text-muted-foreground">Overtime</p>
                  <p className="mt-1 text-sm font-semibold">37h</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">Pending Approvals</p>
                    <p className="font-medium">5 entries</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">Payroll ETA</p>
                    <p className="font-medium">Fri 17:00</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-2.5">
                <p className="text-[11px] text-primary">Control check</p>
                <p className="mt-1 text-xs font-medium">No anomalies detected in labor cost vs. scheduled hours.</p>
              </div>
            </article>

            <article className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-2.5">
                <p className="text-sm font-medium">Hiring & Onboarding</p>
                <span className="rounded-full bg-warning-highlight px-2.5 py-1 text-xs font-medium text-warning">2 Open Roles</span>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5 text-xs">
                  <p className="text-muted-foreground">Senior Barista</p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="font-medium">11 applicants</p>
                    <p className="text-muted-foreground">3 shortlisted</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/80 p-2.5 text-xs">
                  <p className="text-muted-foreground">Floor Lead</p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="font-medium">8 applicants</p>
                    <p className="text-muted-foreground">2 interviews</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-border/70 bg-card/80 p-2.5">
                <p className="text-[11px] text-muted-foreground">Onboarding progress</p>
                <div className="mt-2 h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 w-3/4 rounded-full bg-primary" />
                </div>
                <p className="mt-1 text-xs">6 of 8 onboarding tasks completed for new starter cohort.</p>
              </div>
              <div className="mt-3 rounded-lg border border-success/30 bg-success-highlight p-2.5">
                <p className="text-[11px] text-success">Suggested next step</p>
                <p className="mt-1 text-xs font-medium text-foreground">Schedule trial shift for top two Senior Barista candidates.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="mt-18 rounded-3xl border border-border/70 bg-card/70 p-6 sm:p-8">
          <div className="mb-6 flex items-end justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Real examples</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">How teams use DUMA every day</h2>
            </div>
            <Button asChild variant="outline" className="h-9 px-4 text-sm">
              <Link href="/dashboard">Explore Demo Data</Link>
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {examples.map(({ title, text, metric, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-border/70 bg-background/70 p-5">
                <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon size={16} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{text}</p>
                <p className="mt-3 text-sm font-medium text-primary">{metric}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-18 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-border/70 bg-card/70 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Simple rollout</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Launch in 3 steps</h2>
            <div className="mt-6 space-y-4">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-xl border border-border/70 bg-background/60 p-4">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </div>
                  <p className="text-sm text-foreground/90">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-card/70 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Trusted by teams</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">What operators say</h2>
            <div className="mt-6 space-y-4">
              {testimonials.map(({ quote, author, role }) => (
                <blockquote key={author} className="rounded-xl border border-border/70 bg-background/60 p-4">
                  <p className="text-sm leading-relaxed">“{quote}”</p>
                  <footer className="mt-3">
                    <p className="text-sm font-medium">{author}</p>
                    <p className="text-xs text-muted-foreground">{role}</p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-18 rounded-3xl border border-border/70 bg-card/70 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">FAQ</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Questions before you start</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {faqs.map(({ q, a }) => (
              <article key={q} className="rounded-xl border border-border/70 bg-background/60 p-4">
                <h3 className="text-sm font-semibold">{q}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-18 rounded-3xl border border-primary/35 bg-primary/10 p-8 sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Make your next shift your smoothest one.</h2>
              <p className="mt-3 max-w-2xl text-sm text-foreground/85 sm:text-base">
                Start free, invite your team, and set up your first location in minutes. No heavy implementation needed.
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-foreground/85">
                <p className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={15} aria-hidden="true" /> No credit card
                </p>
                <p className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={15} aria-hidden="true" /> Fast setup
                </p>
                <p className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={15} aria-hidden="true" /> Team-ready defaults
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-11 px-5 text-sm">
                <Link href="/sign-up">
                  Create Workspace
                  <ArrowRight className="ml-1" size={16} aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 border-primary/35 bg-background/70 px-5 text-sm">
                <Link href="/sign-in">Book a Demo Call</Link>
              </Button>
            </div>
          </div>
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
