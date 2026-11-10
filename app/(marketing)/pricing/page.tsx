import type { Metadata } from 'next';

import { Mascot } from '@/components/ai/Mascot';
import { Check, Gift, LifeBuoy } from '@/components/icons';
import { BusinessPlanCard, PlanPrice } from '@/components/marketing/BusinessPlanCard';
import { type CompareCell, CompareTable } from '@/components/marketing/CompareTable';
import { IntegrationMarquee } from '@/components/marketing/IntegrationMarquee';
import { JsonLd } from '@/components/marketing/JsonLd';
import { FaqSection, SignUpButton } from '@/components/marketing/sections';
import { ChalkCurve } from '@/components/marketing/Strokes';

import { marketingMetadata } from '@/lib/marketing/metadata';
import { BUSINESS, FREE_FEATURES, PLAN_COMPARISON, PRICING_FAQS, SETUP_HELP, formatPounds, type PlanCell } from '@/lib/marketing/pricing';
import { breadcrumbSchema, faqSchema, softwareApplicationSchema } from '@/lib/marketing/schema';

const DESCRIPTION =
  'A free plan forever, no card needed: till, orders, stock, customers and rotas. Business is £49 a month, coming soon. Free setup help on every plan.';

export const metadata: Metadata = marketingMetadata({
  title: 'Pricing: Free EPOS and Business Software, UK | DUMA',
  description: DESCRIPTION,
  path: '/pricing',
});

/**
 * /pricing, after seline.com/pricing: a centred heading, the plan you can use
 * today as the main card (the mascot peeking over its edge), Business beside
 * it with a Monthly | Yearly toggle, free setup help, the tools DUMA works
 * with, and the FAQ. Words and prices come from lib/marketing/pricing.ts.
 */
export default function PricingPage() {
  return (
    <>
      <JsonLd data={softwareApplicationSchema({ description: DESCRIPTION })} />
      <JsonLd data={breadcrumbSchema([{ name: 'Pricing', path: '/pricing' }])} />
      <JsonLd data={faqSchema(PRICING_FAQS)} />

      {/* Pulled up under the sticky header so the chalk curves start at the very top, as on the home page. */}
      <div className="relative -mt-16 overflow-hidden">
        <ChalkCurve side="left" id="pricing-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="pricing-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />

        <section className="relative px-4 pt-32 pb-20 sm:px-6 sm:pt-40">
          <div className="mx-auto max-w-5xl text-center">
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-5xl">Pricing</h1>
            <p className="mt-4 text-[1.0625rem] text-[var(--mkt-ink-2)]">Free forever. No card needed.</p>
          </div>

          {/* Two plans, side by side as equals: Free (available now) and Business (the step up, coming soon). */}
          <div className="mx-auto mt-20 grid max-w-4xl items-stretch gap-6 md:grid-cols-2">
            <div className="relative">
              <div className="pointer-events-none absolute -top-16 right-10 z-0 hidden sm:block" aria-hidden="true">
                <Mascot size={96} state="idle" expression="attentif" gesture="wave" gestureKey="pricing" follow />
              </div>
              <article className="mkt-card relative flex h-full flex-col rounded-[14px] px-6 py-7 sm:px-8 sm:py-8">
                {/* Same stack as the Business card, so name, price, list and button line up across the row. */}
                <div className="flex min-h-9 items-center justify-between gap-3">
                  <h2 className="flex items-center gap-3 text-2xl font-semibold tracking-display">
                    <span className="grid size-9 place-items-center rounded-[10px] bg-success-highlight text-success">
                      <Gift className="size-[1.125rem]" aria-hidden="true" />
                    </span>
                    Free
                  </h2>
                  <span className="mkt-tag">Available now</span>
                </div>

                <p className="mt-5 min-h-12 text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">
                  Everything a small business needs to run.
                </p>

                <PlanPrice amount="0" period="forever" />
                <p className="mt-2 min-h-5" aria-hidden="true" />

                <ul className="mt-6 mb-8 flex flex-col gap-3 border-t border-[var(--mkt-line)] pt-6 text-[0.9375rem]">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <SignUpButton className="mt-auto w-full" />
              </article>
            </div>

            <BusinessPlanCard />
          </div>

          {/* Free setup help, on every plan — DUMA's done-for-you. */}
          <div className="mx-auto mt-6 grid max-w-4xl gap-6 rounded-[10px] border border-dashed border-[var(--mkt-line)] bg-[var(--mkt-card)] px-6 py-6 sm:px-8 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
            <span className="grid size-12 place-items-center rounded-md bg-success-highlight text-success">
              <LifeBuoy className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Setup help, free on every plan</h2>
              <p className="mt-1 text-pretty text-[0.9375rem] text-[var(--mkt-ink-2)]">New to DUMA? We set it up with you, personally.</p>
            </div>
            <ul className="grid gap-1.5 text-sm text-[var(--mkt-ink-2)]">
              {SETUP_HELP.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* Free and Business, part by part. */}
      <section className="px-4 pb-24 sm:px-6" aria-labelledby="compare-plans">
        <div className="mx-auto max-w-4xl">
          <h2 id="compare-plans" className="text-center text-3xl leading-[1.12] font-semibold tracking-display sm:text-4xl">
            Free and Business, part by part
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-pretty text-[1.0625rem] text-[var(--mkt-ink-2)]">
            The basics are free in full, for good. Every other part has a free allowance, and Business raises it.
          </p>

          <div className="mt-12">
            <CompareTable
              caption="What each part of DUMA includes on the Free and Business plans"
              columns={[
                { key: 'free', label: 'Free', sub: '£0' },
                { key: 'business', label: 'Business', sub: `${formatPounds(BUSINESS.monthly)} / month`, highlight: true },
              ]}
              groups={PLAN_COMPARISON.map((group) => ({
                title: group.group,
                rows: group.rows.map((row) => ({ label: row.part, cells: { free: PLAN_CELL[row.free], business: PLAN_CELL[row.business] } })),
              }))}
              footer={{ cells: { free: <SignUpButton />, business: 'Coming soon' } }}
              labelWidth="50%"
              minWidth="34rem"
            />
          </div>
        </div>
      </section>

      {/* The tools DUMA works with — where seline.com shows customer logos, DUMA has none yet to show. */}
      <section className="px-4 pb-8 sm:px-6" aria-labelledby="works-with">
        <h2 id="works-with" className="text-center text-sm font-medium tracking-[0.06em] text-[var(--mkt-ink-2)] uppercase">
          Works with the tools you already use
        </h2>
        <IntegrationMarquee className="mx-auto mt-6 max-w-5xl" />
      </section>

      <FaqSection items={PRICING_FAQS} />
    </>
  );
}

/** A plan cell as a comparison mark: the basics are in full on both, every other part is an allowance on Free and raised on Business. */
const PLAN_CELL: Record<PlanCell, CompareCell> = {
  full: { mark: 'yes' },
  allowance: { mark: 'part', note: 'Free allowance' },
  higher: { mark: 'yes', note: 'Much higher limits' },
};
