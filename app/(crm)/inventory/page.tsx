'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Package, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { StockDetailSidebar } from '@/components/inventory/stock/StockDetailSidebar';
import { AddItemModal, AdjustModal, EditStockItemModal, EditThresholdModal, LogLossModal, RestockModal } from '@/components/inventory/stock/StockModals';
import {
  STATUS_BAR,
  STATUS_ICON_BG,
  STATUS_ICON_FG,
  STATUS_LABEL,
  STATUS_VARIANT,
  type StockRow,
  daysColor,
  fmtQty,
  getStatus,
  normaliseArray,
  stockPct,
} from '@/components/inventory/stock/shared';
import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatCard } from '@/components/shared/StatCard';
import { Toast, type ToastMessage } from '@/components/shared/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  type InventoryForecast,
  type LocationStock,
  getInventoryForecast,
  getLocationStock,
  removeLocationStock,
  updateLocationStock,
} from '@/lib/api/inventory.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const GRID = 'grid-cols-[2fr_1fr_1fr_1.6fr_1fr_0.9fr]';

export default function InventoryPage() {
  const { tenantId, locationId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Modal targets
  const [adjustTarget, setAdjustTarget] = useState<LocationStock | null>(null);
  const [thresholdTarget, setThresholdTarget] = useState<LocationStock | null>(null);
  const [restockTarget, setRestockTarget] = useState<LocationStock | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editItemTarget, setEditItemTarget] = useState<StockRow | null>(null);
  const [lossModal, setLossModal] = useState<{ locationId?: string; stockItemId?: string } | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error', message: string) => setToasts((prev) => [...prev, { id: Date.now(), type, message }]);
  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  function invalidateStock() {
    void queryClient.invalidateQueries({ queryKey: ['location-stock', locationId] });
    void queryClient.invalidateQueries({ queryKey: ['inventory-forecast', locationId] });
  }

  const { data: rawStock, isLoading } = useQuery({
    queryKey: ['location-stock', locationId],
    queryFn: () => getLocationStock(locationId!),
    enabled: !!locationId,
  });

  const { data: rawForecast } = useQuery({
    queryKey: ['inventory-forecast', locationId],
    queryFn: () => getInventoryForecast(locationId!),
    enabled: !!locationId,
  });

  const { mutate: toggleAvailable } = useMutation({
    mutationFn: (item: LocationStock) => updateLocationStock(item.id, { isAvailable: !item.isAvailable }),
    onSuccess: () => { invalidateStock(); addToast('success', 'Availability updated.'); },
    onError: () => addToast('error', 'Failed to update availability.'),
  });

  const { mutate: removeItem } = useMutation({
    mutationFn: (id: string) => removeLocationStock(id),
    onSuccess: () => { setSelectedId(null); invalidateStock(); addToast('success', 'Item removed.'); },
    onError: () => addToast('error', 'Failed to remove item.'),
  });

  const allStock = useMemo(() => normaliseArray<LocationStock>(rawStock), [rawStock]);

  const forecastMap = useMemo(() => {
    const m = new Map<string, InventoryForecast>();
    normaliseArray<InventoryForecast>(rawForecast).forEach((f) => m.set(f.locationStockId, f));
    return m;
  }, [rawForecast]);

  const enriched = useMemo<StockRow[]>(
    () => allStock.map((s) => ({
      ...s,
      status: getStatus(s),
      qty: parseFloat(s.quantity),
      threshold: parseFloat(s.lowThreshold),
      forecast: forecastMap.get(s.id),
    })),
    [allStock, forecastMap],
  );

  const filtered = useMemo(() => enriched.filter((s) => {
    if (search && !(s.stockItem?.name ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [enriched, search]);

  const selectedItem = useMemo(() => enriched.find((s) => s.id === selectedId) ?? null, [enriched, selectedId]);
  const existingIds = useMemo(() => new Set(allStock.map((s) => s.stockItemId)), [allStock]);

  const outCount = enriched.filter((s) => s.status === 'out').length;
  const attentionCount = enriched.filter((s) => s.status === 'low' || s.status === 'critical' || s.status === 'out').length;
  const soonCount = enriched.filter((s) => s.forecast && s.forecast.daysOfStockRemaining <= 7).length;

  const hasFilters = !!search;

  const sidebar = (
    <StockDetailSidebar
      item={selectedItem}
      tenantId={tenantId}
      onClose={() => setSelectedId(null)}
      onAdjust={setAdjustTarget}
      onEditThreshold={setThresholdTarget}
      onToggleAvailable={(i) => toggleAvailable(i)}
      onRemove={(i) => removeItem(i.id)}
      onRestock={setRestockTarget}
      onLogLoss={(i) => setLossModal({ locationId: i.locationId, stockItemId: i.stockItemId })}
      onEditItem={setEditItemTarget}
    />
  );

  return (
    <PageLayout eyebrow="Operations" title="Inventory" headerBorder={false} sidebar={sidebar}>
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-full">
              <Input
                placeholder="Search items…"
                leftIcon={<Search size={14} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                rightAction={search ? <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground transition-colors"><X size={14} /></button> : undefined}
              />
            </div>
            {locationId && (
              <Button size="sm" onClick={() => setShowAdd(true)} className="ml-auto gap-1.5">
                <Plus size={14} /> Add Item
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        {locationId && (
          <div className="flex gap-3 mb-4 shrink-0">
            <StatCard label="Total Items" value={String(enriched.length)} icon="ShoppingBag" iconVariant="primary" />
            <StatCard
              label="Out of Stock"
              value={String(outCount)}
              icon="Repeat"
              iconVariant="gold"
              delta={outCount > 0 ? String(outCount) : undefined}
              deltaDirection={outCount > 0 ? 'down' : undefined}
            />
            <StatCard
              label="Needs Attention"
              value={String(attentionCount)}
              icon="Tag"
              iconVariant="gold"
              delta={attentionCount > 0 ? String(attentionCount) : undefined}
              deltaDirection={attentionCount > 0 ? 'down' : undefined}
            />
            <StatCard label="Low Soon" value={String(soonCount)} icon="CalendarDays" iconVariant="info" />
          </div>
        )}

        {/* Table */}
        <div className="flex flex-col min-h-0 overflow-hidden rounded-2xl border border-border bg-card">
          {!locationId ? (
            <EmptyState icon={Boxes} title="No location selected" description="Select a location from the header to view and manage its stock." />
          ) : (
            <>
              <div className={cn('grid gap-4 px-4 py-2.5 border-b border-border bg-surface-offset/50 shrink-0', GRID)}>
                {['Item', 'Quantity', 'Threshold', 'Stock Level', 'Days Left', 'Status'].map((h) => (
                  <span key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h}</span>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16"><p className="text-sm text-muted-foreground">Loading stock…</p></div>
                ) : filtered.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title={hasFilters ? 'No items match your filters' : 'No stock items at this location'}
                    description={hasFilters ? 'Try adjusting your filters.' : 'Add items using the button above.'}
                  />
                ) : (
                  filtered.map((s) => {
                    const pct = stockPct(s.qty, s.threshold);
                    const selected = selectedId === s.id;
                    const days = s.forecast?.daysOfStockRemaining;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedId((prev) => (prev === s.id ? null : s.id))}
                        className={cn(
                          'grid gap-4 px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer transition-colors hover:bg-surface-offset/40',
                          GRID,
                          selected && 'bg-primary/5 border-l-2 border-l-primary',
                        )}
                      >
                        {/* Item */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', STATUS_ICON_BG[s.status])}>
                            <Package size={13} className={STATUS_ICON_FG[s.status]} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{s.stockItem?.name ?? s.stockItemId.slice(0, 8)}</p>
                            {s.stockItem?.unit && <p className="text-[11px] text-muted-foreground">{s.stockItem.unit}</p>}
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="flex items-center">
                          <span className={cn('text-sm font-semibold tabular-nums', (s.status === 'critical' || s.status === 'out') && 'text-destructive')}>
                            {fmtQty(s.qty)}
                          </span>
                        </div>

                        {/* Threshold */}
                        <div className="flex items-center text-sm text-muted-foreground tabular-nums">{fmtQty(s.threshold)}</div>

                        {/* Stock level */}
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                            <div className={cn('h-full rounded-full transition-all', STATUS_BAR[s.status])} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums w-8 text-right shrink-0">{Math.round(pct)}%</span>
                        </div>

                        {/* Days left */}
                        <div className="flex items-center">
                          {days === undefined ? (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          ) : (
                            <span className={cn('text-sm font-medium tabular-nums', daysColor(days))}>{Math.round(days)}d</span>
                          )}
                        </div>

                        {/* Status */}
                        <div className="flex items-center">
                          <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {filtered.length > 0 && (
                <div className="px-4 py-2 border-t border-border shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                    {hasFilters && enriched.length !== filtered.length && ` of ${enriched.length} total`}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAdd && locationId && (
        <AddItemModal
          locationId={locationId}
          existingIds={existingIds}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { invalidateStock(); addToast('success', 'Item added.'); }}
        />
      )}
      {editItemTarget?.stockItem && (
        <EditStockItemModal
          item={editItemTarget.stockItem}
          onClose={() => setEditItemTarget(null)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['stock-items'] });
            invalidateStock();
            addToast('success', 'Stock item updated.');
          }}
        />
      )}
      {adjustTarget && (
        <AdjustModal item={adjustTarget} onClose={() => setAdjustTarget(null)} onSuccess={() => { invalidateStock(); addToast('success', 'Stock adjusted.'); }} />
      )}
      {thresholdTarget && (
        <EditThresholdModal item={thresholdTarget} onClose={() => setThresholdTarget(null)} onSuccess={() => { invalidateStock(); addToast('success', 'Threshold updated.'); }} />
      )}
      {restockTarget && (
        <RestockModal
          item={restockTarget}
          onClose={() => setRestockTarget(null)}
          onSuccess={() => { addToast('success', 'Restock request submitted.'); void queryClient.invalidateQueries({ queryKey: ['restock-requests'] }); }}
        />
      )}
      {lossModal && (
        <LogLossModal
          defaultLocationId={lossModal.locationId}
          defaultStockItemId={lossModal.stockItemId}
          onClose={() => setLossModal(null)}
          onSuccess={() => {
            invalidateStock();
            void queryClient.invalidateQueries({ queryKey: ['loss-log'] });
            addToast('success', 'Loss entry recorded.');
          }}
        />
      )}

      <Toast toasts={toasts} onDismiss={removeToast} />
    </PageLayout>
  );
}
