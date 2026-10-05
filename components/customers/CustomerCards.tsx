import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { AlertTriangle, Gift, Mail, MailX, Phone, ShieldAlert } from '@/components/icons';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';

import { TIER_CONFIG } from '@/lib/constants/customers';
import { cn } from '@/lib/utils/cn';
import { type VisitTone, allergySummary, birthdayThisMonth, visitStatus } from '@/lib/utils/customer-card';
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
  money,
  selectable = false,
  selectedIds,
  onToggle,
}: {
  customers: Customer[];
  isLoading?: boolean;
  emptyState: ReactNode;
  footer?: ReactNode;
  /** In the workspace's own currency. */
  money: (amount: string | number) => string;
  /** Ticks for people who can merge — merging used to need the table view. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
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

  if (customers.length === 0) return <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">{emptyState}</div>;

  return (
    <>
      <CardGrid>
        {customers.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            money={money}
            anySelected={(selectedIds?.size ?? 0) > 0}
            selectable={selectable}
            selected={selectedIds?.has(customer.id) ?? false}
            onToggle={() => onToggle?.(customer.id)}
          />
        ))}
      </CardGrid>
      {/* The table gets this row from DataTable's own footer slot; the grid has
          to draw the surface itself so paging reads the same in both views. */}
      {footer}
    </>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}

function CustomerCard({
  customer,
  money,
  selectable,
  selected,
  anySelected,
  onToggle,
}: {
  customer: Customer;
  money: (amount: string | number) => string;
  selectable: boolean;
  selected: boolean;
  /** Once one card is ticked, every tick box stays visible — selecting is a mode. */
  anySelected: boolean;
  onToggle: () => void;
}) {
  const [now] = useState(() => Date.now());
  const name = `${customer.firstName} ${customer.lastName}`.trim() || 'Unnamed guest';
  const visit = visitStatus(customer.lastVisitAt, now);
  const critical = customer.alerts?.find((alert) => alert.severity === 'critical');
  const allergies = allergySummary(customer.allergies);
  const birthday = birthdayThisMonth(customer.dob, now);
  const emailable = Boolean(customer.email) && customer.marketingOptIn && !customer.emailUnsubscribedAt;

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-lg border bg-card transition-colors duration-150 focus-within:border-primary/40 hover:border-primary/40',
        selected ? 'border-primary/60 ring-2 ring-primary/15' : 'border-rule/60',
      )}
    >
      {/* The whole card opens the record; the tick box sits above the link so it never navigates. */}
      <Link
        href={`/customers/${customer.id}`}
        aria-label={`Open ${name}`}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />

      <div className="pointer-events-none relative flex items-start gap-3 p-3.5 pb-3">
        <span className="relative size-10 shrink-0">
          <InitialsAvatar
            firstName={customer.firstName}
            lastName={customer.lastName}
            email={customer.email}
            className={cn(
              'size-10 text-xs transition-opacity',
              selectable && (selected || anySelected) && 'opacity-0',
              selectable && 'group-hover:opacity-0',
            )}
          />
          {selectable && (
            <label
              className={cn(
                'pointer-events-auto absolute inset-0 z-10 flex cursor-pointer items-center justify-center rounded-md border border-rule/60 bg-background transition-opacity',
                selected || anySelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
              )}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={onToggle}
                aria-label={`Select ${name}`}
                className="size-4 rounded accent-primary"
              />
            </label>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {customer.email ? (
              <Mail size={12} className="shrink-0" aria-hidden="true" />
            ) : (
              <Phone size={12} className="shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{customer.email || customer.phone || 'No contact details'}</span>
          </span>
        </span>
        <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold', TIER_PILL[customer.tier])}>
          {TIER_CONFIG[customer.tier].label}
        </span>
      </div>

      {/* Safety first, named — the one thing no one should have to open the record to learn. */}
      {(critical || allergies) && (
        <div className="pointer-events-none relative flex flex-wrap gap-1.5 px-3.5 pb-3">
          {critical && (
            <span
              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm bg-exception/8 px-1.5 py-0.5 text-micro font-semibold text-exception"
              title={critical.note ? `${critical.label} — ${critical.note}` : critical.label}
            >
              <ShieldAlert size={11} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{critical.label || 'Alert'}</span>
            </span>
          )}
          {allergies && (
            <span
              className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm bg-warning/12 px-1.5 py-0.5 text-micro font-semibold text-warning"
              title={`Allergies: ${allergies}`}
            >
              <AlertTriangle size={11} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{allergies}</span>
            </span>
          )}
        </div>
      )}

      <dl className="pointer-events-none relative mx-3.5 grid grid-cols-3 divide-x divide-rule/45 rounded-md bg-band/45">
        <Stat label="Points" value={customer.pointsBalance.toLocaleString()} />
        <Stat label="Spent" value={money(customer.totalSpent)} />
        <Stat label="Visits" value={customer.totalVisits.toLocaleString()} />
      </dl>

      <div className="pointer-events-none relative mt-auto flex items-center gap-3 px-3.5 py-3 text-xs">
        <span className={cn('flex min-w-0 items-center gap-1.5', VISIT_TONE[visit.tone].text)}>
          <span className={cn('size-1.5 shrink-0 rounded-full', VISIT_TONE[visit.tone].dot)} aria-hidden="true" />
          <span className="truncate">{visit.label}</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-muted-foreground">
          {birthday && (
            <span className="inline-flex items-center gap-1 text-primary" title="Birthday this month">
              <Gift size={13} aria-hidden="true" />
              <span className="sr-only">Birthday this month</span>
            </span>
          )}
          <span
            title={emailable ? 'Can be emailed' : 'Can’t be sent marketing'}
            className={emailable ? 'text-momentum' : 'text-muted-foreground/50'}
          >
            {emailable ? <Mail size={13} aria-hidden="true" /> : <MailX size={13} aria-hidden="true" />}
            <span className="sr-only">{emailable ? 'Can be emailed' : 'Can’t be sent marketing'}</span>
          </span>
        </span>
      </div>
    </div>
  );
}

/** Tier as a quiet pill, the same one the list rows use. */
const TIER_PILL: Record<Customer['tier'], string> = {
  vip: 'bg-primary/10 text-primary',
  gold: 'bg-warning/12 text-warning',
  silver: 'bg-band text-muted-foreground',
  bronze: 'bg-measured/10 text-measured',
};

const VISIT_TONE: Record<VisitTone, { dot: string; text: string }> = {
  active: { dot: 'bg-momentum', text: 'text-foreground' },
  idle: { dot: 'bg-muted-foreground/60', text: 'text-muted-foreground' },
  lapsed: { dot: 'bg-measured', text: 'text-measured' },
  never: { dot: 'bg-rule', text: 'text-muted-foreground' },
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 py-2">
      <dd data-figure className="truncate text-sm font-semibold tabular-nums text-foreground">
        {value}
      </dd>
      <dt className="text-micro text-muted-foreground">{label}</dt>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-rule/60 bg-card p-3.5">
      <div className="flex items-start gap-3">
        <div className="size-10 shrink-0 rounded-md bg-band" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <div className="h-3.5 w-2/3 rounded bg-band" />
          <div className="h-3 w-4/5 rounded bg-band/70" />
        </div>
      </div>
      <div className="mt-3 h-11 rounded-md bg-band/60" />
      <div className="mt-3 h-3 w-1/2 rounded bg-band/70" />
    </div>
  );
}
