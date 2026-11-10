'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ArrowRight, Building2, Check } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';

import { BUSINESS_FEATURES, type Billing, businessPrice, formatPounds, yearlySaving } from '@/lib/marketing/pricing';
import { SIGN_UP_PATH } from '@/lib/marketing/site';
import { cn } from '@/lib/utils/cn';

/**
 * The Business plan, as the dark step-up card beside Free, with a Monthly |
 * Yearly switch (Segmented's shape, inverted for the dark card): monthly shows
 * the month's price, yearly the year's, one month free. It cannot be bought yet,
 * so the button signs people up free today.
 */
export function BusinessPlanCard({ className }: { className?: string }) {
  const [billing, setBilling] = useState<Billing>('monthly');
  const price = businessPrice(billing);

  return (
    <article
      className={cn(
        'relative flex flex-col overflow-hidden rounded-[14px] bg-sidebar px-6 py-7 text-sidebar-foreground sm:px-8 sm:py-8',
        className,
      )}
    >
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-2xl font-semibold tracking-display">
          <span className="grid size-9 place-items-center rounded-[10px] bg-white/10 text-sidebar-foreground">
            <Building2 className="size-[1.125rem]" aria-hidden="true" />
          </span>
          Business
        </h2>
        <div>
          <div role="radiogroup" aria-label="Billing period" className="inline-flex gap-0.5 rounded-[10px] border border-white/15 p-1">
            {(['monthly', 'yearly'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={billing === option}
                onClick={() => setBilling(option)}
                className={cn(
                  'rounded-[6px] px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground',
                  billing === option ? 'bg-white/15 text-sidebar-foreground' : 'text-sidebar-foreground/70 hover:bg-white/8 hover:text-sidebar-foreground',
                )}
              >
                {option === 'monthly' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-5 min-h-12 text-pretty text-[0.9375rem] leading-relaxed text-sidebar-foreground/75">For businesses that outgrow the free allowances. One flat price, every part of DUMA.</p>

      <PlanPrice amount={formatPounds(price.total).slice(1)} period={price.period} muted="text-sidebar-foreground/60" />
      <p className="mt-2 min-h-5 text-sm text-sidebar-foreground/75">
        {billing === 'yearly'
          ? `One month free: you save ${formatPounds(yearlySaving())}.`
          : `Or ${formatPounds(businessPrice('yearly').total)} a year, one month free.`}
      </p>

      <ul className="mt-6 mb-8 flex flex-col gap-3 border-t border-white/12 pt-6 text-[0.9375rem]">
        {BUSINESS_FEATURES.map((feature) => (
          <li key={feature} className="flex gap-3">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>

      <Link href={SIGN_UP_PATH} className={cn(buttonVariants({ size: 'touch' }), 'mt-auto w-full bg-sidebar-foreground text-sidebar hover:bg-sidebar-foreground/90')}>
        Coming soon. Start free today
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

/**
 * A plan's price, set like a premium price tag: a small raised pound sign, the
 * amount large in the display face, and the period quiet on the baseline.
 */
export function PlanPrice({ amount, period, muted = 'text-[var(--mkt-ink-2)]' }: { amount: string; period: string; muted?: string }) {
  return (
    <p className="mt-6 flex items-start">
      <span className={cn('mt-1.5 mr-0.5 text-2xl font-semibold', muted)}>£</span>
      <span className="text-6xl leading-none font-semibold tracking-display tabular-nums">{amount}</span>
      <span className={cn('mt-auto mb-1 ml-2', muted)}>/ {period}</span>
    </p>
  );
}
