import Link from 'next/link';
import type { ReactNode } from 'react';

import { ChevronRight, Mail, Phone, Star } from '@/components/icons';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Badge } from '@/components/ui/badge';

import { TIER_CONFIG, TIER_THRESHOLDS } from '@/lib/constants/customers';
import { timeAgo } from '@/lib/utils/format';
import type { Customer } from '@/types/customers';

/**
 * The card face of the customers list — the same records the table shows, laid
 * out one per tile so a name, tier and how much someone spends read at a glance.
 * Every card is a single link to the customer record.
 */
export function CustomerCards({
  customers,
  isLoading,
  emptyState,
  footer,
  fmtDate,
}: {
  customers: Customer[];
  isLoading?: boolean;
  emptyState: ReactNode;
  footer?: ReactNode;
  /** Shared with the table so both views date-format identically. */
  fmtDate: (iso?: string) => string;
}) {
  if (isLoading) {
    return (
      <CardGrid>
        {Array.from({ length: 8 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </CardGrid>
    );
  }

  if (customers.length === 0) return <div className="rounded-lg border border-rule/65 bg-card">{emptyState}</div>;

  return (
    <>
      <CardGrid>
        {customers.map((customer) => (
          <CustomerCard key={customer.id} customer={customer} fmtDate={fmtDate} />
        ))}
      </CardGrid>
      {footer}
    </>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{children}</div>;
}

function CustomerCard({ customer, fmtDate }: { customer: Customer; fmtDate: (iso?: string) => string }) {
  const tier = TIER_CONFIG[customer.tier];
  const threshold = TIER_THRESHOLDS[customer.tier];
  const tierSpan = Math.max(1, threshold.to - threshold.from);
  const tierProgress = Math.max(0, Math.min(100, ((customer.pointsBalance - threshold.from) / tierSpan) * 100));
  const pointsRemaining = Math.max(0, threshold.to - customer.pointsBalance);
  const lastVisit = customer.lastVisitAt ? timeAgo(customer.lastVisitAt) : 'No visits yet';

  return (
    <Link
      href={`/customers/${customer.id}`}
      aria-label={`Open ${customer.firstName} ${customer.lastName}`}
      className="group flex min-h-64 flex-col rounded-lg border border-rule/65 bg-card p-4 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-primary/45 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5"
    >
      <div className="flex items-start gap-3">
        <InitialsAvatar firstName={customer.firstName} lastName={customer.lastName} email={customer.email} className="size-12 text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold tracking-title text-foreground">
            {customer.firstName} {customer.lastName}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{customer.email ?? '—'}</span>
          </p>
        </div>
        <Badge variant={tier.variant} className="shrink-0">
          {tier.label}
        </Badge>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Star size={13} className="text-stock" aria-hidden="true" /> Loyalty balance
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-foreground">
              <span data-figure>{customer.pointsBalance.toLocaleString()}</span>{' '}
              <span className="text-sm font-medium text-muted-foreground">points</span>
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-5 text-right">
            <Stat label="Spent" value={`£${Number(customer.totalSpent).toFixed(0)}`} />
            <Stat label="Visits" value={customer.totalVisits.toLocaleString()} />
          </dl>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-band" aria-hidden="true">
          <div className="h-full rounded-full bg-stock transition-[width] duration-500" style={{ width: `${tierProgress}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {pointsRemaining > 0
            ? `${pointsRemaining.toLocaleString()} points to ${threshold.nextTier}`
            : `${threshold.nextTier} threshold reached`}
        </p>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-rule/55 pt-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate tabular-nums">{customer.phone || 'No phone number'}</span>
          </p>
          <p
            className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"
            title={customer.lastVisitAt ? fmtDate(customer.lastVisitAt) : undefined}
          >
            <span
              className={customer.lastVisitAt ? 'size-1.5 rounded-full bg-momentum' : 'size-1.5 rounded-full bg-rule'}
              aria-hidden="true"
            />
            {lastVisit}
          </p>
        </div>
        <span className="flex min-h-8 shrink-0 items-center gap-0.5 rounded-md px-2 text-xs font-semibold text-primary transition-colors group-hover:bg-measured/8">
          Open profile
          <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd data-figure className="mt-0.5 truncate text-sm font-semibold text-foreground">
        {value}
      </dd>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="min-h-64 animate-pulse rounded-lg border border-rule/65 bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="size-12 shrink-0 rounded-md bg-muted" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 w-2/3 rounded bg-muted" />
          <div className="h-3 w-4/5 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-5 h-20 rounded-md bg-muted" />
      <div className="mt-5 h-px bg-muted" />
      <div className="mt-4 h-3 w-1/2 rounded bg-muted" />
    </div>
  );
}
