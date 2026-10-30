import type { Metadata } from 'next';

import { Mascot } from '@/components/ai/Mascot';
import { Check, LifeBuoy, Minus, Receipt } from '@/components/icons';
import { BusinessPlanCard } from '@/components/marketing/BusinessPlanCard';
import { JsonLd } from '@/components/marketing/JsonLd';
import { FaqSection, SignUpButton } from '@/components/marketing/sections';
import { ChalkCurve } from '@/components/marketing/Strokes';

import { INTEGRATION_LOGOS } from '@/lib/marketing/integration-logos';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { BUSINESS, FREE_FEATURES, PLAN_COMPARISON, PRICING_FAQS, SETUP_HELP, formatPounds, type PlanCell } from '@/lib/marketing/pricing';
import { breadcrumbSchema, faqSchema, softwareApplicationSchema } from '@/lib/marketing/schema';
import { cn } from '@/lib/utils/cn';

const DESCRIPTION =
  'DUMA pricing: a free plan forever with no card needed — till, orders, payments, stock, customers and rotas free in full. Business is £89 a month, or £80 a month paid yearly, coming soon; founding members keep 10% off for life.';

export const metadata: Metadata = marketingMetadata({
  title: 'Pricing: Free POS and Business Software, No Card Needed | DUMA',
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
              <article className="mkt-card relative flex h-full flex-col rounded-[14px] px-6 py-7 shadow-[0_24px_48px_-24px_rgb(32_55_45/0.3)] sm:px-8 sm:py-8">
                <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-display">
                  <Receipt className="size-5 text-primary" aria-hidden="true" />
                  Free
                </h2>

                <p className="mt-5 text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">
                  Everything a small business needs to run, with no time limit and no card.
                </p>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-mono text-5xl font-semibold tabular-nums">£0</span>
                  <span className="text-[var(--mkt-ink-2)]">/ forever</span>
                </div>
                <p className="mt-1 min-h-5 text-sm text-[var(--mkt-ink-2)]">No card needed</p>

                <ul className="mt-6 flex flex-col gap-3 border-t border-[var(--mkt-line)] pt-6 text-[0.9375rem]">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-highlight text-success">
                        <Check className="size-3" aria-hidden="true" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <SignUpButton className="mt-8 w-full" />
              </article>
            </div>

            <BusinessPlanCard />
          </div>

          {/* Free setup help, on every plan — DUMA's done-for-you. */}
          <div className="mx-auto mt-6 grid max-w-4xl gap-6 rounded-[10px] border border-dashed border-[var(--mkt-line)] px-6 py-6 sm:px-8 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
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
            Free and Business, <span className="text-[var(--mkt-ink-3)]">side by side.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-pretty text-[1.0625rem] text-[var(--mkt-ink-2)]">
            The basics are free in full, for good. Every other part has a free allowance, and Business raises it. Today, everything is free.
          </p>

          <div className="mt-12 overflow-x-auto pb-4">
            <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-[0.9375rem]">
              <caption className="sr-only">What each part of DUMA includes on the Free and Business plans</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-1/2 pb-4 text-left font-normal">
                    <span className="sr-only">Part of DUMA</span>
                  </th>
                  <th scope="col" className="w-1/4 pt-3 pb-4 text-center">
                    <span className="block text-lg font-semibold">Free</span>
                    <span className="block font-mono text-sm font-normal text-[var(--mkt-ink-2)] tabular-nums">£0</span>
                  </th>
                  <th scope="col" className="w-1/4 rounded-t-lg bg-sidebar/[0.06] pt-3 pb-4 text-center">
                    <span className="block text-lg font-semibold">Business</span>
                    <span className="block font-mono text-sm font-normal text-[var(--mkt-ink-2)] tabular-nums">
                      {formatPounds(BUSINESS.monthly)} / month
                    </span>
                  </th>
                </tr>
              </thead>
              {PLAN_COMPARISON.map((group) => (
                <tbody key={group.group}>
                  <tr>
                    <th scope="colgroup" colSpan={2} className="border-b border-[var(--mkt-line)] pt-8 pb-2 text-left text-sm font-semibold text-[var(--mkt-heading)]">
                      {group.group}
                    </th>
                    <td className="border-b border-[var(--mkt-line)] bg-sidebar/[0.06]" />
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.part}>
                      <th scope="row" className="border-b border-[var(--mkt-line)] py-3.5 pr-4 text-left font-normal text-[var(--mkt-ink-2)]">
                        {row.part}
                      </th>
                      <PlanCellView cell={row.free} />
                      <PlanCellView cell={row.business} highlight />
                    </tr>
                  ))}
                </tbody>
              ))}
              <tbody>
                <tr>
                  <td />
                  <td className="pt-6 pb-5 text-center">
                    <SignUpButton />
                  </td>
                  <td className="rounded-b-lg bg-sidebar/[0.06] pt-6 pb-5 text-center text-sm text-[var(--mkt-ink-2)]">Coming soon</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-center text-sm text-[var(--mkt-ink-2)]">Free allowances will be published well before Business launches.</p>
        </div>
      </section>

      {/* The tools DUMA works with — where seline.com shows customer logos, DUMA has none yet to show. */}
      <section className="px-4 pb-8 sm:px-6" aria-labelledby="works-with">
        <h2 id="works-with" className="text-center text-sm font-medium tracking-[0.06em] text-[var(--mkt-ink-2)] uppercase">
          Works with the tools you already use
        </h2>
        <ul className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[var(--mkt-ink-3)]">
          {INTEGRATION_LOGOS.map((logo) => (
            <li key={logo.name} className="flex items-center gap-2 text-lg font-semibold tracking-display">
              {logo.path && (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5">
                  <path d={logo.path} />
                </svg>
              )}
              {logo.name}
            </li>
          ))}
        </ul>
      </section>

      <FaqSection items={PRICING_FAQS} />
    </>
  );
}

const CELL = {
  full: 'Included in full',
  allowance: 'Free allowance',
  higher: 'Much higher limits',
} as const;

function PlanCellView({ cell, highlight = false }: { cell: PlanCell; highlight?: boolean }) {
  return (
    <td className={cn('border-b border-[var(--mkt-line)] px-3 py-3.5 text-center', highlight && 'bg-sidebar/[0.06]')}>
      <span className="inline-flex items-center gap-2 text-sm">
        {cell === 'allowance' ? (
          <Minus className="size-4 shrink-0 text-stock" aria-hidden="true" />
        ) : (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success-highlight text-success">
            <Check className="size-3" aria-hidden="true" />
          </span>
        )}
        <span className={cell === 'allowance' ? 'text-[var(--mkt-ink-2)]' : 'font-medium'}>{CELL[cell]}</span>
      </span>
    </td>
  );
}
