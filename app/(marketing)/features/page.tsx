import type { Metadata } from 'next';
import Link from 'next/link';

import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChefHat,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  Gift,
  History,
  Layers,
  ListChecks,
  Mail,
  NotebookPen,
  Package,
  QrCode,
  Receipt,
  Share2,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  Truck,
  UserRound,
  Wallet,
  Zap,
} from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { ShapeShiftingMascot } from '@/components/marketing/ShapeShiftingMascot';
import { ChalkCurve, CornerStrokes, RisingLines } from '@/components/marketing/Strokes';
import { COLUMN, ClosingCta, FaqSection, Mark, SecondaryButton, SignUpButton } from '@/components/marketing/sections';
import { TONE_TEXT } from '@/components/marketing/sections';

import type { Tone } from '@/lib/marketing/home';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema, faqSchema } from '@/lib/marketing/schema';
import { MODULES, MODULE_GROUP_LABELS, type MarketingModule, type ModuleGroup, linkTo, modulePath } from '@/lib/marketing/site';
import { cn } from '@/lib/utils/cn';

const DESCRIPTION =
  'Every part of DUMA, free all-in-one software for UK cafés, restaurants and shops: an offline EPOS till, recipe costing, stock, rotas, customers and more.';

export const metadata: Metadata = marketingMetadata({
  title: 'DUMA Features: EPOS, Recipe Costing, Stock and Rotas',
  description: DESCRIPTION,
  path: '/features',
});

const FAQS = [
  {
    question: 'Can I use just one part of DUMA?',
    answer:
      'Yes. DUMA is modular: switch on only what you need, such as the till or the rota, and add more later. Everything shares one workspace, so nothing has to be moved when you do.',
  },
  {
    question: 'Which parts of DUMA are free?',
    answer:
      'The till, orders and payments, products and menu with margin, stock, customers, and rotas and time are free in full, with no time limit. Every other part keeps a free allowance. Business, with much higher limits, is £89 a month and coming soon.',
  },
  {
    question: 'Do I need new hardware?',
    answer:
      'No. DUMA runs in a browser on the tablet, phone or laptop you already have, and can be installed like an app. Keep your card machine: Square, SumUp and Stripe connect directly, and any other works with the amount keyed in.',
  },
];

type Icon = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

/** Each group's colour, and the one line that says what is in it. */
const GROUP_STYLE: Record<ModuleGroup, { tone: Tone; title: string }> = {
  'front-of-house': { tone: 'orders', title: 'The till, the floor and the kitchen' },
  'back-of-house': { tone: 'stock', title: 'What you sell, what it costs, what’s on the shelf' },
  people: { tone: 'team', title: 'Rotas, records and pay' },
  growth: { tone: 'reference', title: 'Bring customers back, and tell them what’s new' },
  insight: { tone: 'action', title: 'Know how it went, and who changed what' },
};

/** Each module's icon, drawn in its group's colour. */
const MODULE_ICON: Record<string, Icon> = {
  pos: Receipt,
  orders: ClipboardList,
  'qr-ordering': QrCode,
  'kitchen-display': ChefHat,
  payments: CreditCard,
  reservations: CalendarDays,
  'products-catalog': Layers,
  inventory: Package,
  purchasing: Truck,
  notes: NotebookPen,
  'staff-scheduling': Clock,
  'people-hr': UserRound,
  payroll: Wallet,
  'help-centre': BookOpen,
  'customers-loyalty': Gift,
  'email-marketing': Mail,
  automation: Zap,
  promotions: TicketPercent,
  referrals: Share2,
  forms: ListChecks,
  'content-management': FileText,
  reports: BarChart3,
  'ask-duma': Sparkles,
  compliance: ShieldCheck,
  'audit-log': History,
};

const GROUPS = Object.keys(MODULE_GROUP_LABELS) as ModuleGroup[];

/**
 * One module as a small card: its icon, name and summary. A module with its
 * own page is a link with an arrow; the rest sit on a dashed outline.
 */
function ModuleCard({ module, tone }: { module: MarketingModule; tone: Tone }) {
  const Icon = MODULE_ICON[module.slug] ?? Layers;
  const body = (
    <>
      <span className="flex items-center justify-between gap-3">
        <Icon className={cn('size-5', TONE_TEXT[tone])} aria-hidden="true" />
        {module.published && <ArrowUpRight className="size-4 shrink-0 text-primary" aria-hidden="true" />}
      </span>
      <span className="mt-3 font-semibold text-[var(--mkt-heading)] group-hover:text-primary">{module.name}</span>
      <span className="mt-1.5 text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">{module.summary}</span>
    </>
  );
  return module.published ? (
    <Link href={modulePath(module.slug)} className="mkt-card group flex h-full flex-col px-5 py-4 hover:border-primary/40">
      {body}
    </Link>
  ) : (
    <div className="flex h-full flex-col rounded-[14px] border border-dashed border-[var(--mkt-line)] px-5 py-4">{body}</div>
  );
}

/**
 * /features — every module a workspace can switch on, grouped as the product
 * groups them, under the home page's two-tone headings. A module with a published page links to it; the
 * rest carry no link, so nothing here points at a 404.
 */
export default function FeaturesIndexPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'All features', path: '/features' }])} />
      <JsonLd data={faqSchema(FAQS)} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* Pulled up 4rem, under the sticky header, so the chalk curves start at the very top of the page. */}
      {/* The curves sit on a wrapper round the hero and the groups: this hero is
          short, and clipped to itself the right-hand curve was cut off mid-stroke. */}
      <div className="relative -mt-16 overflow-hidden">
        <ChalkCurve side="left" id="features-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="features-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />
        <section className="relative px-4 pt-30 pb-6 sm:px-6 sm:pt-40">
          <div className={cn(COLUMN, 'relative z-10')}>
            <h1 className="text-[2.75rem] leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-6xl">
              Everything DUMA does, <span className="mkt-mark mkt-mark-green rounded-md px-2">in one place</span>
            </h1>
            <p className="mt-6 max-w-[56rem] text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">
              An EPOS till, orders, stock, recipe costing, rotas, customers, marketing and reports share one workspace and one bill. Switch
              on the parts you need; every sale updates the rest.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <SignUpButton />
              <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
            </div>
            <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--mkt-ink-2)]">
              {['Free plan, forever', 'Keep your card machine', 'Works offline'].map((fact) => (
                <span key={fact} className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" aria-hidden="true" />
                  {fact}
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* ── The modules, one group at a time ─────────────────────────────── */}
        {GROUPS.map((group) => {
          const style = GROUP_STYLE[group];
          return (
            <section key={group} id={group} className="scroll-mt-20 px-4 py-6 sm:px-6 sm:py-8" aria-labelledby={`group-${group}`}>
              <div className={cn(COLUMN, 'relative z-10')}>
                <h2 id={`group-${group}`} className="text-xl font-semibold tracking-display text-[var(--mkt-heading)]">
                  {style.title}
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {MODULES.filter((m) => m.group === group).map((module, i) => (
                    <li key={module.slug} data-reveal="" data-reveal-delay={(i % 3) * 60}>
                      <ModuleCard module={module} tone={style.tone} />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </div>

      {/* ── Setup band, with the mascot ───────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-20 text-center sm:px-6 sm:py-32" aria-labelledby="setup">
        <CornerStrokes />
        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="flex justify-center" aria-hidden="true">
            <ShapeShiftingMascot size={140} state="idle" expression="excite" gesture="celebrate" gestureKey="features-setup" follow />
          </div>
          <h2 id="setup" className="mt-6 text-balance text-3xl leading-[1.12] font-semibold tracking-display sm:text-4xl">
            Switch on one part. Add the rest when you’re ready.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[1.0625rem] leading-relaxed text-[var(--mkt-ink-2)]">
            Every part shares one set of data, so <Mark>nothing is moved and nobody types anything twice</Mark> when you turn on the next
            one.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <SignUpButton />
            <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
          </div>
          <p className="mt-5 text-sm text-[var(--mkt-ink-2)]">Free plan, forever. No card needed.</p>
        </div>
      </section>

      <div className="relative overflow-hidden">
        <ChalkCurve
          side="right"
          id="features-faq-right"
          className="pointer-events-none absolute -top-24 -right-48 hidden w-[46rem] md:block"
        />
        <FaqSection items={FAQS} title="Questions about DUMA’s features" />
      </div>

      <ClosingCta
        title="Start with the part you need."
        muted="The rest is already there."
        body="Get started in minutes, completely free. No card required, and we’ll help you set it up."
        aside={<RisingLines id="features-cta" />}
      />
    </>
  );
}
