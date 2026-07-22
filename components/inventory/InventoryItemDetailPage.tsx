'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Box, CalendarClock, History, Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getStockItem, getStockItemMovements, getStockUnits, receiveStockUnits } from '@/lib/api/inventory.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const fmt = (value: string | number) => Number(value).toLocaleString('en-GB', { maximumFractionDigits: 3 });
const when = (value: string) => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function InventoryItemDetailPage({ stockItemId }: { stockItemId: string }) {
  const router = useRouter();
  const { locationId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [containerQuantity, setContainerQuantity] = useState('');
  const [containerCount, setContainerCount] = useState('1');
  const [expiryDate, setExpiryDate] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['stock-item', stockItemId],
    queryFn: () => getStockItem(stockItemId),
  });
  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['stock-units', locationId, stockItemId],
    queryFn: () => getStockUnits({ locationId: locationId ?? undefined, stockItemId }),
    enabled: !!locationId,
  });
  const { data: ledger } = useQuery({
    queryKey: ['stock-movements', stockItemId, 'detail'],
    queryFn: () => getStockItemMovements(stockItemId, { limit: 100 }),
  });

  const active = units.filter((unit) => unit.status === 'AVAILABLE' || unit.status === 'IN_USE');
  const onHand = active.reduce((sum, unit) => sum + Number(unit.remainingQuantity), 0);
  const earliestExpiry = active
    .map((unit) => unit.expiryDate)
    .filter((value): value is string => !!value)
    .sort()[0];
  const receive = useMutation({
    mutationFn: () => {
      if (!locationId || !item) throw new Error('Select a location first.');
      const quantity = Number(containerQuantity);
      const count = Number(containerCount);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(count) || count <= 0) throw new Error('Enter a valid container quantity and count.');
      if (item.isPerishable && !expiryDate) throw new Error('Expiry date is required for perishable stock.');
      return receiveStockUnits({
        locationId,
        stockItemId,
        units: Array.from({ length: count }, () => ({
          initialQuantity: quantity,
          expiryDate: expiryDate || null,
          lotNumber: lotNumber.trim() || undefined,
        })),
      });
    },
    onSuccess: () => {
      setContainerQuantity('');
      setLotNumber('');
      void queryClient.invalidateQueries({ queryKey: ['stock-units', locationId, stockItemId] });
      void queryClient.invalidateQueries({ queryKey: ['stock-movements', stockItemId] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-overview', locationId] });
      void queryClient.invalidateQueries({ queryKey: ['location-stock', locationId] });
      toast('success', 'Physical stock units received.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });

  return (
    // In-page full-height panel — same shell as the employee & menu item pages.
    <div className="flex flex-col -m-4 md:-m-8 h-[calc(100vh-var(--header-height))] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-8 py-3.5 border-b border-border shrink-0 bg-card">
        <Button variant="ghost" size="icon" onClick={() => router.push('/inventory')} aria-label="Back to inventory" className="size-11 shrink-0">
          <ArrowLeft size={20} />
        </Button>
        <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Package size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 w-full flex justify-between">
          <div>
						<p className="text-[10px] font-bold text-primary uppercase tracking-widest">Inventory Item</p>
          	<h1 className="text-lg font-semibold text-foreground truncate">{item?.name ?? (itemLoading ? 'Loading…' : 'Inventory item')}</h1>
					</div>
          {item && (
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="muted">{item.category}</Badge>
              <span className="text-xs text-muted-foreground">{item.unit}</span>
              {item.isPerishable && <Badge variant="amber">Perishable</Badge>}
              {!item.isActive && <Badge variant="muted">Inactive</Badge>}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-8xl mx-auto p-4 md:p-8 space-y-4">
          {item && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="On hand" value={`${fmt(onHand)} ${item.unit}`} icon={Package} />
              <Stat label="Active containers" value={String(active.length)} icon={Box} />
              <Stat label="Earliest expiry" value={earliestExpiry ? new Date(earliestExpiry).toLocaleDateString('en-GB') : 'N/A'} icon={CalendarClock} />
              <Stat label="Category" value={item.category} icon={History} />
            </div>
          )}

          {item && locationId && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Plus size={15} className="text-primary" />
                <div>
                  <h2 className="font-semibold text-foreground">Receive physical containers</h2>
                  <p className="text-xs text-muted-foreground">Each container gets its own balance and ledger entry.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
                <Input label={`QUANTITY PER CONTAINER (${item.unit})`} type="number" min={0.001} step="any" value={containerQuantity} onChange={(event) => setContainerQuantity(event.target.value)} />
                <Input label="CONTAINER COUNT" type="number" min={1} step={1} value={containerCount} onChange={(event) => setContainerCount(event.target.value)} />
                <Input label={item.isPerishable ? 'EXPIRY (REQUIRED)' : 'EXPIRY'} type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
                <Input label="LOT NUMBER" value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} />
                <Button onClick={() => receive.mutate()} disabled={receive.isPending}>{receive.isPending ? 'Receiving…' : 'Receive containers'}</Button>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="font-semibold text-foreground">Physical stock units</h2>
              <p className="text-xs text-muted-foreground">Containers are ordered by expiry, matching FEFO consumption.</p>
            </div>
            {!locationId ? (
              <div className="py-16"><EmptyState icon={Package} title="Select a location" description="Choose a location to inspect its containers." /></div>
            ) : unitsLoading ? (
              <p className="p-5 text-sm text-muted-foreground">Loading containers…</p>
            ) : units.length === 0 ? (
              <div className="py-16"><EmptyState icon={Box} title="No stock units" description="Receive a delivery or add a physical container to begin unit tracking." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="px-5 py-3 text-left">Container</th><th className="px-5 py-3 text-left">Lot</th>
                    <th className="px-5 py-3 text-right">Remaining</th><th className="px-5 py-3 text-left">Expiry</th><th className="px-5 py-3 text-left">Status</th>
                  </tr></thead>
                  <tbody>{units.map((unit) => (
                    <tr key={unit.id} className="border-b border-border/50 last:border-0 hover:bg-surface-offset/50">
                      <td className="px-5 py-3"><Link href={`/inventory/units/${unit.id}`} className="font-medium text-primary hover:underline">{unit.label}</Link></td>
                      <td className="px-5 py-3 text-muted-foreground">{unit.lotNumber || '—'}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmt(unit.remainingQuantity)} / {fmt(unit.initialQuantity)} {unit.unitOfMeasure}</td>
                      <td className="px-5 py-3 tabular-nums">{unit.expiryDate ? new Date(unit.expiryDate).toLocaleDateString('en-GB') : '—'}</td>
                      <td className="px-5 py-3"><Badge variant={unit.status === 'AVAILABLE' || unit.status === 'IN_USE' ? 'success' : unit.status === 'EXPIRED' ? 'destructive' : 'muted'}>{unit.status.replace('_', ' ')}</Badge></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2"><History size={15} className="text-muted-foreground" /><h2 className="font-semibold text-foreground">Ledger timeline</h2></div>
            {(ledger?.data ?? []).length === 0 ? <p className="p-5 text-sm text-muted-foreground">No movements recorded.</p> : (
              <div className="divide-y divide-border/50">{ledger?.data.map((movement) => (
                <div key={movement.id} className="px-5 py-3 flex items-center gap-4">
                  <Badge variant={Number(movement.quantity) < 0 ? 'amber' : 'success'}>{movement.type.toUpperCase()}</Badge>
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">{movement.reason?.replaceAll('_', ' ') ?? movement.notes ?? 'Stock movement'}</p><p className="text-xs text-muted-foreground">{movement.stockUnit?.label ?? 'Stock unit'} · {movement.sourceType}{movement.orderId ? <> · <Link href={`/orders?order=${movement.orderId}`} className="text-primary hover:underline">View order</Link></> : null}</p></div>
                  <span className={cn('font-semibold tabular-nums', Number(movement.quantity) < 0 ? 'text-destructive' : 'text-success')}>{Number(movement.quantity) > 0 ? '+' : ''}{fmt(movement.quantity)} {movement.unitOfMeasure ?? item?.unit}</span>
                  <time className="hidden md:block text-xs text-muted-foreground tabular-nums">{when(movement.createdAt)}</time>
                </div>
              ))}</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Package }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Icon size={14} aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
