'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, MapPin, Scale } from 'lucide-react';
import { Fragment, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { inputClass } from '@/components/purchasing/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { createDeductionBatch, getDeductionBatches, getPendingDeductions } from '@/lib/api/deductions.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const fmtVariance = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2).replace(/\.00$/, '')}`;

// ── Pending usage (with manager "apply now" fallback) ─────────────────────────

function PendingCard({ locationId }: { locationId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['pending-deductions', locationId],
    queryFn: () => getPendingDeductions(locationId),
  });
  const lines = data?.lines ?? [];
  const [applying, setApplying] = useState(false);
  const [adjusted, setAdjusted] = useState<Record<string, string>>({});
  const valueFor = (id: string, suggested: number) => adjusted[id] ?? String(suggested);

  const apply = useMutation({
    mutationFn: () =>
      createDeductionBatch({
        locationId,
        status: 'applied',
        lines: lines.map((l) => ({ stockItemId: l.stockItemId, deductedQty: Math.max(0, Number(valueFor(l.stockItemId, l.suggestedQty)) || 0) })),
      }),
    onSuccess: () => {
      for (const key of ['pending-deductions', 'deduction-batches', 'location-stock', 'inventory-forecast']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      setApplying(false);
      setAdjusted({});
      toast('success', 'Deduction applied.');
    },
    onError: (err) => toast('error', err.message || 'Failed to apply the deduction.'),
  });

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <p className="font-semibold text-foreground">Pending usage</p>
          <p className="text-xs text-muted-foreground">Recipe-derived usage not yet reconciled — suggested at the next clock-out.</p>
        </div>
        {lines.length > 0 && !applying && (
          <Button size="sm" variant="outline" onClick={() => setApplying(true)}>
            Apply now
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-5 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : lines.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-success font-medium">
          <CheckCircle2 size={16} aria-hidden="true" />
          All caught up — no unreconciled usage.
        </p>
      ) : (
        <div className="p-3 space-y-1">
          {lines.map((l) => (
            <div key={l.stockItemId} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-offset">
              <span className="flex-1 text-sm font-medium text-foreground truncate">{l.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                from {l.orderCount} {l.orderCount === 1 ? 'order' : 'orders'} · on hand {l.currentQuantity}
              </span>
              {applying ? (
                <input
                  value={valueFor(l.stockItemId, l.suggestedQty)}
                  onChange={(e) => setAdjusted((prev) => ({ ...prev, [l.stockItemId]: e.target.value }))}
                  inputMode="decimal"
                  aria-label={`Deduct ${l.name}`}
                  className={cn(inputClass, 'w-24 text-right tabular-nums')}
                />
              ) : (
                <span className="text-sm font-semibold text-foreground tabular-nums">{l.suggestedQty}</span>
              )}
              <span className="text-xs text-muted-foreground w-8">{l.unit}</span>
            </div>
          ))}
          {applying && (
            <div className="flex gap-2 pt-2 px-2">
              <Button variant="outline" size="sm" onClick={() => setApplying(false)} className="flex-1">
                Cancel
              </Button>
              <Button size="sm" onClick={() => apply.mutate()} disabled={apply.isPending} className="flex-1">
                {apply.isPending ? 'Applying…' : 'Apply Deduction'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Batch history ─────────────────────────────────────────────────────────────

function HistoryCard({ locationId }: { locationId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['deduction-batches', locationId],
    queryFn: () => getDeductionBatches({ locationId, limit: 30 }),
  });
  const batches = data?.data ?? [];

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <p className="font-semibold text-foreground">Deduction history</p>
        <p className="text-xs text-muted-foreground">What staff actually deducted vs the recipe suggestion — per end-of-shift batch.</p>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="py-16">
          <EmptyState icon={Scale} title="No deduction batches yet" description="Batches appear when staff reconcile usage at clock-out." />
        </div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="px-3 md:px-5 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">When</th>
              <th className="hidden md:table-cell px-5 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">By</th>
              <th className="px-3 md:px-5 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
              <th className="px-3 md:px-5 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Adjusted lines</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => {
              const adjustedCount = b.lines.filter((l) => Number(l.deductedQty) !== Number(l.suggestedQty)).length;
              const open = expanded === b.id;
              return (
                <Fragment key={b.id}>
                  <tr
                    onClick={() => setExpanded(open ? null : b.id)}
                    className="border-b border-border/50 hover:bg-surface-offset transition-colors cursor-pointer"
                  >
                    <td className="px-3 md:px-5 py-3 tabular-nums text-foreground">{fmtDateTime(b.createdAt)}</td>
                    <td className="hidden md:table-cell px-5 py-3 text-muted-foreground">{b.createdByUser?.name ?? '—'}</td>
                    <td className="px-3 md:px-5 py-3">
                      <Badge variant={b.status === 'applied' ? 'success' : 'warning'}>{b.status === 'applied' ? 'Applied' : 'Declined'}</Badge>
                    </td>
                    <td className={cn('px-3 md:px-5 py-3 text-right tabular-nums', adjustedCount > 0 ? 'text-warning font-semibold' : 'text-muted-foreground')}>
                      {adjustedCount} of {b.lines.length}
                    </td>
                    <td className="pr-4 text-right">
                      <ChevronDown size={14} className={cn('inline text-muted-foreground transition-transform', open && 'rotate-180')} />
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-border/50 bg-surface-offset/40">
                      <td colSpan={5} className="px-3 md:px-5 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              <th className="py-1 text-left">Item</th>
                              <th className="py-1 text-right">Suggested</th>
                              <th className="py-1 text-right">Deducted</th>
                              <th className="py-1 text-right">Variance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.lines.map((l) => {
                              const variance = Number(l.deductedQty) - Number(l.suggestedQty);
                              return (
                                <tr key={l.id} className="border-t border-border/40">
                                  <td className="py-1.5 font-medium text-foreground">
                                    {l.stockItem?.name} <span className="text-muted-foreground">{l.stockItem?.unit}</span>
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{Number(l.suggestedQty)}</td>
                                  <td className="py-1.5 text-right tabular-nums">{Number(l.deductedQty)}</td>
                                  <td className={cn('py-1.5 text-right tabular-nums font-semibold', variance === 0 ? 'text-success' : 'text-destructive')}>
                                    {fmtVariance(variance)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {b.notes && <p className="mt-2 text-[11px] text-muted-foreground">{b.notes}</p>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsagePage() {
  const { locationId } = useWorkspaceStore();

  return (
    <PageLayout eyebrow="Operations" title="Ingredient Usage" fullHeight headerBorder={false}>
      {!locationId ? (
        <EmptyState icon={MapPin} title="No location selected" description="Select a location from the header to monitor usage." />
      ) : (
        <div className="space-y-4 pb-6">
          <PendingCard locationId={locationId} />
          <HistoryCard locationId={locationId} />
        </div>
      )}
    </PageLayout>
  );
}
