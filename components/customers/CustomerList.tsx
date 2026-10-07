'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { TIER_RUNGS } from '@/components/customers/LoyaltyProgress';
import { AlertTriangle, ArrowDown, ArrowUp, MailX, ShieldAlert } from '@/components/icons';
import { Avatar } from '@/components/shared/Avatar';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { IconTag } from '@/components/shared/IconTag';
import { MiniBar } from '@/components/shared/MiniBar';
import { StatusDot } from '@/components/shared/StatusDot';
import type { Tone } from '@/components/shared/tone';

import { TIER_CONFIG } from '@/lib/constants/customers';
import { cn } from '@/lib/utils/cn';
import { type VisitTone, visitStatus } from '@/lib/utils/customer-card';
import { timeAgo } from '@/lib/utils/format';
import { tierLadder } from '@/lib/utils/loyalty-tiers';
import type { Customer, CustomerSort, SortDirection } from '@/types/customers';

/** Tier as the Menu and Audit rows show state: a small tinted pill, never a loud badge. */
const TIER_PILL: Record<Customer['tier'], string> = {
  vip: 'bg-primary/10 text-primary',
  gold: 'bg-warning/12 text-warning',
  silver: 'bg-band text-muted-foreground',
  bronze: 'bg-measured/10 text-measured',
};

/** The cards' recency dot: in lately, quiet, lapsed, never. */
const VISIT_TONE: Record<VisitTone, Tone> = { active: 'success', idle: 'muted', lapsed: 'warning', never: 'muted' };

const COLUMNS: { key: CustomerSort; label: string; width: string }[] = [
  { key: 'points', label: 'Points', width: 'w-20' },
  { key: 'spend', label: 'Spent', width: 'w-24' },
  { key: 'visits', label: 'Visits', width: 'w-16' },
  { key: 'last_visit', label: 'Last visit', width: 'w-24' },
];

/**
 * The customers as the Menu lists its items: one bordered list, a row per
 * guest — who they are and anything the team must see, then points, spend,
 * visits and when they were last in. The column labels above it sort.
 */
export function CustomerList({
  customers,
  money,
  sort,
  direction,
  onSort,
  selectable,
  selectedIds,
  onToggle,
  onToggleAll,
  footer,
}: {
  customers: Customer[];
  money: (amount: string | number) => string;
  sort?: CustomerSort;
  direction?: SortDirection;
  onSort: (key: CustomerSort) => void;
  /** Ticks appear for people who can merge — selection is what merging and export act on. */
  selectable: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  footer?: ReactNode;
}) {
  // Pinned on mount so the recency dots don't shift under a render.
  const [now] = useState(() => Date.now());
  const allSelected = customers.length > 0 && customers.every((customer) => selectedIds.has(customer.id));
  const sortHeader = (key: CustomerSort, label: string, className: string) => {
    const active = sort === key;
    const Arrow = direction === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => onSort(key)}
        aria-label={`Sort by ${label.toLowerCase()}`}
        aria-pressed={active}
        className={cn(
          'inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground',
          active && 'text-foreground',
          className,
        )}
      >
        {label}
        {active && <Arrow size={11} aria-hidden="true" />}
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="hidden items-center gap-3 px-3.5 text-label text-muted-foreground sm:flex">
        {selectable && (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            aria-label="Select everyone on this page"
            className="size-4 shrink-0 rounded accent-primary"
          />
        )}
        <span className="flex-1">{sortHeader('name', 'Customer', 'justify-start')}</span>
        <span className="w-16 text-right uppercase">Tier</span>
        {COLUMNS.map((column) => (
          <span
            key={column.key}
            className={cn(
              'flex shrink-0 justify-end',
              column.width,
              column.key === 'visits' && 'hidden md:flex',
              column.key === 'last_visit' && 'hidden lg:flex',
            )}
          >
            {sortHeader(column.key, column.label, 'justify-end')}
          </span>
        ))}
      </div>

      <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        {customers.map((customer) => (
          <CustomerRow
            key={customer.id}
            customer={customer}
            money={money}
            now={now}
            selectable={selectable}
            selected={selectedIds.has(customer.id)}
            onToggle={() => onToggle(customer.id)}
          />
        ))}
      </ul>
      {footer}
    </div>
  );
}

function CustomerRow({
  customer,
  money,
  now,
  selectable,
  selected,
  onToggle,
}: {
  customer: Customer;
  money: (amount: string | number) => string;
  now: number;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const name = `${customer.firstName} ${customer.lastName}`.trim();
  const critical = customer.alerts?.some((alert) => alert.severity === 'critical') ?? false;
  const allergies = customer.allergies ?? [];
  const emailable = Boolean(customer.email) && customer.marketingOptIn && !customer.emailUnsubscribedAt;
  const visit = visitStatus(customer.lastVisitAt, now);
  const ladder = tierLadder(customer.pointsBalance, TIER_RUNGS);

  return (
    <li
      className={cn(
        'flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 transition-colors last:border-b-0 hover:bg-band/40',
        selected && 'bg-band/50',
      )}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${name}`}
          className="size-4 shrink-0 rounded accent-primary"
        />
      )}
      <Link
        href={`/customers/${customer.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Avatar name={name} email={customer.email} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{name || 'Unnamed guest'}</span>
            {/* Safety first, even in a list: the one thing no one should have to open a record to see. */}
            {critical && <IconTag icon={ShieldAlert} label="Critical alert" tone="exception" size={13} />}
            {allergies.length > 0 && (
              <IconTag
                icon={AlertTriangle}
                label={`Allergies: ${allergies.join(', ')}`}
                tone="warning"
                size={13}
                className="hidden md:inline-flex"
              />
            )}
            {/* Only the "no" is certain from this row: an address-only suppression
                (a bounce, the Suppressions list) never clears the opt-in, so a
                green "can be emailed" here could be wrong. */}
            {!emailable && <IconTag icon={MailX} label="Can’t be sent marketing" size={13} className="hidden opacity-60 sm:inline-flex" />}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{customer.email || customer.phone || 'No contact details'}</span>
        </span>
      </Link>
      <span className="flex w-16 shrink-0 justify-end">
        <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', TIER_PILL[customer.tier])}>
          {TIER_CONFIG[customer.tier].label}
        </span>
      </span>
      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
        {customer.pointsBalance.toLocaleString()}
        <MiniBar
          value={ladder.current.fill}
          max={1}
          tone="primary"
          label={ladder.next ? `${ladder.next.needed.toLocaleString()} points to ${ladder.next.label}` : 'Top tier'}
          className="mt-1 ml-auto w-14"
        />
      </span>
      <span className="w-24 shrink-0 text-right text-sm tabular-nums text-foreground">{money(customer.totalSpent)}</span>
      <span className="hidden w-16 shrink-0 text-right text-sm tabular-nums text-muted-foreground md:block">
        {customer.totalVisits.toLocaleString()}
      </span>
      <span className="hidden w-24 shrink-0 items-center justify-end gap-1.5 text-xs tabular-nums text-muted-foreground lg:flex">
        <StatusDot tone={VISIT_TONE[visit.tone]} dashed={visit.tone === 'never'} label={visit.label} />
        {customer.lastVisitAt ? timeAgo(customer.lastVisitAt) : 'Never'}
      </span>
    </li>
  );
}

export function CustomerListSkeleton() {
  return (
    <ListSkeleton rows={8} avatar label="Loading customers" />
  );
}
