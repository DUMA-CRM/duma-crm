import type { Metadata } from 'next';
import Link from 'next/link';

import { Mascot } from '@/components/ai/Mascot';
import {
  Building2,
  CalendarDays,
  Check,
  ChefHat,
  ClipboardList,
  Clock,
  Code,
  CreditCard,
  Gift,
  Globe,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Package,
  Printer,
  QrCode,
  Receipt,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  WifiOff,
} from '@/components/icons';
import { CompareTable } from '@/components/marketing/CompareTable';
import { IntegrationMarquee } from '@/components/marketing/IntegrationMarquee';
import { JsonLd } from '@/components/marketing/JsonLd';
import { ProductTabs } from '@/components/marketing/ProductTabs';
import { ReviewTicker } from '@/components/marketing/ReviewTicker';
import { Screenshot } from '@/components/marketing/Screenshot';
import { ShapeShiftingMascot } from '@/components/marketing/ShapeShiftingMascot';
import { ChalkCurve, ChalkDivider, CornerStrokes, RisingLines } from '@/components/marketing/Strokes';
import {
  AskMock,
  CustomerMock,
  CustomersScreen,
  KitchenMock,
  LocationsMock,
  MarginMock,
  OfflineQueueMock,
  OrdersScreen,
  QrMock,
  RotaMock,
  SaleTrailMock,
  StockMock,
  VariantStockMock,
} from '@/components/marketing/mocks';
import {
  Annotation,
  COLUMN,
  ClosingCta,
  FaqSection,
  FeatureCard,
  Mark,
  SecondaryButton,
  Section,
  SectionHeading,
  SignUpButton,
} from '@/components/marketing/sections';

import { FAQS } from '@/lib/marketing/home';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { reviewsToShow } from '@/lib/marketing/reviews';
import { faqSchema, softwareApplicationSchema } from '@/lib/marketing/schema';
import { hasScreenshot } from '@/lib/marketing/screenshots.server';
import { linkTo } from '@/lib/marketing/site';
import { cn } from '@/lib/utils/cn';

const DESCRIPTION =
  'Till, orders, stock, rotas, customers and reports in one place. Free plan, no card needed. For UK cafés, food businesses and small shops.';

// Title and H1 say the same thing in different words — Google builds the
// title link from both, and a slogan in either would waste the page's
// strongest signal.
export const metadata: Metadata = marketingMetadata({
  title: 'Free All-in-One EPOS and Business Software UK | DUMA',
  description: DESCRIPTION,
  path: '/',
});

/** A screenshot inside the hero's tab frame: the frame already draws the edge. */
const FRAMELESS = 'rounded-none border-0';

type Cell = { mark: 'yes' | 'part' | 'no'; note?: string };
type Row = {
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  duma: Cell;
  till: Cell;
  stack: Cell;
};

/**
 * DUMA against the two things a small business usually runs instead. The other
 * two columns are categories, not named products, so every note is a fair
 * generalisation — and the rows DUMA loses stay in.
 */
const COMPARE: Row[] = [
  {
    label: 'Till and card payments',
    icon: Receipt,
    duma: { mark: 'yes', note: 'Any card machine' },
    till: { mark: 'yes' },
    stack: { mark: 'yes', note: 'One of the apps' },
  },
  {
    label: 'Keeps selling offline',
    icon: WifiOff,
    duma: { mark: 'yes' },
    till: { mark: 'part', note: 'Varies by app' },
    stack: { mark: 'part', note: 'Varies by app' },
  },
  {
    label: 'Stock and recipe margin',
    icon: Package,
    duma: { mark: 'yes', note: 'VAT-aware' },
    till: { mark: 'part', note: 'Often an add-on' },
    stack: { mark: 'part', note: 'Another app' },
  },
  { label: 'Rotas and clock-ins', icon: Clock, duma: { mark: 'yes' }, till: { mark: 'no' }, stack: { mark: 'part', note: 'Another app' } },
  {
    label: 'Loyalty and email',
    icon: Gift,
    duma: { mark: 'yes' },
    till: { mark: 'part', note: 'Often an add-on' },
    stack: { mark: 'part', note: 'Two more apps' },
  },
  {
    label: 'Table bookings',
    icon: CalendarDays,
    duma: { mark: 'yes', note: 'Floor plan and waitlist' },
    till: { mark: 'no' },
    stack: { mark: 'part', note: 'Another app' },
  },
  {
    label: 'One customer record',
    icon: Users,
    duma: { mark: 'yes' },
    till: { mark: 'part', note: 'Payments only' },
    stack: { mark: 'no', note: 'Copied between apps' },
  },
  {
    label: 'API and MCP',
    icon: Code,
    duma: { mark: 'yes' },
    till: { mark: 'part', note: 'Varies' },
    stack: { mark: 'part', note: 'One per app' },
  },
  {
    label: 'Free setup help',
    icon: LifeBuoy,
    duma: { mark: 'yes', note: 'From the person who builds it' },
    till: { mark: 'part', note: 'Varies' },
    stack: { mark: 'no' },
  },
  {
    label: 'A hosted online store',
    icon: ShoppingBag,
    duma: { mark: 'no', note: 'Planned' },
    till: { mark: 'part', note: 'Some offer one' },
    stack: { mark: 'yes', note: 'If you pay for one' },
  },
  {
    label: 'Receipt printer and cash drawer',
    icon: Printer,
    duma: { mark: 'yes', note: 'Any device; drawer via a connected printer' },
    till: { mark: 'yes' },
    stack: { mark: 'yes' },
  },
  {
    label: 'Card machines beyond Square, SumUp and Stripe',
    icon: CreditCard,
    duma: { mark: 'part', note: 'Amount keyed in by hand' },
    till: { mark: 'yes', note: 'Their own' },
    stack: { mark: 'yes' },
  },
];

const BEST_FOR = {
  duma: 'Small food businesses and shops that want one place for everything',
  till: 'Taking payments, and not much else',
  stack: 'Teams happy to run several logins and bills',
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={softwareApplicationSchema({ description: DESCRIPTION })} />
      <JsonLd data={faqSchema(FAQS)} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {/* Pulled up 4rem, under the sticky header, so the chalk curves start at the very top of the page. */}
      <section className="relative -mt-16 overflow-hidden px-4 pt-30 pb-10 sm:px-6 sm:pt-40">
        <ChalkCurve side="left" id="hero-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="hero-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />
        <div className={cn(COLUMN, 'relative z-10')}>
          <h1 className="text-[2.75rem] leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-6xl lg:text-[3.4rem]">
            The <span className="mkt-mark mkt-mark-green rounded-md px-2">one place</span> to run your whole business
          </h1>
          <p className="mt-6 text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">
            Everything a UK café, food business or small shop runs on, from the EPOS till and stock to staff and customers. All on your
            existing tablet, with the card reader you already use.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <SignUpButton />
            <SecondaryButton href="#why">See how it works</SecondaryButton>
          </div>

          <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--mkt-ink-2)]">
            {['Free plan, forever', 'No card needed', 'Free setup help'].map((fact) => (
              <span key={fact} className="flex items-center gap-1.5">
                <Check className="size-4 text-primary" aria-hidden="true" />
                {fact}
              </span>
            ))}
          </p>

          <div className="mt-16 sm:mt-20">
            <ProductTabs
              tabs={[
                {
                  id: 'dashboard',
                  label: 'Dashboard',
                  icon: <LayoutDashboard />,
                  tone: 'reference',
                  panel: <Screenshot shot="dashboard" preload className={FRAMELESS} />,
                },
                { id: 'pos', label: 'POS', icon: <Receipt />, tone: 'action', panel: <Screenshot shot="pos" className={FRAMELESS} /> },
                // Drawn stand-ins until orders.png / customers.png are dropped into public/marketing/screenshots.
                {
                  id: 'orders',
                  label: 'Orders',
                  icon: <ClipboardList />,
                  tone: 'orders',
                  panel: hasScreenshot('orders') ? <Screenshot shot="orders" className={FRAMELESS} /> : <OrdersScreen />,
                },
                {
                  id: 'customers',
                  label: 'Customers',
                  icon: <Users />,
                  tone: 'team',
                  panel: hasScreenshot('customers') ? <Screenshot shot="customers" className={FRAMELESS} /> : <CustomersScreen />,
                },
              ]}
            >
              {/* Reviews on the left, level with the mascot — real ones only in production (lib/marketing/reviews.ts). */}
              <div className="absolute -top-10 right-48 left-1 hidden sm:block">
                <ReviewTicker reviews={reviewsToShow()} />
              </div>
              {/* The mascot, peeking over the frame's top edge. */}
              <div className="pointer-events-none absolute -top-20 right-10 hidden sm:block" aria-hidden="true">
                <Mascot size={120} state="idle" expression="attentif" gesture="wave" gestureKey="hero" follow />
              </div>
            </ProductTabs>
            <Annotation className="mt-6 justify-center">click to switch between the parts of your day</Annotation>
          </div>
        </div>
      </section>

      {/* ── Two statements, set like quotes ───────────────────────────────── */}
      <Section spacing="snug">
        <div className="grid gap-10 md:grid-cols-2 md:gap-12">
          {[
            {
              icon: <WifiOff className="size-5" aria-hidden="true" />,
              who: 'The offline till',
              line: 'Works without internet',
              body: (
                <>
                  When the Wi-Fi drops mid-rush, <Mark>the till keeps taking orders.</Mark> They’re saved on the device and sent when it’s
                  back — and a sale that can’t be sent is kept for you to check, never thrown away.
                </>
              ),
            },
            {
              icon: <Layers className="size-5" aria-hidden="true" />,
              who: 'One system',
              line: 'Every part shares one set of data',
              body: (
                <>
                  A sale moves your stock, your customer’s history, your margin and your reports at the same moment, so{' '}
                  <Mark>nobody types anything twice.</Mark>
                </>
              ),
            },
          ].map((item, index) => (
            <figure key={item.who} data-reveal="" data-reveal-delay={index * 100}>
              <blockquote className="text-pretty text-lg leading-relaxed text-[var(--mkt-ink-2)]">{item.body}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-[10px] bg-[var(--mkt-card)] text-primary ring-1 ring-[var(--mkt-line)]">
                  {item.icon}
                </span>
                <span>
                  <span className="block text-[0.9375rem] font-medium">{item.who}</span>
                  <span className="block text-sm text-[var(--mkt-ink-3)]">{item.line}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* ── Why DUMA — the bento ──────────────────────────────────────────── */}
      <Section id="why" spacing="roomy" aria-labelledby="why-title">
        <SectionHeading
          id="why-title"
          title="Why DUMA?"
          className="max-w-none"
          intro={
            <p>
              DUMA works for any business that sells, books or publishes, from cafés and restaurants to online shops, courses and blogs.
              Switch on only the modules you need, and on the Business plan, ask for a new one and we’ll build it for free.
            </p>
          }
        />

        {/*
          A bento: a wide tile beside the tall Ask DUMA with two small tiles under it, then rows that
          alternate (half and half, thirds, a third and two) so neighbouring tiles stay close in height.
        */}
        <div className="mt-10 grid gap-4 md:grid-cols-6">
          <FeatureCard
            className="md:col-span-4"
            icon={Layers}
            tone="action"
            title="One sale, everywhere"
            body="Every sale updates stock, the customer’s history, your margin and the reports at the same moment."
          >
            <SaleTrailMock />
          </FeatureCard>
          <FeatureCard
            className="md:col-span-2 md:row-span-2"
            icon={Sparkles}
            tone="reference"
            title="Ask DUMA"
            body="Ask about sales, stock, staff or customers in plain words. It answers from your own data."
            delay={60}
          >
            <AskMock />
          </FeatureCard>
          <FeatureCard
            className="md:col-span-2"
            icon={WifiOff}
            tone="stock"
            title="A till that works offline"
            body="When the connection drops, orders queue on the device and send themselves when it’s back."
          >
            <OfflineQueueMock />
          </FeatureCard>
          <FeatureCard
            className="md:col-span-2"
            icon={ChefHat}
            tone="orders"
            title="Kitchen screen"
            body="Every order lands in the kitchen: new, preparing, ready."
            delay={60}
          >
            <KitchenMock />
          </FeatureCard>

          <FeatureCard
            className="md:col-span-3"
            icon={CalendarDays}
            tone="team"
            title="Rotas and time"
            body="Your team sees the rota, clocks in and asks for leave on their phone, with staff cost next to sales."
            link={{ href: '/tools/rota-builder', label: 'Try the rota builder' }}
          >
            <RotaMock />
          </FeatureCard>
          <FeatureCard
            className="md:col-span-3"
            icon={Receipt}
            tone="reference"
            title="Recipes and margin"
            body="Cost each dish from its ingredients and see what you keep after VAT."
            link={{ href: '/tools/margin-calculator', label: 'Try the margin calculator' }}
            delay={60}
          >
            <MarginMock />
          </FeatureCard>

          <FeatureCard
            className="md:col-span-2"
            icon={Package}
            tone="stock"
            title="Stock"
            body="Every sale takes its share. Deliveries are checked in against the order."
          >
            <StockMock />
          </FeatureCard>
          <FeatureCard
            className="md:col-span-2"
            icon={Users}
            tone="orders"
            title="Customers and loyalty"
            body="Every visit builds a profile. Stamp cards and points reward the regulars."
            delay={60}
          >
            <CustomerMock />
          </FeatureCard>
          <FeatureCard
            className="md:col-span-2"
            icon={QrCode}
            tone="orders"
            title="QR ordering"
            body="Customers scan, order and pay from their own phone."
            delay={120}
          >
            <QrMock />
          </FeatureCard>

          <FeatureCard
            className="md:col-span-2"
            icon={Building2}
            tone="action"
            title="One location, or all of them"
            body="Report on one site or the whole business. Staff can be limited to where they work."
          >
            <LocationsMock />
          </FeatureCard>
          <FeatureCard
            className="md:col-span-4"
            icon={ShoppingBag}
            tone="reference"
            title="Keep your storefront"
            body="Stock in every size and colour, customers and a till for pop-ups, behind the online store you already have."
            delay={60}
          >
            <VariantStockMock />
          </FeatureCard>
        </div>
      </Section>

      {/* A chalk line between the product tiles and the reasons to trust it, drawn like the background curves. */}
      <div className="px-4 sm:px-6" aria-hidden="true">
        <ChalkDivider id="why-trust" className="mx-auto block w-full max-w-5xl" />
      </div>

      {/* ── Trust grid ────────────────────────────────────────────────────── */}
      <Section spacing="snug" aria-label="Why you can rely on DUMA">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={CreditCard}
            tone="orders"
            title="Free means free"
            body="The till, orders, payments, products, stock, customers and rotas stay free in full, for good. No card to sign up, no contract."
            link={{ href: linkTo('/pricing'), label: 'See pricing' }}
          />
          <div className="grid gap-4">
            <FeatureCard
              icon={MapPin}
              tone="reference"
              title="Hosted in the UK"
              body="Your business data lives on servers in Manchester, United Kingdom."
              delay={60}
            />
            <FeatureCard
              icon={Store}
              tone="orders"
              title="Switch on what you need"
              body="Start with the till or with one part. Add more without moving your data."
              delay={120}
            />
          </div>
          <div className="grid gap-4">
            <FeatureCard
              icon={Code}
              tone="action"
              title="Open, not walled in"
              body="A public API, an MCP server and webhooks let you use DUMA as the warehouse for your business data."
              delay={90}
            />
            <FeatureCard
              icon={Globe}
              tone="team"
              title="Your own storage"
              body="Keep your website media in your own Cloudflare R2 or Vercel Blob storage."
              delay={150}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <FeatureCard
            icon={LifeBuoy}
            tone="team"
            title="Free setup help"
            body="We help you bring in your menu or products, your team and your settings — on every plan. You talk to the person who builds DUMA."
          />
          <FeatureCard
            icon={Sparkles}
            tone="reference"
            title="You won’t need a course"
            body="Today’s sales, orders and the team on shift are on the first screen. You don’t build a report before you can read it."
            delay={80}
          />
        </div>
      </Section>

      {/* ── Setup band, with the mascot ───────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-28 text-center sm:px-6 sm:py-40" aria-labelledby="setup">
        <CornerStrokes />
        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="flex justify-center" aria-hidden="true">
            <ShapeShiftingMascot size={140} state="idle" expression="excite" gesture="celebrate" gestureKey="setup" follow />
          </div>
          <h2 id="setup" className="mt-6 text-balance text-3xl leading-[1.12] font-semibold tracking-display sm:text-4xl">
            Create a workspace. Take your first order today.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[1.0625rem] leading-relaxed text-[var(--mkt-ink-2)]">
            Tell DUMA what you sell and it switches on the parts that fit. Bring your menu or products across — we’ll help, for free.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <SignUpButton />
            <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
          </div>
          <p className="mt-5 text-sm text-[var(--mkt-ink-2)]">Free plan, forever. No card needed.</p>
        </div>
      </section>

      {/* ── Comparison ────────────────────────────────────────────────────── */}
      <Section spacing="normal" aria-labelledby="compare">
        <SectionHeading
          id="compare"
          align="center"
          title="Where DUMA wins, and where it doesn’t yet."
          intro={
            <p>
              Most small businesses run either a card-reader till app or a stack of separate apps for each job.
            </p>
          }
        />
        <div className="mt-12">
          <CompareTable
            caption="DUMA compared with a card-reader till app and with separate apps for each job"
            columns={[
              { key: 'duma', label: 'DUMA', icon: <Mascot size={32} state="idle" expression="neutre" />, highlight: true },
              { key: 'till', label: 'A card-reader till app', icon: <CreditCard className="size-6" aria-hidden="true" /> },
              { key: 'stack', label: 'Separate apps', icon: <Layers className="size-6" aria-hidden="true" /> },
            ]}
            groups={[{ rows: COMPARE.map((row) => ({ label: row.label, icon: row.icon, cells: { duma: row.duma, till: row.till, stack: row.stack } })) }]}
            footer={{ label: 'Best for', cells: BEST_FOR }}
          />
        </div>
      </Section>

      {/* ── Works with ────────────────────────────────────────────────────── */}
      <Section spacing="normal" aria-labelledby="works">
        <SectionHeading
          id="works"
          align="center"
          title="An EPOS that works with the tools you already use"
          intro={<p>Connect your card terminal, web analytics, storage and everyday tools, or build your own with the API.</p>}
        />
        <IntegrationMarquee className="mt-10" />
      </Section>

      {/* ── A letter from the founder ─────────────────────────────────────── */}
      <section className="px-4 py-20 sm:px-6 sm:py-28" aria-label="A letter from the founder">
        <div
          className="mx-auto max-w-3xl border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-8 py-12 sm:px-20 sm:py-14"
          data-reveal=""
        >
          <p className="font-semibold">Hello, and thanks for stopping by.</p>
          <div className="mt-5 flex flex-col gap-4 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">
            <p>
              We built <strong className="font-semibold text-foreground">DUMA</strong> so a small business doesn’t need one app for the
              till, another for the rota and a spreadsheet for stock.
            </p>
            <p>
              If you need a hand setting up, we’ll help you ourselves, for free. And if DUMA doesn’t do something you need yet, tell us —
              we add things on request.
            </p>
          </div>
          <p className="mkt-hand mt-8 text-4xl font-semibold text-foreground">
            Marian <span className="text-md">from DUMA</span>
          </p>
          <p className="mt-6 text-[var(--mkt-ink-2)]">
            P.S. DUMA is{' '}
            <Link href={linkTo('/pricing')} className="text-primary hover:underline">
              free to start
            </Link>
            .
          </p>
        </div>
      </section>

      <div className="relative overflow-hidden">
        <ChalkCurve side="right" id="faq-right" className="pointer-events-none absolute -top-24 -right-48 hidden w-[46rem] md:block" />
        <FaqSection items={FAQS} />
      </div>

      <ClosingCta
        title="Run your whole business from one place."
        aside={<RisingLines id="home-cta" />}
      />
    </>
  );
}

