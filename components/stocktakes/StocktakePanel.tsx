'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Play } from 'lucide-react';
import { useState } from 'react';

import { inputClass } from '@/components/purchasing/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  type Stocktake,
  cancelStocktake,
  completeStocktake,
  getStocktakes,
  saveStocktakeCounts,
  startStocktake,
} from '@/lib/api/stocktakes.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const STATUS_META = {
  in_progress: { label: 'In Progress', variant: 'warning' as const },
  completed: { label: 'Completed', variant: 'success' as const },
  cancelled: { label: 'Cancelled', variant: 'muted' as const },
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
    qc.invalidateQueries({ queryKey: ['stocktakes'] });
    qc.invalidateQueries({ queryKey: ['location-stock'] });
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
      qc.invalidateQueries({ queryKey: ['stocktakes'] });
      setCounts({});
      toast('success', 'Counts saved.');
    },
    onError: (err) => toast('error', err.message || 'Failed to save counts.'),
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
      toast('success', `Stocktake complete — ${res.adjustments ?? 0} variance ${res.adjustments === 1 ? 'adjustment' : 'adjustments'} applied.`);
    },
    onError: (err) => {
      setConfirm(null);
      toast('error', err.message || 'Failed to complete the stocktake.');
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelStocktake(stocktake.id),
    onSuccess: () => {
      invalidate();
      setConfirm(null);
      toast('info', 'Stocktake cancelled — nothing was applied.');
    },
    onError: (err) => toast('error', err.message || 'Failed to cancel.'),
  });

  return (
    <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div>
          <p className="font-semibold text-foreground">Counting in progress</p>
          <p className="text-xs text-muted-foreground">
            Started {fmtDateTime(stocktake.createdAt)} · {countedTotal} of {lines.length} counted
          </p>
        </div>
        <Badge variant="warning">In Progress</Badge>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted">
              <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Item</th>
              <th className="px-3 md:px-5 py-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Expected</th>
              <th className="px-3 md:px-5 py-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Counted</th>
              <th className="px-3 md:px-5 py-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Variance</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const value = valueFor(line.stockItemId, line.countedQty);
              const expected = Number(line.expectedQty);
              return (
                <tr key={line.id} className="border-b border-border/50 last:border-0">
                  <td className="px-3 md:px-5 py-2.5">
                    <p className="font-medium text-foreground">{line.stockItem?.name}</p>
                    <p className="text-[11px] text-muted-foreground">{line.stockItem?.unit}</p>
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
                    {value === '' ? '—' : `${Number(value) - expected > 0 ? '+' : ''}${(Number(value) - expected).toFixed(2).replace(/\.00$/, '')}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 px-5 py-3 border-t border-border shrink-0">
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
        <ConfirmModal
          title="Complete Stocktake"
          message={
            <>
              Apply the counted quantities? On-hand stock will be set to your counts and every variance recorded as an adjustment.
              Uncounted items are left untouched.
            </>
          }
          isPending={complete.isPending}
          onConfirm={() => complete.mutate()}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'cancel' && (
        <ConfirmModal
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

export function StocktakePanel({ locationId }: { locationId: string }) {
  const qc = useQueryClient();
  const [detail, setDetail] = useState<Stocktake | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['stocktakes', locationId],
    queryFn: () => getStocktakes({ locationId, limit: 30 }),
  });
  const stocktakes = data?.data ?? [];
  const activeId = stocktakes.find((s) => s.status === 'in_progress')?.id;

  // The list endpoint doesn't include lines — fetch the active one's detail.
  const { data: active } = useQuery({
    queryKey: ['stocktake', activeId],
    queryFn: async () => {
      const { getStocktake } = await import('@/lib/api/stocktakes.service');
      return getStocktake(activeId!);
    },
    enabled: !!activeId,
  });

  const start = useMutation({
    mutationFn: () => startStocktake({ locationId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocktakes'] });
      toast('success', 'Stocktake started — count each item and enter the physical quantity.');
    },
    onError: (err) => toast('error', err.message || 'Failed to start a stocktake.'),
  });

  if (activeId) {
    if (!active?.lines) return <div className="h-40 rounded-2xl bg-muted animate-pulse" />;
    return <ActiveCount stocktake={active} />;
  }

  return (
    <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <p className="font-semibold text-foreground">Stocktake history</p>
        <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending} className="gap-1.5">
          <Play size={14} />
          {start.isPending ? 'Starting…' : 'Start Stocktake'}
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : stocktakes.length === 0 ? (
          <div className="py-24">
            <EmptyState
              icon={ClipboardCheck}
              title="No stocktakes yet"
              description="Start one to count physical stock and reconcile variances."
            />
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted">
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date</th>
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Started by</th>
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {stocktakes.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setDetail(s)}
                  className="border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
                >
                  <td className="px-3 md:px-5 py-3.5 tabular-nums text-foreground">{fmtDateTime(s.createdAt)}</td>
                  <td className="px-3 md:px-5 py-3.5 text-muted-foreground">{s.startedByUser?.name ?? '—'}</td>
                  <td className="px-3 md:px-5 py-3.5">
                    <Badge variant={STATUS_META[s.status].variant}>{STATUS_META[s.status].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && <StocktakeDetailModal id={detail.id} onClose={() => setDetail(null)} />}
    </div>
  );
}

function StocktakeDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['stocktake', id],
    queryFn: async () => {
      const { getStocktake } = await import('@/lib/api/stocktakes.service');
      return getStocktake(id);
    },
  });

  return (
    <Modal title="Stocktake" onClose={onClose} className="max-w-xl">
      {!data ? (
        <div className="h-32 rounded-lg bg-muted animate-pulse" />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {fmtDateTime(data.createdAt)} · {STATUS_META[data.status].label}
            {data.startedByUser?.name ? ` · ${data.startedByUser.name}` : ''}
          </p>
          <div className="border border-border rounded-xl overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
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
                    <tr key={l.id} className="border-t border-border/50">
                      <td className="px-3 py-2 font-medium text-foreground">
                        {l.stockItem?.name} <span className="text-[11px] text-muted-foreground">{l.stockItem?.unit}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{expected}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{counted ?? '—'}</td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right tabular-nums font-semibold',
                          counted === null ? 'text-muted-foreground' : varianceClass(expected, counted),
                        )}
                      >
                        {counted === null ? '—' : `${counted - expected > 0 ? '+' : ''}${(counted - expected).toFixed(2).replace(/\.00$/, '')}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
