'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Barcode, Boxes, CalendarDays, History, PackageOpen, Scale } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adjustStockUnit, getStockUnit, getStockUnitLedger, wasteStockUnit } from '@/lib/api/inventory.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';

const fmt = (value: string | number) => Number(value).toLocaleString('en-GB', { maximumFractionDigits: 3 });

export function StockUnitDetailPage({ stockUnitId }: { stockUnitId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState<string | null>(null);
  const [wasteQuantity, setWasteQuantity] = useState('');
  const [wasteReason, setWasteReason] = useState<'SPILL' | 'DAMAGED' | 'QUALITY' | 'EXPIRED' | 'OTHER'>('SPILL');
  const { data: unit, isLoading } = useQuery({ queryKey: ['stock-unit', stockUnitId], queryFn: () => getStockUnit(stockUnitId) });
  const { data: ledger = [] } = useQuery({ queryKey: ['stock-unit-ledger', stockUnitId], queryFn: () => getStockUnitLedger(stockUnitId) });

  const active = unit?.status === 'AVAILABLE' || unit?.status === 'IN_USE';

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['stock-unit', stockUnitId] });
    void queryClient.invalidateQueries({ queryKey: ['stock-unit-ledger', stockUnitId] });
    void queryClient.invalidateQueries({ queryKey: ['stock-units'] });
    void queryClient.invalidateQueries({ queryKey: ['inventory-overview'] });
    void queryClient.invalidateQueries({ queryKey: ['location-stock'] });
  };
  const adjust = useMutation({
    mutationFn: () => adjustStockUnit(stockUnitId, { quantity: Number(quantity ?? unit?.remainingQuantity ?? 0), reason: 'COUNT_CORRECTION' }),
    onSuccess: () => { setQuantity(null); refresh(); toast('success', 'Container balance adjusted.'); },
    onError: (error) => toast('error', error.message || 'Unable to adjust the container.'),
  });
  const waste = useMutation({
    mutationFn: () => wasteStockUnit(stockUnitId, { quantity: Number(wasteQuantity), reason: wasteReason }),
    onSuccess: () => { setWasteQuantity(''); refresh(); toast('success', 'Waste recorded in the ledger.'); },
    onError: (error) => toast('error', error.message || 'Unable to record waste.'),
  });

  const backHref = unit ? `/inventory/items/${unit.stockItemId}` : '/inventory';

  return (
    // In-page full-height panel — same shell as the employee & menu item pages.
    <div className="flex flex-col -m-4 md:-m-8 h-[calc(100vh-var(--header-height))] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-8 py-3.5 border-b border-border shrink-0 bg-card">
        <Button variant="ghost" size="icon" onClick={() => router.push(backHref)} aria-label="Back to item" className="size-11 shrink-0">
          <ArrowLeft size={20} />
        </Button>
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <PackageOpen size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 w-full flex justify-between">
          <div>
						<p className="text-[10px] font-bold text-primary uppercase tracking-widest">Physical Stock Unit</p>
          	<h1 className="text-lg font-semibold text-foreground truncate">{unit?.label ?? (isLoading ? 'Loading…' : 'Stock unit')}</h1>
					</div>
          {unit && (
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={active ? 'success' : unit.status === 'EXPIRED' ? 'destructive' : 'muted'}>{unit.status.replace('_', ' ')}</Badge>
              <span className="text-xs text-muted-foreground">{fmt(unit.remainingQuantity)} {unit.unitOfMeasure} left</span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-8xl mx-auto p-4 md:p-8 space-y-4">
          {unit && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat icon={Scale} label="Remaining" value={`${fmt(unit.remainingQuantity)} / ${fmt(unit.initialQuantity)} ${unit.unitOfMeasure}`} />
                <Stat icon={CalendarDays} label="Expiry" value={unit.expiryDate ? new Date(unit.expiryDate).toLocaleDateString('en-GB') : 'N/A'} />
                <Stat icon={PackageOpen} label="Status" value={unit.status.replace('_', ' ')} />
                <Stat icon={Barcode} label="Lot / barcode" value={unit.lotNumber || unit.barcode || 'Not recorded'} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4 items-start">
                <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Scale size={15} className="text-primary" />
                    <div>
                      <h2 className="font-semibold text-foreground">Adjust physical balance</h2>
                      <p className="text-xs text-muted-foreground">Use after a count correction. The change is written to the unit ledger.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input value={quantity ?? unit.remainingQuantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" className="h-9 flex-1 rounded-lg bg-surface-offset px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                    <Button onClick={() => adjust.mutate()} disabled={adjust.isPending}>Save balance</Button>
                  </div>
                </section>
                <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Boxes size={15} className="text-primary" />
                    <div>
                      <h2 className="font-semibold text-foreground">Record waste</h2>
                      <p className="text-xs text-muted-foreground">For spills, damage, expiry or quality issues.</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input value={wasteQuantity} onChange={(event) => setWasteQuantity(event.target.value)} placeholder="Quantity" inputMode="decimal" className="h-9 min-w-0 flex-1 rounded-lg bg-surface-offset px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                    <select value={wasteReason} onChange={(event) => setWasteReason(event.target.value as typeof wasteReason)} className="h-9 rounded-lg bg-surface-offset px-3 text-sm">
                      <option>SPILL</option><option>DAMAGED</option><option>QUALITY</option><option>EXPIRED</option><option>OTHER</option>
                    </select>
                    <Button variant="destructive" onClick={() => waste.mutate()} disabled={waste.isPending || !(Number(wasteQuantity) > 0)}>Log waste</Button>
                  </div>
                </section>
              </div>

              <section className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center gap-2"><History size={15} className="text-muted-foreground" /><h2 className="font-semibold text-foreground">Container history</h2></div>
                {ledger.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No movements recorded.</p> : <div className="divide-y divide-border/50">{ledger.map((movement) => <div key={movement.id} className="px-5 py-3 flex items-center gap-4"><Badge variant={Number(movement.quantity) < 0 ? 'amber' : 'success'}>{movement.type.toUpperCase()}</Badge><div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground">{movement.reason?.replaceAll('_', ' ') ?? 'Stock movement'}</p><p className="text-xs text-muted-foreground">{movement.sourceType ?? 'LEGACY'}{movement.sourceId ? ` · ${movement.sourceId.slice(0, 12)}` : ''}{movement.orderId ? <> · <Link href={`/orders?order=${movement.orderId}`} className="text-primary hover:underline">View order</Link></> : null}</p></div><span className={cn('font-semibold tabular-nums', Number(movement.quantity) < 0 ? 'text-destructive' : 'text-success')}>{Number(movement.quantity) > 0 ? '+' : ''}{fmt(movement.quantity)} {movement.unitOfMeasure}</span><time className="hidden md:block text-xs text-muted-foreground">{new Date(movement.createdAt).toLocaleString('en-GB')}</time></div>)}</div>}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Scale; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Icon size={14} aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-base font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
