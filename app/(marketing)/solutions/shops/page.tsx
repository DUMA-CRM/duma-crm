import type { Metadata } from 'next';

import { Mascot } from '@/components/ai/Mascot';
import { Check, ClipboardList, Code, CreditCard, Gift, Layers, LayoutDashboard, MapPin, Package, Receipt, Star, Store, Tag, Users, WifiOff } from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { CustomerMock, CustomersScreen, OfflineQueueMock, OrdersScreen, StorefrontApiMock, VariantStockMock } from '@/components/marketing/mocks';
import { ProductTabs } from '@/components/marketing/ProductTabs';
import { ReviewTicker } from '@/components/marketing/ReviewTicker';
import { Screenshot } from '@/components/marketing/Screenshot';
import { ClosingCta, FaqSection, FeatureCard, Mark, SecondaryButton, Section, SectionHeading, SignUpButton } from '@/components/marketing/sections';
import { ExplainerSection, MistakesSection, SetupBand, UseCasesSection } from '@/components/marketing/solution';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';

import { marketingMetadata } from '@/lib/marketing/metadata';
import { reviewsToShow } from '@/lib/marketing/reviews';
import { breadcrumbSchema, faqSchema, softwareApplicationSchema } from '@/lib/marketing/schema';
import { hasScreenshot } from '@/lib/marketing/screenshots.server';
import { SHOP_COMPARISON, SHOP_FAQS, SHOP_METRICS, SHOP_MISTAKES, SHOP_SETUP_STEPS, SHOP_USE_CASES } from '@/lib/marketing/shops';
import { linkTo } from '@/lib/marketing/site';

const DESCRIPTION =
  'Software for clothing shops and online stores: stock by size and colour, a till for the shop and pop-ups that works offline, customers, loyalty, promotions and a storefront API. Free plan, no card needed.';

export const metadata: Metadata = marketingMetadata({
  title: 'Inventory & POS for Clothing Shops and Online Stores, Free to Start | DUMA',
  description: DESCRIPTION,
  path: '/solutions/shops',
});

/** A screenshot inside the hero's tab frame: the frame already draws the edge. */
const FRAMELESS = 'rounded-none border-0 shadow-none';

const USE_CASE_ICONS = [Package, Store, Gift, Users];
const METRIC_ICONS = [Tag, MapPin, Star, Users, Gift, Receipt];
const COMPARISON_ICONS = [Layers, CreditCard];

/**
 * /solutions/shops — DUMA for clothing shops and online stores, after
 * seline.com/for-ecommerce, on the same blocks as /solutions/cafes. Online
 * selling is described exactly as it works today: the storefront API, no
 * hosted store yet, no Shopify connection (see lib/marketing/shops.ts).
 */
export default function ShopsPage() {
  return (
    <>
      <JsonLd data={softwareApplicationSchema({ description: DESCRIPTION })} />
      <JsonLd data={breadcrumbSchema([{ name: 'Shops and online stores', path: '/solutions/shops' }])} />
      <JsonLd data={faqSchema(SHOP_FAQS)} />

      {/* ── Hero ── */}
      <section className="relative -mt-16 overflow-hidden px-4 pt-30 pb-10 sm:px-6 sm:pt-40">
        <ChalkCurve side="left" id="shops-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="shops-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <h1 className="text-[2.6rem] leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-6xl">
            One stock for your shop <br className="hidden sm:inline" />
            <span className="mkt-mark mkt-mark-green rounded-md px-2">and your online store</span>
          </h1>
          <p className="mt-6 max-w-[44rem] text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">
            Stock by size and colour, a till for the shop and pop-ups, customers, loyalty and promotions — in one place, connected to your website.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <SignUpButton />
            <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
          </div>
          <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--mkt-ink-2)]">
            {['Free plan, forever', 'Sizes and colours', 'Till works offline'].map((fact) => (
              <span key={fact} className="flex items-center gap-1.5">
                <Check className="size-4 text-primary" aria-hidden="true" />
                {fact}
              </span>
            ))}
          </p>

          <div className="mt-16 sm:mt-20">
            <ProductTabs
              tabs={[
                { id: 'orders', label: 'Orders', icon: <ClipboardList />, panel: hasScreenshot('orders') ? <Screenshot shot="orders" preload className={FRAMELESS} /> : <OrdersScreen /> },
                { id: 'customers', label: 'Customers', icon: <Users />, panel: hasScreenshot('customers') ? <Screenshot shot="customers" className={FRAMELESS} /> : <CustomersScreen /> },
                { id: 'pos', label: 'POS', icon: <Receipt />, panel: <Screenshot shot="pos" className={FRAMELESS} /> },
                { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard />, panel: <Screenshot shot="dashboard" className={FRAMELESS} /> },
              ]}
            >
              <div className="absolute -top-10 right-48 left-1 hidden sm:block">
                <ReviewTicker reviews={reviewsToShow()} />
              </div>
              <div className="pointer-events-none absolute -top-20 right-10 hidden sm:block" aria-hidden="true">
                <Mascot size={120} state="idle" expression="attentif" gesture="wave" gestureKey="shops" follow />
              </div>
            </ProductTabs>
          </div>
        </div>
      </section>

      {/* ── Teaser: stock by size and colour ── */}
      <Section spacing="normal" aria-labelledby="variants">
        <div className="grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_24rem] md:gap-16">
          <div>
            <SectionHeading
              id="variants"
              title="Every size and colour, counted for you."
              intro={
                <p>
                  Each variant has its own stock, per location. A sale in the shop and an order from your website take from <Mark>the same count</Mark>, so the
                  website never sells the medium you sold this morning.
                </p>
              }
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <SignUpButton />
              <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
            </div>
          </div>
          <figure data-reveal="">
            <VariantStockMock bleed={false} />
            <figcaption className="mt-3 text-xs text-[var(--mkt-ink-2)]">An example product. Amber is running low; red is sold out.</figcaption>
          </figure>
        </div>
      </Section>

      <MistakesSection id="mistakes" title="Five things that quietly cost a shop money" items={SHOP_MISTAKES} />

      {/* ── How DUMA runs a shop ── */}
      <Section spacing="roomy" aria-labelledby="how">
        <SectionHeading
          id="how"
          title="How DUMA runs a shop"
          intro={
            <p>
              One workspace for the counter, the stock room and the website: <Mark>one stock and one customer list</Mark>, a till that sells anywhere, and the
              loyalty, promotions and email that bring people back.
            </p>
          }
        />
        <p className="mt-8 text-sm text-[var(--mkt-ink-2)]">
          * <span className="mkt-tag mx-1">free in full</span> means it stays free with no limits. The names and figures in these cards are examples.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FeatureCard icon={Tag} tone="stock" tag="free in full" title="Stock by size and colour" body="Every variant has its own count, per location. Low sizes are flagged; transfers move stock between shops.">
            <VariantStockMock />
          </FeatureCard>
          <FeatureCard icon={WifiOff} tone="stock" tag="free in full" title="A till for the shop and pop-ups" body="Sell on any tablet or phone, at the counter or a market. When the signal drops, orders queue and send themselves later." delay={80}>
            <OfflineQueueMock />
          </FeatureCard>
          <FeatureCard
            icon={Code}
            tone="reference"
            tag="for your website"
            title="Storefront API"
            body="Your site reads products, sizes, prices and stock from DUMA and sends its orders back — one stock, one customer list. A hosted DUMA storefront is planned."
          >
            <StorefrontApiMock />
          </FeatureCard>
          <FeatureCard icon={Users} tone="orders" tag="included" title="Customers and loyalty" body="Every order builds one profile. Points or stamps reward the regulars; promo codes and referrals bring new ones in." delay={80}>
            <CustomerMock />
          </FeatureCard>
        </div>
      </Section>

      <UseCasesSection
        id="uses"
        title="Four things shops do with DUMA every week"
        lead={[
          'Whether you sell clothing, gifts or homeware, in a shop, online or at markets, these are the jobs DUMA takes off your list.',
          'Start with the one you need most. The rest is already in the same workspace, with nothing to move when you’re ready.',
        ]}
        items={SHOP_USE_CASES}
        icons={USE_CASE_ICONS}
      />

      <ExplainerSection
        id="explainer"
        title="What shop software should do, and how to set it up"
        intro={
          <p>
            Shop software should keep the counter, the stock room and the website telling the same story. If the till and the site count stock separately, one of
            them is always wrong. If customers live in three places, nobody knows who your regulars are.
          </p>
        }
        setupTitle="How to set up DUMA in a shop"
        steps={SHOP_SETUP_STEPS}
        metricsTitle="Shop numbers worth watching"
        metrics={SHOP_METRICS}
        metricIcons={METRIC_ICONS}
        comparisonTitle="A hosted store, a till app,"
        comparisonHighlight="or one system"
        comparisonLead="Three ways most small shops run. Here is what each one covers."
        comparison={SHOP_COMPARISON}
        comparisonIcons={COMPARISON_ICONS}
      />

      <SetupBand id="shop-setup" title="Open your shop on DUMA." body="Bring your products, sizes and stock across — we’ll help you set it up, for free." />

      <FaqSection items={SHOP_FAQS} title="Questions shops ask" />

      <ClosingCta
        title="The one place to run your shop."
        muted="One simple bill, or none at all."
        body="Get started in minutes, completely free. No card required, and we’re here to help you every step of the way."
        aside={<RisingLines id="shops-cta" />}
      />
    </>
  );
}
