'use client';

import { useState } from 'react';

import { AlertTriangle, Check } from '@/components/icons';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { TIER_CONFIG } from '@/lib/constants/customers';
import { formatDate } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import type { Customer } from '@/types/customers';

/**
 * Confirm a merge by choosing which record survives.
 *
 * The choice matters and is not obvious, so this shows both sides side by side
 * with the figures that decide it. It also states plainly what the merge does to
 * each field, because "merge" could reasonably mean several different things and
 * a manager should not have to guess which one this is.
 *
 * Merging is reversible here — the losing record is kept and pointed at the
 * survivor — and saying so is what makes the action safe to take.
 */

interface Props {
  a: Customer;
  b: Customer;
  isPending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (survivorId: string, loserId: string) => void;
}

const money = (value: number | string) => `£${Number(value).toFixed(0)}`;

export function MergeCustomersModal({ a, b, isPending, error, onCancel, onConfirm }: Props) {
  // Default to the record with more history: it usually has the fuller picture,
  // and its contact details are the ones staff have been using.
  const richer = Number(b.totalSpent) > Number(a.totalSpent) || b.totalVisits > a.totalVisits ? b : a;
  const [survivorId, setSurvivorId] = useState(richer.id);

  const survivor = survivorId === a.id ? a : b;
  const loser = survivorId === a.id ? b : a;

  const combinedPoints = a.pointsBalance + b.pointsBalance;
  const combinedAllergies = [...new Set([...(a.allergies ?? []), ...(b.allergies ?? [])])];
  const combinedDietary = [...new Set([...(a.dietary ?? []), ...(b.dietary ?? [])])];

  const option = (customer: Customer) => {
    const chosen = customer.id === survivorId;
    return (
      <button
        key={customer.id}
        type="button"
        onClick={() => setSurvivorId(customer.id)}
        aria-pressed={chosen}
        className={cn(
          'flex w-full flex-col gap-2 rounded-md border p-3 text-left transition-colors',
          chosen ? 'border-primary/50 bg-band' : 'border-rule/65 bg-background hover:border-rule',
        )}
      >
        <div className="flex items-center gap-2">
          <InitialsAvatar firstName={customer.firstName} lastName={customer.lastName} email={customer.email} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {customer.firstName} {customer.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{customer.phone}</p>
          </div>
          {chosen && <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />}
        </div>

        <div className="grid grid-cols-2 gap-1 text-xs">
          <span className="text-muted-foreground">Spent</span>
          <span className="text-right font-semibold tabular-nums text-foreground">{money(customer.totalSpent)}</span>
          <span className="text-muted-foreground">Visits</span>
          <span className="text-right tabular-nums text-foreground">{customer.totalVisits}</span>
          <span className="text-muted-foreground">Points</span>
          <span className="text-right tabular-nums text-foreground">{customer.pointsBalance.toLocaleString()}</span>
          <span className="text-muted-foreground">Last visit</span>
          <span className="text-right tabular-nums text-foreground">
            {customer.lastVisitAt ? formatDate(customer.lastVisitAt) : 'Never'}
          </span>
          <span className="text-muted-foreground">Email</span>
          <span className="truncate text-right text-foreground">{customer.email ?? '—'}</span>
        </div>

        <Badge variant={TIER_CONFIG[customer.tier].variant} className="self-start">
          {TIER_CONFIG[customer.tier].label}
        </Badge>
      </button>
    );
  };

  return (
    <Modal title="Merge duplicate records" onClose={onCancel}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose the record to keep. The other is kept too — hidden from lists and pointed at this one — so this can be undone later.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {option(a)}
          {option(b)}
        </div>

        {/* What will actually happen, in the same order the server does it. */}
        <dl className="space-y-2 rounded-md border border-rule/65 bg-muted/40 p-3 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Orders, emails and history</dt>
            <dd className="text-right font-medium text-foreground">Combined onto {survivor.firstName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Points</dt>
            <dd className="text-right font-medium tabular-nums text-foreground">
              {a.pointsBalance.toLocaleString()} + {b.pointsBalance.toLocaleString()} = {combinedPoints.toLocaleString()}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Allergies &amp; dietary</dt>
            <dd className="text-right font-medium text-foreground">
              {combinedAllergies.length + combinedDietary.length > 0
                ? `Kept from both (${[...combinedAllergies, ...combinedDietary].join(', ')})`
                : 'None on either record'}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Contact details</dt>
            <dd className="text-right font-medium text-foreground">
              {survivor.firstName}&rsquo;s kept; only blanks filled from {loser.firstName}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{loser.phone}</dt>
            <dd className="text-right font-medium text-foreground">Still finds this guest at the till</dd>
          </div>
        </dl>

        {/* Consent is the one thing a merge must not quietly widen. */}
        {loser.marketingOptIn && !survivor.marketingOptIn && (
          <p className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning/6 px-3 py-2 text-xs text-warning">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {loser.firstName} has marketing consent and {survivor.firstName} does not. Consent is not transferred by a merge — ask
              the guest again if you need it.
            </span>
          </p>
        )}

        {error && (
          <p className="rounded-md border border-exception/30 bg-exception/8 px-3 py-2 text-sm text-exception" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(survivor.id, loser.id)} disabled={isPending}>
            {isPending ? 'Merging…' : `Keep ${survivor.firstName}, merge ${loser.firstName}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
