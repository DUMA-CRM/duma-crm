'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { MergeCustomersModal } from '@/components/customers/MergeCustomersModal';
import { AlertTriangle, Check, Combine, Mail, Users } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getDuplicateCandidates, mergeCustomers } from '@/lib/api/customers.service';
import { formatDate } from '@/lib/utils/date';
import type { Customer, DuplicatePair } from '@/types/customers';

/**
 * The duplicate review queue.
 *
 * `customers` is unique on (tenant, phone), so a duplicate always arrives with a
 * different number and nothing stops it — the cost is a regular's spend split
 * across two records so neither shows who they are.
 *
 * Detection is deliberately conservative and only ever *proposes*: an exact
 * shared email, or the same first and last name. A false merge is expensive to
 * notice, so a human confirms every one, choosing which record survives.
 */

const money = (value: string) => `£${Number(value).toFixed(0)}`;

/** The pair rows arrive flattened from SQL; the merge modal wants customers. */
function sideToCustomer(pair: DuplicatePair, side: 'a' | 'b'): Customer {
  const pick = <T,>(a: T, b: T) => (side === 'a' ? a : b);
  return {
    id: pick(pair.aId, pair.bId),
    tenantId: '',
    firstName: pick(pair.aFirstName, pair.bFirstName),
    lastName: pick(pair.aLastName, pair.bLastName),
    phone: pick(pair.aPhone, pair.bPhone),
    email: pick(pair.aEmail, pair.bEmail) ?? undefined,
    marketingOptIn: false,
    tier: 'bronze',
    pointsBalance: 0,
    totalVisits: pick(pair.aTotalVisits, pair.bTotalVisits),
    totalSpent: Number(pick(pair.aTotalSpent, pair.bTotalSpent)),
    lastVisitAt: pick(pair.aLastVisitAt, pair.bLastVisitAt) ?? undefined,
    createdAt: '',
    updatedAt: '',
  };
}

export function DuplicatesReview() {
  const router = useRouter();
  const qc = useQueryClient();
  const [pair, setPair] = useState<{ a: Customer; b: Customer } | null>(null);
  // Pairs the user has explicitly judged as "not the same person". Local only —
  // dismissing is a UI convenience, not a stored decision, and saying so stops
  // anyone relying on it surviving a reload.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-duplicates'],
    queryFn: () => getDuplicateCandidates(50),
  });

  const merge = useMutation({
    mutationFn: ({ survivorId, loserId }: { survivorId: string; loserId: string }) => mergeCustomers(survivorId, loserId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customer-duplicates'] });
      void qc.invalidateQueries({ queryKey: ['customers'] });
      setPair(null);
    },
  });

  const pairs = (data?.data ?? []).filter((row) => !dismissed.has(`${row.aId}|${row.bId}`));

  return (
    <EditorShell
      title="Duplicate customers"
      icon={<Combine size={20} aria-hidden="true" />}
      onClose={() => router.push('/customers')}
    >
      <div className="space-y-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Records that look like the same guest twice, strongest signal first. Merging keeps both records — the duplicate is hidden and
          pointed at the one you keep — so a mistake can be undone.
        </p>

        {isError ? (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-lg border border-exception/30 bg-card px-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-md bg-exception/8 text-exception">
              <AlertTriangle size={22} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-foreground">Could not check for duplicates</h2>
            <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-28 animate-pulse rounded-lg border border-rule/65 bg-card" />
            ))}
          </div>
        ) : pairs.length === 0 ? (
          <EmptyState
            icon={Check}
            title="No likely duplicates"
            description="Nothing shares an email address or a full name right now. Worth checking again after a busy period."
          />
        ) : (
          <ul className="space-y-3">
            {pairs.map((row) => {
              const key = `${row.aId}|${row.bId}`;
              const a = sideToCustomer(row, 'a');
              const b = sideToCustomer(row, 'b');

              return (
                <li key={key} className="rounded-lg border border-rule/65 bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant={row.signal === 'email' ? 'primary' : 'muted'} className="gap-1">
                      {row.signal === 'email' ? <Mail size={11} aria-hidden="true" /> : <Users size={11} aria-hidden="true" />}
                      {row.signal === 'email' ? 'Same email' : 'Same name'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Combined {money(String(Number(row.aTotalSpent) + Number(row.bTotalSpent)))} over{' '}
                      {row.aTotalVisits + row.bTotalVisits} visits
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[a, b].map((customer) => (
                      <div key={customer.id} className="rounded-md border border-rule/45 bg-background p-3">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{customer.phone}</p>
                        {customer.email && <p className="truncate text-xs text-muted-foreground">{customer.email}</p>}
                        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                          {money(String(customer.totalSpent))} · {customer.totalVisits} visits ·{' '}
                          {customer.lastVisitAt ? formatDate(customer.lastVisitAt) : 'never visited'}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDismissed((current) => new Set(current).add(key))}
                      title="Hide this pair for now. Not saved — it will reappear after a reload."
                    >
                      Not the same person
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => setPair({ a, b })}>
                      <Combine size={14} aria-hidden="true" />
                      Review &amp; merge
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pair && (
        <MergeCustomersModal
          a={pair.a}
          b={pair.b}
          isPending={merge.isPending}
          error={merge.error instanceof Error ? merge.error.message : null}
          onCancel={() => setPair(null)}
          onConfirm={(survivorId, loserId) => merge.mutate({ survivorId, loserId })}
        />
      )}
    </EditorShell>
  );
}
