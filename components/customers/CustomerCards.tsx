import Link from 'next/link';
import type { ReactNode } from 'react';

import { AlertTriangle, Mail, Phone, ShieldAlert } from '@/components/icons';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Badge } from '@/components/ui/badge';

import { TIER_CONFIG } from '@/lib/constants/customers';
import { timeAgo } from '@/lib/utils/format';
import type { Customer } from '@/types/customers';

/**
 * The card face of the customers list — the same records the table shows, one
 * per tile.
 *
 * These were 256px-tall two-up tiles carrying a loyalty headline, a tier
 * progress bar and an "Open profile" link, which meant eight customers filled a
 * screen and the card repeated an affordance it already had: the whole tile is
 * the link. What is left is what someone scanning a grid actually reads — who
 * they are, how to reach them, what they are worth, and when they were last in —
 * at four across on a wide screen. The tier journey belongs on the record, where
 * there is room to explain it.
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
        {Array.from({ length: 12 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </CardGrid>
    );
  }

  if (customers.length === 0) return <div className="rounded-sm border border-rule bg-card">{emptyState}</div>;

  return (
    <>
      <CardGrid>
        {customers.map((customer) => (
          <CustomerCard key={customer.id} customer={customer} fmtDate={fmtDate} />
        ))}
      </CardGrid>
      {/* The table gets this row from DataTable's own footer slot; the grid has
          to draw the surface itself so paging reads the same in both views. */}
      {footer && <div className="rounded-sm border border-rule bg-muted/20 px-4 py-3">{footer}</div>}
    </>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}

function CustomerCard({ customer, fmtDate }: { customer: Customer; fmtDate: (iso?: string) => string }) {
  const tier = TIER_CONFIG[customer.tier];
  const lastVisit = customer.lastVisitAt ? timeAgo(customer.lastVisitAt) : 'No visits yet';
  const hasCriticalAlert = customer.alerts?.some((alert) => alert.severity === 'critical') ?? false;
  const allergies = customer.allergies ?? [];

  return (
    <Link
      href={`/customers/${customer.id}`}
      aria-label={`Open ${customer.firstName} ${customer.lastName}`}
      className="group flex flex-col rounded-sm border border-rule bg-card p-3.5 transition-[border-color,box-shadow] duration-150 hover:border-primary/45 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex items-start gap-2.5">
        <InitialsAvatar
          firstName={customer.firstName}
          lastName={customer.lastName}
          email={customer.email}
          className="size-9 text-xs"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
            <span className="truncate">
              {customer.firstName} {customer.lastName}
            </span>
            {/* Safety first, even in a grid: a critical alert or an allergy is
                the one thing a manager must not have to open a record to see. */}
            {hasCriticalAlert && <ShieldAlert size={13} className="shrink-0 text-exception" aria-label="Has a critical alert" />}
            {allergies.length > 0 && (
              <AlertTriangle size={13} className="shrink-0 text-warning" aria-label={`Allergies: ${allergies.join(', ')}`} />
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {customer.email ? (
              <Mail size={12} className="shrink-0" aria-hidden="true" />
            ) : (
              <Phone size={12} className="shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{customer.email || customer.phone || 'No contact details'}</span>
          </p>
        </div>
        <Badge variant={tier.variant} className="shrink-0">
          {tier.label}
        </Badge>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-rule/55 pt-2.5">
        <Stat label="Points" value={customer.pointsBalance.toLocaleString()} />
        <Stat label="Spent" value={`£${Number(customer.totalSpent).toFixed(0)}`} />
        <Stat label="Visits" value={customer.totalVisits.toLocaleString()} />
      </dl>

      <p
        className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground"
        title={customer.lastVisitAt ? fmtDate(customer.lastVisitAt) : undefined}
      >
        <span
          className={customer.lastVisitAt ? 'size-1.5 rounded-full bg-momentum' : 'size-1.5 rounded-full bg-rule'}
          aria-hidden="true"
        />
        {lastVisit}
      </p>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">{label}</dt>
      <dd data-figure className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-sm border border-rule bg-card p-3.5">
      <div className="flex items-start gap-2.5">
        <div className="size-9 shrink-0 rounded-sm bg-muted" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <div className="h-3.5 w-2/3 rounded bg-muted" />
          <div className="h-3 w-4/5 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-3 h-8 rounded bg-muted" />
      <div className="mt-2.5 h-3 w-1/2 rounded bg-muted" />
    </div>
  );
}
