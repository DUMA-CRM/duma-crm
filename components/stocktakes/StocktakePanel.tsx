'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ChevronRight, ClipboardCheck, Play } from '@/components/icons';
import { inputClass } from '@/components/purchasing/shared';
import { ConfirmDrawer } from '@/components/shared/ConfirmDrawer';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';

import {
  type Stocktake,
  cancelStocktake,
  completeStocktake,
  getStocktakes,
  saveStocktakeCounts,
  startStocktake,
} from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDateTime as formatAppDateTime } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';

const fmtDateTime = (iso: string) => formatAppDateTime(iso);

const STATUS_META = {
  in_progress: { label: 'In Progress', variant: 'warning' as const, dot: 'bg-warning' },
  completed: { label: 'Completed', variant: 'success' as const, dot: 'bg-success' },
  cancelled: { label: 'Cancelled', variant: 'muted' as const, dot: 'bg-muted-foreground/40' },
};

function varianceClass(expected: number, counted: number): string {
  const variance = counted - expected;
  if (variance === 0) return 'text-success';
  if (expected > 0 && Math.abs(variance) / expected > 0.1) return 'text-destructive';
  return 'text-warning';
}

// ── Active guided count ───────────────────────────────────────────────────────

function ActiveCount({ stocktake }: { stocktake: Stocktake }) {
  const qc = useQueryClient();
  // Local draft of counts keyed by stock item; unset = server value.
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<'complete' | 'cancel' | null>(null);

  const lines = stocktake.lines ?? [];
  const valueFor = (stockItemId: string, server?: string | null) => counts[stockItemId] ?? (server != null ? String(Number(server)) : '');
  const countedTotal = lines.filter((l) => valueFor(l.stockItemId, l.countedQty) !== '').length;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stocktakes') });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('location-stock') });
  };

  const save = useMutation({
    mutationFn: () =>
      saveStocktakeCounts(
        stocktake.id,
        lines.map((l) => {
          const v = valueFor(l.stockItemId, l.countedQty);
          return { stockItemId: l.stockItemId, countedQty: v === '' ? null : Number(v) };
        }),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stocktakes') });
      setCounts({});
      toast('success', 'Counts saved.');
    },
    onError: (err) => toast('error', err.message || 'The counts weren’t saved. Check the quantities and try again.'),
  });

  const complete = useMutation({
    mutationFn: async () => {
      // Persist any unsaved edits first, then apply variances.
      await saveStocktakeCounts(
        stocktake.id,
        lines.map((l) => {
          const v = valueFor(l.stockItemId, l.countedQty);
          return { stockItemId: l.stockItemId, countedQty: v === '' ? null : Number(v) };
        }),
      );
      return completeStocktake(stocktake.id);
    },
    onSuccess: (res) => {
      invalidate();
      setConfirm(null);
      toast(
        'success',
        `Stocktake complete — ${res.adjustments ?? 0} variance ${res.adjustments === 1 ? 'adjustment' : 'adjustments'} applied.`,
      );
    },
    onError: (err) => {
      setConfirm(null);
      toast('error', err.message || 'The stocktake wasn’t completed. Review the counts and try again.');
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelStocktake(stocktake.id),
    onSuccess: () => {
      invalidate();
      setConfirm(null);
      toast('info', 'Stocktake cancelled — nothing was applied.');
    },
    onError: (err) => toast('error', err.message || 'The stocktake wasn’t cancelled. Try again.'),
  });

  return (
    <div className="min-h-0 bg-card border border-rule rounded-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-rule shrink-0">
        <div>
          <p className="font-semibold text-foreground">Counting in progress</p>
          <p className="text-xs text-muted-foreground">
            Started {fmtDateTime(stocktake.createdAt)} · {countedTotal} of {lines.length} counted
          </p>
        </div>
        <Badge variant="warning">In Progress</Badge>
      </div>

      <div className="flex-1 overflow-auto">
        <DataTable className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-rule bg-muted">
              <th className="px-3 md:px-5 py-3.5 text-left text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                Item
              </th>
              <th className="px-3 md:px-5 py-3.5 text-right text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                Expected
              </th>
              <th className="px-3 md:px-5 py-3.5 text-right text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                Counted
              </th>
              <th className="px-3 md:px-5 py-3.5 text-right text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                Variance
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const value = valueFor(line.stockItemId, line.countedQty);
              const expected = Number(line.expectedQty);
              return (
                <tr key={line.id} className="border-b border-rule last:border-0">
                  <td className="px-3 md:px-5 py-2.5">
                    <p className="font-medium text-foreground">{line.stockItem?.name}</p>
                    <p className="text-label text-muted-foreground">{line.stockItem?.unit}</p>
                  </td>
                  <td className="px-3 md:px-5 py-2.5 text-right tabular-nums text-muted-foreground">{Number(line.expectedQty)}</td>
                  <td className="px-3 md:px-5 py-2.5 text-right">
                    <input
                      value={value}
                      onChange={(e) => setCounts((prev) => ({ ...prev, [line.stockItemId]: e.target.value }))}
                      inputMode="decimal"
                      placeholder="—"
                      aria-label={`Counted ${line.stockItem?.name}`}
                      className={cn(inputClass, 'w-24 h-10 text-right tabular-nums inline-block')}
                    />
                  </td>
                  <td
                    className={cn(
                      'px-3 md:px-5 py-2.5 text-right tabular-nums font-semibold',
                      value === '' ? 'text-muted-foreground' : varianceClass(expected, Number(value)),
                    )}
                  >
                    {value === ''
                      ? '—'
                      : `${Number(value) - expected > 0 ? '+' : ''}${(Number(value) - expected).toFixed(2).replace(/\.00$/, '')}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </div>

      <div className="flex gap-2 px-5 py-3 border-t border-rule shrink-0">
        <Button variant="outline" onClick={() => setConfirm('cancel')} className="text-destructive hover:text-destructive">
          Cancel Stocktake
        </Button>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save Counts'}
        </Button>
        <Button onClick={() => setConfirm('complete')} disabled={complete.isPending || countedTotal === 0}>
          Complete Stocktake
        </Button>
      </div>

      {confirm === 'complete' && (
        <ConfirmDrawer
          title="Complete Stocktake"
          message={
            <>
              Apply the counted quantities? On-hand stock will be set to your counts and every variance recorded as an adjustment. Uncounted
              items are left untouched.
            </>
          }
          isPending={complete.isPending}
          onConfirm={() => complete.mutate()}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'cancel' && (
        <ConfirmDrawer
          title="Cancel Stocktake"
          message={<>Abandon this stocktake? No adjustments will be applied.</>}
          isPending={cancel.isPending}
          onConfirm={() => cancel.mutate()}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── History + start ───────────────────────────────────────────────────────────

/** The location's stocktakes, plus the id of the one being counted right now. */
function useStocktakes(locationId: string) {
  const { data, isLoading } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stocktakes', locationId),
    queryFn: () => getStocktakes({ locationId, limit: 30 }),
  });
  const stocktakes = data?.data ?? [];
  return { stocktakes, activeId: stocktakes.find((s) => s.status === 'in_progress')?.id, isLoading };
}

/**
 * "Start Stocktake" for the page header, next to the title rather than on the
 * panel. It shares the list query with `StocktakePanel`, so it disappears the
 * moment a count is running — there can only be one open at a time.
 */
export function StartStocktakeButton({ locationId }: { locationId: string }) {
  const qc = useQueryClient();
  const { activeId } = useStocktakes(locationId);

  const start = useMutation({
    mutationFn: () => startStocktake({ locationId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stocktakes') });
      toast('success', 'Stocktake started — count each item and enter the physical quantity.');
    },
    onError: (err) => toast('error', err.message || 'The stocktake didn’t start. Try again.'),
  });

  if (activeId) return null;

  return (
    <Button onClick={() => start.mutate()} disabled={start.isPending} className="h-10 gap-1.5">
      <Play size={15} aria-hidden="true" />
      <span className="hidden md:inline">{start.isPending ? 'Starting…' : 'Start Stocktake'}</span>
    </Button>
  );
}

export function StocktakePanel({ locationId }: { locationId: string }) {
  const [detail, setDetail] = useState<Stocktake | null>(null);
  const { stocktakes, activeId, isLoading } = useStocktakes(locationId);

  // The list endpoint doesn't include lines — fetch the active one's detail.
  const { data: active } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stocktake', activeId),
    queryFn: async () => {
      const { getStocktake } = await import('@/lib/modules/inventory/client');
      return getStocktake(activeId!);
    },
    enabled: !!activeId,
  });

  if (activeId) {
    if (!active?.lines) return <div className="h-40 rounded-sm bg-muted animate-pulse" />;
    return <ActiveCount stocktake={active} />;
  }

  return (
    <>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : stocktakes.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No stocktakes yet"
          description="Start one to count physical stock and reconcile variances."
        />
      ) : (
        // A log of events, not a dataset — nothing here is worth comparing down a
        // column, so it reads as a timeline rather than a table.
        <ol>
          {stocktakes.map((s, index) => (
            <li key={s.id} className="relative flex gap-3">
              {/* The rail: a line into the dot from above and out of it below, clipped
                  at the first and last entry so the timeline has ends. */}
              <span className="relative flex w-3 shrink-0 justify-center" aria-hidden="true">
                {index > 0 && <span className="absolute top-0 h-5 w-px bg-border" />}
                {index < stocktakes.length - 1 && <span className="absolute top-5 bottom-0 w-px bg-border" />}
                <span className={cn('absolute top-5 size-2.5 -translate-y-1/2 rounded-full', STATUS_META[s.status].dot)} />
              </span>
              <button
                type="button"
                onClick={() => setDetail(s)}
                className="flex flex-1 items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors hover:bg-band"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium tabular-nums text-foreground">{fmtDateTime(s.createdAt)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {STATUS_META[s.status].label}
                    {s.startedByUser?.name ? ` · ${s.startedByUser.name}` : ''}
                  </span>
                </span>
                <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {detail && <StocktakeDetailDrawer id={detail.id} onClose={() => setDetail(null)} />}
    </>
  );
}

function StocktakeDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stocktake', id),
    queryFn: async () => {
      const { getStocktake } = await import('@/lib/modules/inventory/client');
      return getStocktake(id);
    },
  });

  return (
    <Drawer
      title="Stocktake"
      description={
        data
          ? `${fmtDateTime(data.createdAt)} · ${STATUS_META[data.status].label}${data.startedByUser?.name ? ` · ${data.startedByUser.name}` : ''}`
          : undefined
      }
      onClose={onClose}
    >
      {!data ? (
        <div className="h-32 animate-pulse rounded-sm bg-muted" />
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-sm border border-rule">
            <DataTable className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Expected</th>
                  <th className="px-3 py-2 text-right">Counted</th>
                  <th className="px-3 py-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {(data.lines ?? []).map((l) => {
                  const expected = Number(l.expectedQty);
                  const counted = l.countedQty != null ? Number(l.countedQty) : null;
                  return (
                    <tr key={l.id} className="border-t border-rule">
                      <td className="px-3 py-2 font-medium text-foreground">
                        {l.stockItem?.name} <span className="text-label text-muted-foreground">{l.stockItem?.unit}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{expected}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{counted ?? '—'}</td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right tabular-nums font-semibold',
                          counted === null ? 'text-muted-foreground' : varianceClass(expected, counted),
                        )}
                      >
                        {counted === null
                          ? '—'
                          : `${counted - expected > 0 ? '+' : ''}${(counted - expected).toFixed(2).replace(/\.00$/, '')}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}
    </Drawer>
  );
}
