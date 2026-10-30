'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ArrowRight, Check, Sparkles } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';

import { BUSINESS_FEATURES, type Billing, businessPrice, formatPounds, yearlySaving } from '@/lib/marketing/pricing';
import { SIGN_UP_PATH } from '@/lib/marketing/site';
import { cn } from '@/lib/utils/cn';

/**
 * The Business plan, as the dark step-up card beside Free, with seline.com's
 * Monthly | Yearly toggle: the price and its basis change with it, and the
 * founding-member price follows. It cannot be bought yet, so the button signs
 * people up free today — which is what keeps them the founding price.
 */
export function BusinessPlanCard({ className }: { className?: string }) {
  const [billing, setBilling] = useState<Billing>('monthly');
  const price = businessPrice(billing);
  const founding = businessPrice(billing, { founding: true });

  return (
    <article
      className={cn(
        'relative flex flex-col overflow-hidden rounded-[14px] bg-sidebar px-6 py-7 text-sidebar-foreground shadow-[0_24px_48px_-20px_rgb(14_36_27/0.55)] sm:px-8 sm:py-8',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-display">
            <Sparkles className="size-5" aria-hidden="true" />
            Business
          </h2>
        </div>
        <div className="text-right">
          <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full bg-white/10 p-1">
            {(['monthly', 'yearly'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={billing === option}
                onClick={() => setBilling(option)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm transition-colors',
                  billing === option ? 'bg-sidebar-foreground font-medium text-sidebar' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground',
                )}
              >
                {option === 'monthly' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-sidebar-foreground/65">Save {formatPounds(yearlySaving())} yearly</p>
        </div>
      </div>

      <p className="mt-5 text-pretty text-[0.9375rem] leading-relaxed text-sidebar-foreground/75">For businesses that outgrow the free allowances. One flat price, every part of DUMA.</p>

      {/* Always quoted per month; on yearly billing the monthly rate is struck through beside it. */}
      <div className="mt-6 flex items-baseline gap-2.5">
        {billing === 'yearly' && (
          <s className="font-mono text-2xl font-semibold text-sidebar-foreground/45 tabular-nums">
            <span className="sr-only">Was </span>
            {formatPounds(businessPrice('monthly').perMonth)}
          </s>
        )}
        <span className="font-mono text-5xl font-semibold tabular-nums">{formatPounds(price.perMonth)}</span>
        <span className="text-sidebar-foreground/70">/ month</span>
      </div>

      <p className="mt-4 rounded-lg bg-white/8 px-3.5 py-2.5 text-sm">
        <span className="font-semibold">Founding members</span> <span className="text-sidebar-foreground/75">keep 10% off for life —</span>{' '}
        <span className="font-mono font-semibold tabular-nums">{formatPounds(founding.perMonth)}</span>
        <span className="text-sidebar-foreground/75"> a month{billing === 'yearly' ? ', billed yearly' : ''}</span>
      </p>

      <ul className="mt-6 mb-8 flex flex-col gap-3 border-t border-white/12 pt-6 text-[0.9375rem]">
        {BUSINESS_FEATURES.map((feature) => (
          <li key={feature} className="flex gap-3">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/14">
              <Check className="size-3" aria-hidden="true" />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <Link href={SIGN_UP_PATH} className={cn(buttonVariants({ size: 'touch' }), 'mt-auto w-full bg-sidebar-foreground text-sidebar hover:bg-sidebar-foreground/90')}>
        Coming soon — join free, keep 10% off
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
