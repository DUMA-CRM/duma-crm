import { Check } from '@/components/icons';

import { TIER_THRESHOLDS } from '@/lib/constants/customers';
import { cn } from '@/lib/utils/cn';
import { tierLadder } from '@/lib/utils/loyalty-tiers';
import type { Customer, Tier } from '@/types/customers';

export const TIER_RUNGS: { id: Tier; label: string; from: number }[] = [
  { id: 'bronze', label: 'Bronze', from: TIER_THRESHOLDS.bronze.from },
  { id: 'silver', label: 'Silver', from: TIER_THRESHOLDS.silver.from },
  { id: 'gold', label: 'Gold', from: TIER_THRESHOLDS.gold.from },
  { id: 'vip', label: 'VIP', from: TIER_THRESHOLDS.vip.from },
];

/**
 * The balance beside the whole tier ladder: every rung, its threshold, and how
 * far along the current one they are — rather than one bar between two labels,
 * which said nothing about the tiers beyond the next.
 *
 * Plotted from the points, not `customer.tier` (see `tierLadder`). Chrome-less:
 * the caller owns the panel, its heading and the Adjust action.
 */
export function LoyaltyProgress({ customer }: { customer: Customer }) {
  const ladder = tierLadder(Number(customer.pointsBalance), TIER_RUNGS);

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[minmax(9rem,auto)_minmax(0,1fr)]">
      <div>
        <p data-figure className="text-3xl font-semibold tabular-nums tracking-headline text-foreground">
          {ladder.points.toLocaleString()}
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">pts</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {ladder.next ? (
            <>
              <span className="font-semibold tabular-nums text-foreground">{ladder.next.needed.toLocaleString()}</span> to{' '}
              {ladder.next.label}
            </>
          ) : (
            'Top tier reached'
          )}
        </p>
      </div>

      <ol className="grid grid-cols-4 gap-1.5" aria-label="Tier ladder">
        {ladder.steps.map((step) => (
          <li key={step.id} aria-current={step.state === 'current' ? 'step' : undefined} className="min-w-0">
            <div className="h-2 overflow-hidden rounded-full bg-band">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500',
                  step.state === 'ahead' ? 'bg-transparent' : 'bg-stock',
                )}
                style={{ width: `${Math.round(step.fill * 100)}%` }}
              />
            </div>
            <p
              className={cn(
                'mt-2 flex items-center gap-1 truncate text-xs font-semibold',
                step.state === 'current'
                  ? 'text-foreground'
                  : step.state === 'passed'
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/70',
              )}
            >
              {step.state === 'passed' && <Check size={12} className="shrink-0 text-stock" aria-hidden="true" />}
              {step.label}
            </p>
            <p className="text-micro tabular-nums text-muted-foreground">{step.from.toLocaleString()}+</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
