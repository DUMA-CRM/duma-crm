import type { Metadata } from 'next';

import { Mascot } from '@/components/ai/Mascot';
import { BarChart3, CalendarDays, Check, ChefHat, ClipboardList, CreditCard, Gift, Layers, LayoutDashboard, LineChart, Package, QrCode, Receipt, Star, Trash2, Users, WifiOff } from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { CustomerMock, CustomersScreen, KitchenMock, MarginMock, OfflineQueueMock, OrdersScreen, QrMock, RotaMock, StockMock } from '@/components/marketing/mocks';
import { ProductTabs } from '@/components/marketing/ProductTabs';
import { ReviewTicker } from '@/components/marketing/ReviewTicker';
import { Screenshot } from '@/components/marketing/Screenshot';
import { ClosingCta, FaqSection, FeatureCard, Mark, SecondaryButton, Section, SectionHeading, SignUpButton } from '@/components/marketing/sections';
import { ExplainerSection, MistakesSection, SetupBand, UseCasesSection } from '@/components/marketing/solution';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';

import { CAFE_COMPARISON, CAFE_FAQS, CAFE_METRICS, CAFE_MISTAKES, CAFE_SETUP_STEPS, CAFE_USE_CASES } from '@/lib/marketing/cafes';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { reviewsToShow } from '@/lib/marketing/reviews';
import { breadcrumbSchema, faqSchema, softwareApplicationSchema } from '@/lib/marketing/schema';
import { hasScreenshot } from '@/lib/marketing/screenshots.server';
import { linkTo } from '@/lib/marketing/site';

const DESCRIPTION =
  'All-in-one café and restaurant software: a till that works offline, QR ordering, a kitchen screen, recipe costing and margin, stock, rotas and loyalty. Keep your card machine. Free plan, no card needed.';

export const metadata: Metadata = marketingMetadata({
  title: 'Café & Restaurant POS and All-in-One Software, Free to Start | DUMA',
  description: DESCRIPTION,
  path: '/solutions/cafes',
});

/** A screenshot inside the hero's tab frame: the frame already draws the edge. */
const FRAMELESS = 'rounded-none border-0 shadow-none';

const USE_CASE_ICONS = [Receipt, CalendarDays, Package, Gift];

/** One per CAFE_METRICS entry, in order: margin, takings vs typical day, staff cost, top sellers, waste, average order. */
const METRIC_ICONS = [BarChart3, LineChart, Users, Star, Trash2, Receipt];

/** Card-reader app, separate apps — DUMA's own entry shows the logo instead. */
const COMPARISON_ICONS = [CreditCard, Layers];

/**
 * /solutions/cafes — DUMA for cafés and restaurants, after seline.com/for-ecommerce:
 * the hero with product tabs, a margin teaser, the five costly habits, tagged
 * feature cards, four weekly use cases, an explainer (setup in three steps,
 * numbers worth watching, three ways to run a café), a CTA band, the FAQ and a
 * closing card. Every claim follows lib/marketing/cafes.ts; data in the mocks
 * is an example and is labelled as one.
 */
export default function CafesPage() {
  return (
    <>
      <JsonLd data={softwareApplicationSchema({ description: DESCRIPTION })} />
      <JsonLd data={breadcrumbSchema([{ name: 'Cafés and restaurants', path: '/solutions/cafes' }])} />
      <JsonLd data={faqSchema(CAFE_FAQS)} />

      {/* ── Hero ── */}
      <section className="relative -mt-16 overflow-hidden px-4 pt-30 pb-10 sm:px-6 sm:pt-40">
        <ChalkCurve side="left" id="cafes-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="cafes-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <h1 className="text-[2.6rem] leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-6xl">
            Café and restaurant software <br className="hidden sm:inline" />
            that runs <span className="mkt-mark mkt-mark-green rounded-md px-2">the whole day</span>
          </h1>
          <p className="mt-6 max-w-[44rem] text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">
            The till, kitchen screen, QR ordering, recipes and margin, stock, rotas and loyalty — in one place, on the tablet and card machine you already have.
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

          <div className="mt-16 sm:mt-20">
            <ProductTabs
              tabs={[
                { id: 'pos', label: 'POS', icon: <Receipt />, panel: <Screenshot shot="pos" preload className={FRAMELESS} /> },
                { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard />, panel: <Screenshot shot="dashboard" className={FRAMELESS} /> },
                { id: 'orders', label: 'Orders', icon: <ClipboardList />, panel: hasScreenshot('orders') ? <Screenshot shot="orders" className={FRAMELESS} /> : <OrdersScreen /> },
                { id: 'customers', label: 'Customers', icon: <Users />, panel: hasScreenshot('customers') ? <Screenshot shot="customers" className={FRAMELESS} /> : <CustomersScreen /> },
              ]}
            >
              <div className="absolute -top-10 right-48 left-1 hidden sm:block">
                <ReviewTicker reviews={reviewsToShow()} />
              </div>
              <div className="pointer-events-none absolute -top-20 right-10 hidden sm:block" aria-hidden="true">
                <Mascot size={120} state="idle" expression="attentif" gesture="wave" gestureKey="cafes" follow />
              </div>
            </ProductTabs>
          </div>
        </div>
      </section>

      {/* ── Teaser: margin ── */}
      <Section spacing="normal" aria-labelledby="margin">
        <div className="grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_24rem] md:gap-16">
          <div>
            <SectionHeading
              id="margin"
              title="Know what every dish makes you."
              intro={
                <p>
                  Add a recipe once. DUMA costs it from your ingredients, takes VAT out of the price if you’re registered, and shows the margin you{' '}
                  <Mark>really keep</Mark> — on the menu, in the reports and on every sale.
                </p>
              }
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <SignUpButton />
              <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
            </div>
          </div>
          <figure data-reveal="">
            <MarginMock bleed={false} />
            <figcaption className="mt-3 text-xs text-[var(--mkt-ink-2)]">An example recipe for a VAT-registered café, worked out by DUMA’s own costing.</figcaption>
          </figure>
        </div>
      </Section>

      <MistakesSection id="mistakes" title="Five things that quietly cost a café money" items={CAFE_MISTAKES} />

      {/* ── How DUMA runs a café: tagged feature cards ── */}
      <Section spacing="roomy" aria-labelledby="how">
        <SectionHeading
          id="how"
          title="How DUMA runs a café"
          intro={
            <p>
              One workspace for the counter, the kitchen and the back office: a <Mark>till that never stops</Mark>, a screen for the kitchen, recipes with real
              margin, stock that counts itself down, rotas on your team’s phones and a reason for regulars to come back.
            </p>
          }
        />
        <p className="mt-8 text-sm text-[var(--mkt-ink-2)]">
          * <span className="mkt-tag mx-1">free in full</span> means it stays free with no limits. The names and figures in these cards are examples.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FeatureCard icon={WifiOff} tone="stock" tag="free in full" title="A till that works offline" body="Sell on any tablet or phone. When the Wi-Fi drops, orders queue on the device and send themselves when it’s back.">
            <OfflineQueueMock />
          </FeatureCard>
          <FeatureCard icon={ChefHat} tone="orders" tag="included" title="Kitchen screen" body="Every order lands on a screen in the kitchen — new, preparing, ready — whether it came from the till or a QR code." delay={80}>
            <KitchenMock />
          </FeatureCard>
          <FeatureCard icon={BarChart3} tone="reference" tag="free in full" title="Recipes and margin" body="Cost each dish from its ingredients and see what you keep after VAT, on the menu and in the reports.">
            <MarginMock />
          </FeatureCard>
          <FeatureCard icon={CalendarDays} tone="team" tag="free in full" title="Rotas and time" body="Your team sees the rota on their phone, clocks in there and asks for leave there — with staff cost next to sales." delay={80}>
            <RotaMock />
          </FeatureCard>
          <FeatureCard icon={Package} tone="stock" tag="free in full" title="Stock" body="Every sale takes its share off what’s on hand. Low items are flagged; deliveries are checked in against the order.">
            <StockMock />
          </FeatureCard>
          <FeatureCard icon={QrCode} tone="orders" tag="included" title="QR ordering" body="Customers scan, order and pay from their own phone, and the order goes straight to the kitchen screen." delay={80}>
            <QrMock />
          </FeatureCard>
        </div>
        <div className="mt-4">
          <FeatureCard icon={Users} tone="orders" tag="included" title="Customers and loyalty" body="Every visit builds the customer’s profile. Stamp cards and points reward the regulars; email reaches only those who opted in.">
            <CustomerMock />
          </FeatureCard>
        </div>
      </Section>

      <UseCasesSection
        id="uses"
        title="Four things cafés do with DUMA every week"
        lead={[
          'Whether you run a coffee shop, a bakery, a restaurant or a food truck, these are the jobs DUMA takes off your evenings.',
          'Start with the one you need most. The rest is already in the same workspace, with nothing to move when you’re ready.',
        ]}
        items={CAFE_USE_CASES}
        icons={USE_CASE_ICONS}
      />

      <ExplainerSection
        id="explainer"
        title="What café software should do, and how to set it up"
        intro={
          <p>
            Café software should connect what happens at the counter to what happens in the kitchen, the stockroom and the bank. If you only look at the till, you
            can’t see the margin. If you only look at the margin, you can’t see the rota eating it.
          </p>
        }
        setupTitle="How to set up DUMA in a café"
        steps={CAFE_SETUP_STEPS}
        metricsTitle="Café numbers worth watching"
        metrics={CAFE_METRICS}
        metricIcons={METRIC_ICONS}
        comparisonTitle="A card-reader app, separate apps,"
        comparisonHighlight="or one system"
        comparisonLead="Three ways most cafés run. Here is what each one covers."
        comparison={CAFE_COMPARISON}
        comparisonIcons={COMPARISON_ICONS}
      />

      <SetupBand id="cafe-setup" title="Open tomorrow on DUMA." body="Tell DUMA what you run and bring your menu across — we’ll help you set it up, for free." />

      <FaqSection items={CAFE_FAQS} title="Questions cafés ask" />

      <ClosingCta
        title="The one place to run your café."
        muted="One simple bill, or none at all."
        body="Get started in minutes, completely free. No card required, and we’re here to help you every step of the way."
        aside={<RisingLines id="cafes-cta" />}
      />
    </>
  );
}

