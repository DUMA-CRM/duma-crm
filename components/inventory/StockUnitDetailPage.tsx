'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Barcode, Boxes, CalendarDays, History, PackageOpen, Scale } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { StatCard, StatCardGrid } from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { adjustStockUnit, getStockUnit, getStockUnitLedger, wasteStockUnit } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatDateTime } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';

const fmt = (value: string | number) => Number(value).toLocaleString('en-GB', { maximumFractionDigits: 3 });

export function StockUnitDetailPage({ stockUnitId }: { stockUnitId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState<string | null>(null);
  const [wasteQuantity, setWasteQuantity] = useState('');
  const [wasteReason, setWasteReason] = useState<'SPILL' | 'DAMAGED' | 'QUALITY' | 'EXPIRED' | 'OTHER'>('SPILL');
  const { data: unit, isLoading } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stock-unit', stockUnitId),
    queryFn: () => getStockUnit(stockUnitId),
  });
  const { data: ledger = [] } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stock-unit-ledger', stockUnitId),
    queryFn: () => getStockUnitLedger(stockUnitId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-unit', stockUnitId) });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-unit-ledger', stockUnitId) });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-units') });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('inventory-overview') });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('location-stock') });
  };
  const adjust = useMutation({
    mutationFn: () =>
      adjustStockUnit(stockUnitId, { quantity: Number(quantity ?? unit?.remainingQuantity ?? 0), reason: 'COUNT_CORRECTION' }),
    onSuccess: () => {
      setQuantity(null);
      refresh();
      toast('success', 'Container balance adjusted.');
    },
    onError: (error) => toast('error', error.message || 'The container balance wasn’t adjusted. Review the quantity and try again.'),
  });
  const waste = useMutation({
    mutationFn: () => wasteStockUnit(stockUnitId, { quantity: Number(wasteQuantity), reason: wasteReason }),
    onSuccess: () => {
      setWasteQuantity('');
      refresh();
      toast('success', 'Waste recorded in the ledger.');
    },
    onError: (error) => toast('error', error.message || 'The waste wasn’t recorded. Review the quantity and try again.'),
  });

  const backHref = unit ? `/inventory/items/${unit.stockItemId}` : '/inventory';

  return (
    <EditorShell
      eyebrow="Physical stock unit"
      title={unit?.label ?? (isLoading ? 'Loading…' : 'Stock unit')}
      icon={<PackageOpen size={20} aria-hidden="true" />}
      onClose={() => router.push(backHref)}
    >
      <div className="space-y-4">
        {unit && (
          <>
            <StatCardGrid>
              <StatCard
                size="sm"
                icon={Scale}
                label="Remaining"
                value={`${fmt(unit.remainingQuantity)} / ${fmt(unit.initialQuantity)} ${unit.unitOfMeasure}`}
              />
              <StatCard size="sm" icon={CalendarDays} label="Expiry" value={formatDate(unit.expiryDate, 'N/A')} />
              <StatCard size="sm" icon={PackageOpen} label="Status" value={unit.status.replace('_', ' ')} />
              <StatCard size="sm" icon={Barcode} label="Lot / barcode" value={unit.lotNumber || unit.barcode || 'Not recorded'} />
            </StatCardGrid>

            <div className="grid lg:grid-cols-2 gap-4 items-start">
              <section className="rounded-sm border border-rule bg-card shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Scale size={15} className="text-primary" />
                  <div>
                    <h2 className="font-semibold text-foreground">Adjust physical balance</h2>
                    <p className="text-xs text-muted-foreground">Use after a count correction. The change is written to the unit ledger.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    value={quantity ?? unit.remainingQuantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    inputMode="decimal"
                    className="h-9 flex-1 rounded-sm bg-band px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <Button onClick={() => adjust.mutate()} disabled={adjust.isPending}>
                    Save balance
                  </Button>
                </div>
              </section>
              <section className="rounded-sm border border-rule bg-card shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Boxes size={15} className="text-primary" />
                  <div>
                    <h2 className="font-semibold text-foreground">Record waste</h2>
                    <p className="text-xs text-muted-foreground">For spills, damage, expiry or quality issues.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    value={wasteQuantity}
                    onChange={(event) => setWasteQuantity(event.target.value)}
                    placeholder="Quantity"
                    inputMode="decimal"
                    className="h-9 min-w-0 flex-1 rounded-sm bg-band px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <Select
                    value={wasteReason}
                    onValueChange={(value) => setWasteReason(value as typeof wasteReason)}
                    options={['SPILL', 'DAMAGED', 'QUALITY', 'EXPIRED', 'OTHER'].map((value) => ({ value, label: value }))}
                    ariaLabel="Waste reason"
                    className="bg-band"
                  />
                  <Button variant="destructive" onClick={() => waste.mutate()} disabled={waste.isPending || !(Number(wasteQuantity) > 0)}>
                    Log waste
                  </Button>
                </div>
              </section>
            </div>

            <section className="rounded-sm border border-rule bg-card shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-rule flex items-center gap-2">
                <History size={15} className="text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Container history</h2>
              </div>
              {ledger.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">No movements recorded.</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {ledger.map((movement) => (
                    <div key={movement.id} className="px-5 py-3 flex items-center gap-4">
                      <Badge variant={Number(movement.quantity) < 0 ? 'amber' : 'success'}>{movement.type.toUpperCase()}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{movement.reason?.replaceAll('_', ' ') ?? 'Stock movement'}</p>
                        <p className="text-xs text-muted-foreground">
                          {movement.sourceType ?? 'LEGACY'}
                          {movement.sourceId ? ` · ${movement.sourceId.slice(0, 12)}` : ''}
                          {movement.orderId ? (
                            <>
                              {' '}
                              ·{' '}
                              <Link href={`/orders?order=${movement.orderId}`} className="text-primary hover:underline">
                                View order
                              </Link>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <span
                        className={cn('font-semibold tabular-nums', Number(movement.quantity) < 0 ? 'text-destructive' : 'text-success')}
                      >
                        {Number(movement.quantity) > 0 ? '+' : ''}
                        {fmt(movement.quantity)} {movement.unitOfMeasure}
                      </span>
                      <time className="hidden md:block text-xs text-muted-foreground">{formatDateTime(movement.createdAt)}</time>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </EditorShell>
  );
}
