import Link from 'next/link';
import type { ReactNode } from 'react';

import { ChevronRight, Mail, Phone } from '@/components/icons';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Badge } from '@/components/ui/badge';

import { TIER_CONFIG } from '@/lib/constants/customers';
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

  if (customers.length === 0) return <div className="rounded-2xl border border-border bg-card shadow-sm">{emptyState}</div>;

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
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}

function CustomerCard({ customer, fmtDate }: { customer: Customer; fmtDate: (iso?: string) => string }) {
  const tier = TIER_CONFIG[customer.tier];

  return (
    <Link
      href={`/customers/${customer.id}`}
      aria-label={`Open ${customer.firstName} ${customer.lastName}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex items-start gap-3">
        <InitialsAvatar firstName={customer.firstName} lastName={customer.lastName} email={customer.email} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {customer.firstName} {customer.lastName}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{customer.email ?? '—'}</span>
          </p>
        </div>
        <Badge variant={tier.variant} className="shrink-0">
          {tier.label}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/40 py-2.5 text-center">
        <Stat label="Points" value={customer.pointsBalance.toLocaleString()} />
        <Stat label="Spent" value={`£${Number(customer.totalSpent).toFixed(0)}`} />
        <Stat label="Visits" value={customer.totalVisits.toLocaleString()} />
      </dl>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone size={13} className="shrink-0" aria-hidden="true" />
            <span className="truncate tabular-nums">{customer.phone || '—'}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground/70">Last visit {fmtDate(customer.lastVisitAt)}</p>
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary">
          See details
          <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-1">
      <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground/70 uppercase">{label}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="size-10 shrink-0 rounded-sm bg-muted" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 w-2/3 rounded bg-muted" />
          <div className="h-3 w-4/5 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 h-14 rounded-xl bg-muted" />
      <div className="mt-3 h-3 w-1/2 rounded bg-muted" />
    </div>
  );
}
