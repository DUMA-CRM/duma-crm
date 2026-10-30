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
  Search,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Users,
  WifiOff,
  X,
} from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { CustomerMock, CustomersScreen, KitchenMock, LocationsMock, MarginMock, OfflineQueueMock, OrdersScreen, QrMock, RotaMock, SaleTrailMock, StockMock } from '@/components/marketing/mocks';
import { ProductTabs } from '@/components/marketing/ProductTabs';
import { ReviewTicker } from '@/components/marketing/ReviewTicker';
import { ShapeShiftingMascot } from '@/components/marketing/ShapeShiftingMascot';
import { Screenshot } from '@/components/marketing/Screenshot';
import { Annotation, COLUMN, FaqSection, FeatureCard, ClosingCta, Mark, SecondaryButton, Section, SectionHeading, SignUpButton } from '@/components/marketing/sections';
import { ChalkCurve, CornerStrokes, RisingLines } from '@/components/marketing/Strokes';

import { COMING_SOON, FAQS } from '@/lib/marketing/home';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { INTEGRATION_LOGOS } from '@/lib/marketing/integration-logos';
import { reviewsToShow } from '@/lib/marketing/reviews';
import { hasScreenshot } from '@/lib/marketing/screenshots.server';
import { faqSchema, softwareApplicationSchema } from '@/lib/marketing/schema';
import { linkTo } from '@/lib/marketing/site';
import { cn } from '@/lib/utils/cn';

const DESCRIPTION =
  'DUMA runs your whole business from one place, on one bill: till, orders, stock, rotas, customers, marketing and reports. Free plan, no card needed. For cafés, food businesses and small shops in store or online.';

// Title and H1 say the same thing in different words — Google builds the
// title link from both, and a slogan in either would waste the page's
// strongest signal.
export const metadata: Metadata = marketingMetadata({
  title: 'Free All-in-One Business Software for Cafés and Shops | DUMA',
  description: DESCRIPTION,
  path: '/',
});

/** A screenshot inside the hero's tab frame: the frame already draws the edge. */
const FRAMELESS = 'rounded-none border-0 shadow-none';

const ASK_PROMPTS = ['What sold best yesterday?', 'Which items are running low?', 'How did this week compare with last?', 'Who are my regulars?', 'What did staff cost today?', 'Which dish makes the least?'];

type Cell = { mark: 'yes' | 'part' | 'no'; note?: string };
type Row = { label: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>; duma: Cell; till: Cell; stack: Cell };

/**
 * DUMA against the two things a small business usually runs instead. The other
 * two columns are categories, not named products, so every note is a fair
 * generalisation — and the rows DUMA loses stay in.
 */
const COMPARE: Row[] = [
  { label: 'Till and card payments', icon: Receipt, duma: { mark: 'yes', note: 'Any card machine' }, till: { mark: 'yes' }, stack: { mark: 'yes', note: 'One of the apps' } },
  { label: 'Keeps selling offline', icon: WifiOff, duma: { mark: 'yes' }, till: { mark: 'part', note: 'Varies by app' }, stack: { mark: 'part', note: 'Varies by app' } },
  { label: 'Stock and recipe margin', icon: Package, duma: { mark: 'yes', note: 'VAT-aware' }, till: { mark: 'part', note: 'Often an add-on' }, stack: { mark: 'part', note: 'Another app' } },
  { label: 'Rotas and clock-ins', icon: Clock, duma: { mark: 'yes' }, till: { mark: 'no' }, stack: { mark: 'part', note: 'Another app' } },
  { label: 'Loyalty and email', icon: Gift, duma: { mark: 'yes' }, till: { mark: 'part', note: 'Often an add-on' }, stack: { mark: 'part', note: 'Two more apps' } },
  { label: 'Table bookings', icon: CalendarDays, duma: { mark: 'yes', note: 'Floor plan and waitlist' }, till: { mark: 'no' }, stack: { mark: 'part', note: 'Another app' } },
  { label: 'One customer record', icon: Users, duma: { mark: 'yes' }, till: { mark: 'part', note: 'Payments only' }, stack: { mark: 'no', note: 'Copied between apps' } },
  { label: 'API and MCP', icon: Code, duma: { mark: 'yes' }, till: { mark: 'part', note: 'Varies' }, stack: { mark: 'part', note: 'One per app' } },
  { label: 'Free setup help', icon: LifeBuoy, duma: { mark: 'yes', note: 'From the person who builds it' }, till: { mark: 'part', note: 'Varies' }, stack: { mark: 'no' } },
  { label: 'A hosted online store', icon: ShoppingBag, duma: { mark: 'no', note: 'Planned' }, till: { mark: 'part', note: 'Some offer one' }, stack: { mark: 'yes', note: 'If you pay for one' } },
  { label: 'Receipt printer and cash drawer', icon: Printer, duma: { mark: 'part', note: 'Browser printing; more soon' }, till: { mark: 'yes' }, stack: { mark: 'yes' } },
  { label: 'Card machines beyond Square and SumUp', icon: CreditCard, duma: { mark: 'part', note: 'Amount keyed in by hand' }, till: { mark: 'yes', note: 'Their own' }, stack: { mark: 'yes' } },
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
          {/* Two lines from sm up, broken after "to run"; phones wrap it naturally. */}
          <h1 className="text-[2.75rem] leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-6xl">
            The <span className="mkt-mark mkt-mark-green rounded-md px-2">one place</span> to run <br className="hidden sm:inline" />
            your whole business
          </h1>
          {/* Wide enough to sit on two balanced lines from sm up. */}
          <p className="mt-6 max-w-[44rem] text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">
            Everything you need to run your business, from sales and stock to staff and customers. All on your existing tablet, with the card reader you already use.
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
                { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard />, panel: <Screenshot shot="dashboard" preload className={FRAMELESS} /> },
                { id: 'pos', label: 'POS', icon: <Receipt />, panel: <Screenshot shot="pos" className={FRAMELESS} /> },
                // Drawn stand-ins until orders.png / customers.png are dropped into public/marketing/screenshots.
                { id: 'orders', label: 'Orders', icon: <ClipboardList />, panel: hasScreenshot('orders') ? <Screenshot shot="orders" className={FRAMELESS} /> : <OrdersScreen /> },
                { id: 'customers', label: 'Customers', icon: <Users />, panel: hasScreenshot('customers') ? <Screenshot shot="customers" className={FRAMELESS} /> : <CustomersScreen /> },
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
                  When the Wi-Fi drops mid-rush, <Mark>the till keeps taking orders.</Mark> They’re saved on the device and sent when it’s back — and a sale that can’t be
                  sent is kept for you to check, never thrown away.
                </>
              ),
            },
            {
              icon: <Layers className="size-5" aria-hidden="true" />,
              who: 'One system',
              line: 'Every part shares one set of data',
              body: (
                <>
                  A sale moves your stock, your customer’s history, your margin and your reports at the same moment, so <Mark>nobody types anything twice.</Mark>
                </>
              ),
            },
          ].map((item, index) => (
            <figure key={item.who} data-reveal="" data-reveal-delay={index * 100}>
              <blockquote className="text-pretty text-lg leading-relaxed text-[var(--mkt-ink-2)]">{item.body}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-[var(--mkt-card)] text-primary ring-1 ring-[var(--mkt-line)]">{item.icon}</span>
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
        <SectionHeading id="why-title" title="Why DUMA?" muted="Let’s walk through a day." />
        <div className="mt-6 grid gap-6 text-pretty text-[1.0625rem] leading-relaxed text-[var(--mkt-ink-2)] md:grid-cols-2 md:gap-10" data-reveal="">
          <p>
            Running a café, bakery or small restaurant? The till, the kitchen screen, recipes and margin, stock, rotas and loyalty live in one workspace, so the
            numbers at close agree with each other.
          </p>
          <p>
            Selling products in a shop or online? Keep your storefront and its checkout. DUMA becomes the one place for stock in every size and colour, customers,
            loyalty, email and a till for in-person sales. <Mark>Start with one part, add the rest when you’re ready.</Mark>
          </p>
        </div>
        <p className="mt-8 text-sm text-[var(--mkt-ink-2)]">
          * <span className="mkt-tag mx-1">free in full</span> means it stays free with no limits.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FeatureCard icon={WifiOff} tone="stock" tag="free in full" title="A till that works offline" body="Sell on any tablet, phone or computer. When the connection drops, orders queue on the device and send themselves when it’s back." link={{ href: linkTo('/solutions/cafes'), label: 'See DUMA for cafés' }}>
            <OfflineQueueMock />
          </FeatureCard>
          <FeatureCard icon={Layers} tone="action" tag="free in full" title="One sale, everywhere" body="Every sale updates stock, the customer’s history, your margin and the reports at the same moment — nothing copied between apps." delay={80}>
            <SaleTrailMock />
          </FeatureCard>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <FeatureCard icon={Sparkles} tone="reference" tag="included" title="Ask DUMA" body="An assistant that knows your business and answers from your own data — sales, stock, staff and customers. Ask it in plain words.">
            <div className="mx-4 mb-4 rounded-lg border border-[var(--mkt-line)] sm:mx-6">
              <div className="flex items-center justify-between border-b border-[var(--mkt-line)] px-3 py-2 text-[12px] text-[var(--mkt-ink-3)]">
                <span>Ask DUMA</span>
                <span>New chat</span>
              </div>
              <div className="flex flex-col items-center gap-4 px-4 py-5">
                <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] text-primary">
                  {ASK_PROMPTS.map((prompt) => (
                    <li key={prompt}>{prompt}</li>
                  ))}
                </ul>
                <Mascot size={44} state="idle" expression="curieux" label="Ask DUMA" />
              </div>
              <div className="flex items-center gap-2 border-t border-[var(--mkt-line)] px-3 py-2.5 text-[13px] text-[var(--mkt-ink-3)]">
                <Search className="size-4" aria-hidden="true" />
                Ask DUMA anything<span className="mkt-caret">|</span>
              </div>
            </div>
          </FeatureCard>
          <div className="grid gap-4">
            <FeatureCard icon={ChefHat} tone="orders" tag="included" title="Kitchen screen" body="Every order lands on a screen in the kitchen: new, preparing, ready." delay={80}>
              <KitchenMock />
            </FeatureCard>
          </div>
        </div>

        <div className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="pt-6 md:pt-10" data-reveal="">
            <p className="text-pretty text-lg leading-relaxed text-[var(--mkt-ink-2)]">
              No new hardware. DUMA runs in the browser and installs like an app, and <Mark>your card machine keeps working</Mark> — Square and SumUp connect directly, any other works with the amount keyed in, all with the rates you
              already have.
            </p>
            <p className="mt-5 flex items-center gap-3 text-sm text-[var(--mkt-ink-3)]">
              <Smartphone className="size-5" aria-hidden="true" /> Any tablet, phone or computer
            </p>
          </div>
          <FeatureCard icon={QrCode} tone="orders" tag="included" title="QR ordering" body="Customers scan, order and pay from their own phone." tilt={2} delay={80}>
            <QrMock />
          </FeatureCard>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <FeatureCard icon={Receipt} tone="reference" tag="free in full" title="Recipes and margin" body="Cost each dish from its ingredients. DUMA takes VAT out if you’re registered and shows what you really keep." link={{ href: linkTo('/solutions/cafes'), label: 'How the margin is worked out' }}>
            <MarginMock />
          </FeatureCard>
          <FeatureCard icon={CalendarDays} tone="team" tag="free in full" title="Rotas and time" body="Your team sees the rota on their phone, clocks in there and asks for leave there — with staff cost next to sales." delay={80}>
            <RotaMock />
          </FeatureCard>
        </div>
        <Annotation className="mt-4 ml-[20%]">our favourite part, for cafés</Annotation>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <FeatureCard icon={Users} tone="orders" tag="included" title="Customers and loyalty" body="Every visit builds the customer’s profile. Stamp cards and points reward the regulars; email reaches only those who opted in.">
            <CustomerMock />
          </FeatureCard>
          <FeatureCard icon={Package} tone="stock" tag="free in full" title="Stock" body="Know what’s on hand before you run out. Every sale takes its share; deliveries are checked in against the order." delay={80}>
            <StockMock />
          </FeatureCard>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div id="shops" className="scroll-mt-24">
            <FeatureCard
              icon={ShoppingBag}
              tone="reference"
              tag="for shops"
              title="Keep your storefront. Replace the apps around it."
              body="Stock in every size and colour, one customer list, loyalty, promotions, email, forms and a till for pop-ups — behind the online store you already have. A hosted DUMA storefront is planned."
              className="h-full"
            />
          </div>
          <FeatureCard icon={Building2} tone="action" tag="included" title="One location, or all of them" body="Every report for one site or the whole business. Staff can be limited to the location they work at." delay={80}>
            <LocationsMock />
          </FeatureCard>
        </div>
      </Section>

      {/* ── Trust grid ────────────────────────────────────────────────────── */}
      <Section spacing="snug" aria-label="Why you can rely on DUMA">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard icon={LifeBuoy} tone="team" title="Free setup help" body="We help you bring in your menu or products, your team and your settings — on every plan. You talk to the person who builds DUMA.">
            <div className="flex justify-center px-6 pb-6">
              <div className="mkt-mock w-56 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  Marian Dudych <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                </p>
                <p className="text-[12px] text-[var(--mkt-ink-2)]">Builds and supports DUMA</p>
              </div>
            </div>
          </FeatureCard>
          <div className="grid gap-4">
            <FeatureCard icon={MapPin} tone="reference" title="Hosted in the UK" body="Your business data lives on servers in Manchester, United Kingdom." delay={60} />
            <FeatureCard icon={Store} tone="orders" title="Switch on what you need" body="Start with the till or with one part. Add more without moving your data." delay={120} />
          </div>
          <div className="grid gap-4">
            <FeatureCard icon={Code} tone="action" title="Open, not walled in" body="A public API, an MCP server and webhooks let you use DUMA as the warehouse for your business data." delay={90} />
            <FeatureCard icon={Globe} tone="team" title="Your own storage" body="Keep your website media in your own Cloudflare R2 or Vercel Blob storage." delay={150} />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <FeatureCard icon={CreditCard} tone="orders" title="Free means free" body="The till, orders, payments, products, stock, customers and rotas stay free in full, for good. No card to sign up, no contract." link={{ href: linkTo('/pricing'), label: 'See pricing' }} />
          <FeatureCard icon={Sparkles} tone="reference" title="You won’t need a course" body="Today’s sales, orders and the team on shift are on the first screen. You don’t build a report before you can read it." delay={80}>
            <div className="relative h-36 px-6">
              <div className="mkt-mock absolute top-4 left-6 w-52 -rotate-2 p-3 text-[12px] sm:left-10">
                <p className="flex items-center justify-between font-semibold">
                  Five separate apps <X className="size-3.5 text-[var(--mkt-ink-3)]" aria-hidden="true" />
                </p>
                <p className="mt-1 text-[var(--mkt-ink-2)]">Five logins, five places to look, numbers that never quite agree.</p>
              </div>
              <div className="mkt-mock absolute top-8 right-6 w-52 rotate-1 p-3 text-[12px] sm:right-10">
                <p className="flex items-center justify-between font-semibold">
                  DUMA <Check className="size-3.5 text-primary" aria-hidden="true" />
                </p>
                <p className="mt-1 text-[var(--mkt-ink-2)]">One place. You read it yourself, the day you start.</p>
              </div>
            </div>
          </FeatureCard>
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
              Most small businesses run either a card-reader till app or a stack of separate apps for each job. Here is how DUMA compares with both —{' '}
              <Mark>including the rows we lose.</Mark>
            </p>
          }
        />
        <div className="mt-12 overflow-x-auto" data-reveal="">
          <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-[0.9375rem]">
            <caption className="sr-only">DUMA compared with a card-reader till app and with separate apps for each job</caption>
            <thead>
              <tr>
                <th scope="col" className="w-[34%] p-3 text-left font-normal">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="w-[22%] rounded-t-lg border-x-2 border-t-2 border-primary/60 bg-[var(--mkt-marker)]/40 px-3 pt-5 pb-3 font-semibold">
                  <span className="flex flex-col items-center gap-1.5">
                    <Mascot size={32} state="idle" expression="neutre" />
                    DUMA
                  </span>
                </th>
                <th scope="col" className="w-[22%] px-3 pt-5 pb-3 font-semibold">
                  <span className="flex flex-col items-center gap-1.5">
                    <CreditCard className="size-6 text-[var(--mkt-ink-3)]" aria-hidden="true" />A card-reader till app
                  </span>
                </th>
                <th scope="col" className="w-[22%] px-3 pt-5 pb-3 font-semibold">
                  <span className="flex flex-col items-center gap-1.5">
                    <Layers className="size-6 text-[var(--mkt-ink-3)]" aria-hidden="true" />
                    Separate apps
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="border-t border-[var(--mkt-line)] p-4 text-left font-normal text-[var(--mkt-ink-2)]">
                    <span className="flex items-center gap-3">
                      <row.icon className="size-[1.125rem] shrink-0 text-[var(--mkt-ink-3)]" aria-hidden="true" />
                      {row.label}
                    </span>
                  </th>
                  <CompareCell cell={row.duma} highlight />
                  <CompareCell cell={row.till} />
                  <CompareCell cell={row.stack} />
                </tr>
              ))}
              <tr>
                <th scope="row" className="border-t border-[var(--mkt-line)] p-4 text-left font-semibold">
                  Best for
                </th>
                <td className="rounded-b-lg border-x-2 border-t border-b-2 border-x-primary/60 border-t-[var(--mkt-line)] border-b-primary/60 bg-[var(--mkt-marker)]/40 p-4 text-center text-sm font-medium">{BEST_FOR.duma}</td>
                <td className="border-t border-[var(--mkt-line)] p-4 text-center text-sm text-[var(--mkt-ink-2)]">{BEST_FOR.till}</td>
                <td className="border-t border-[var(--mkt-line)] p-4 text-center text-sm text-[var(--mkt-ink-2)]">{BEST_FOR.stack}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[var(--mkt-ink-2)]">
          <span className="flex items-center gap-1.5">
            <CompareIcon mark="yes" /> Included
          </span>
          <span className="flex items-center gap-1.5">
            <CompareIcon mark="part" /> Partly, or it depends
          </span>
          <span className="flex items-center gap-1.5">
            <CompareIcon mark="no" /> Not available
          </span>
        </p>
      </Section>

      {/* ── Works with ────────────────────────────────────────────────────── */}
      <Section spacing="normal" aria-labelledby="works">
        <SectionHeading
          id="works"
          align="center"
          title="Works with the tools you already use"
          intro={<p>Connect your card terminal, web analytics, storage and everyday tools — or build your own with the API.</p>}
        />
        {/* Two centred rows of four from sm up: a zero-height, full-width break after the fourth chip. */}
        <ul className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-3" data-reveal="">
          {INTEGRATION_LOGOS.map((logo, index) => [
            <li
              key={logo.name}
              className="flex items-center gap-2.5 rounded-[10px] px-5 py-3 text-lg font-semibold tracking-display text-white shadow-[0_2px_4px_rgb(0_0_0/0.08),0_10px_24px_-10px_rgb(0_0_0/0.35)] transition-[rotate,translate,box-shadow] duration-300 ease-out [rotate:var(--tilt)] hover:-translate-y-1 hover:shadow-[0_4px_8px_rgb(0_0_0/0.1),0_16px_32px_-12px_rgb(0_0_0/0.4)] hover:[rotate:0deg]"
              style={{ background: logo.background, '--tilt': `${[-4, 3, -2, 5, -3, 2, -5, 3][index % 8]}deg` } as React.CSSProperties}
            >
              {logo.path && (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5 shrink-0">
                  <path d={logo.path} />
                </svg>
              )}
              {logo.name}
            </li>,
            index === 3 && <li key="row-break" aria-hidden="true" className="hidden h-0 basis-full sm:block" />,
          ])}
        </ul>
        <p className="mt-10 text-center text-sm text-[var(--mkt-ink-2)]">
          Coming soon: {COMING_SOON.join(', ').toLowerCase()}. Using something else? <Mark>Tell us — we add integrations on request.</Mark>
        </p>
      </Section>

      {/* ── A letter from the founder ─────────────────────────────────────── */}
      <section className="px-4 py-20 sm:px-6 sm:py-28" aria-label="A letter from the founder">
        <div className="mx-auto max-w-3xl bg-[var(--mkt-card)] px-8 py-12 shadow-[0_20px_50px_-24px_rgb(32_55_45/0.3)] sm:px-20 sm:py-14" data-reveal="">
          <p className="font-semibold">Hello, and thanks for stopping by.</p>
          <div className="mt-5 flex flex-col gap-4 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">
            <p>
              Running a small business shouldn’t mean juggling a dozen different apps. One for your till, another for staff rotas, spreadsheets for stock, and a
              separate bill for each.
            </p>
            <p>
              That’s why we built <strong className="font-semibold text-foreground">DUMA</strong>.
            </p>
            <p>
              One place to manage your entire business — from your till and kitchen to stock, staff, customers, and the numbers that matter. Everything connected,
              with one simple bill, or no bill at all.
            </p>
            <p>DUMA works on the devices you already own, alongside your existing card reader. And even when the internet goes down, your business keeps running.</p>
            <p>
              <strong className="font-semibold text-foreground">We’re here to help you get started.</strong> If you need a hand setting things up, just reach out.
              We’ll help you personally, completely free.
            </p>
            <p>
              And if there’s something DUMA doesn’t do yet, we’d love to hear about it. We’re building DUMA around the real needs of businesses like yours, and your
              feedback helps shape what comes next.
            </p>
            <p>Thanks for being part of the journey.</p>
          </div>
          <p className="mt-8 text-[var(--mkt-ink-2)]">Warmly,</p>
          <p className="mkt-hand mt-1 text-4xl font-semibold text-foreground">Marian <span className="text-md">from DUMA</span></p>
          <p className="mt-6 text-[var(--mkt-ink-2)]">
            P.S. DUMA is{' '}
            <Link href={linkTo('/pricing')} className="text-primary hover:underline">
              free to start
            </Link>
            , and our founding members get <strong className="font-semibold text-foreground">10% off Business for life.</strong>
          </p>
        </div>
      </section>

      <div className="relative overflow-hidden">
        <ChalkCurve side="right" id="faq-right" className="pointer-events-none absolute -top-24 -right-48 hidden w-[46rem] md:block" />
        <FaqSection items={FAQS} />
      </div>

      <ClosingCta
        title="Run your whole business from one place."
        muted="One simple bill, or none at all."
        body="Get started in minutes, completely free. No credit card required, and we're here to help you every step of the way."
        aside={
          <RisingLines id="home-cta" />
        }
      />
    </>
  );
}

/** One mark per verdict: a filled 22px disc with a bold glyph, so all three read at the same weight. */
function CompareIcon({ mark }: { mark: Cell['mark'] }) {
  const disc = { yes: 'fill-primary', part: 'fill-stock/15', no: 'fill-[var(--mkt-line)]' }[mark];
  const glyph = { yes: 'stroke-primary-foreground', part: 'stroke-stock', no: 'stroke-[var(--mkt-ink-3)]' }[mark];
  return (
    <svg viewBox="0 0 22 22" className="size-[22px] shrink-0" aria-hidden="true">
      <circle cx="11" cy="11" r="11" className={disc} />
      <path
        d={mark === 'yes' ? 'M6.5 11.3l3 3 6-6.3' : mark === 'part' ? 'M7 11h8' : 'M7.8 7.8l6.4 6.4M14.2 7.8l-6.4 6.4'}
        className={glyph}
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const MARK_LABEL = { yes: 'Included', part: 'Partly', no: 'Not available' } as const;

function CompareCell({ cell, highlight = false }: { cell: Cell; highlight?: boolean }) {
  return (
    <td className={cn('border-t border-[var(--mkt-line)] px-3 py-3 text-center', highlight && 'border-x-2 border-x-primary/60 bg-[var(--mkt-marker)]/40')}>
      <span className="flex flex-col items-center gap-1">
        <CompareIcon mark={cell.mark} />
        <span className="sr-only">{MARK_LABEL[cell.mark]}</span>
        {cell.note && <span className={cn('text-[12px]', highlight ? 'font-medium text-[var(--mkt-marker-ink)]' : 'text-[var(--mkt-ink-3)]')}>{cell.note}</span>}
      </span>
    </td>
  );
}
