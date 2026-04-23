'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronUp, MapPin, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';

import {
  type LocationStock,
  type StockItem,
  addLocationStock,
  adjustLocationStock,
  createStockItem,
  deleteStockItem,
  getLocationStock,
  getStockItems,
  removeLocationStock,
  updateLocationStock,
  updateStockItem,
} from '@/lib/api/inventory.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Shared form styles ────────────────────────────────────────────────────────

const inputClass =
  'w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';

// ── Stock item form ───────────────────────────────────────────────────────────

function StockItemForm({
  initial,
  tenantId,
  onSubmit,
  onDelete,
  onClose,
  isPending,
}: {
  initial?: StockItem;
  tenantId: string;
  onSubmit: (name: string, unit: string) => void;
  onDelete?: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name, unit);
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Oat Milk"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Unit</label>
        <input value={unit} onChange={(e) => setUnit(e.target.value)} required placeholder="ml, g, kg, units…" className={inputClass} />
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full h-9 border border-destructive/30 text-destructive text-sm font-medium rounded-xl hover:bg-destructive/10 transition-colors"
        >
          Delete stock item
        </button>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Saving…' : initial ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ── Add to location form ──────────────────────────────────────────────────────

function AddToLocationForm({
  stockItem,
  locationId,
  onSubmit,
  onClose,
  isPending,
}: {
  stockItem: StockItem;
  locationId: string;
  onSubmit: (quantity: string, lowThreshold: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [quantity, setQuantity] = useState('0');
  const [lowThreshold, setLowThreshold] = useState('10');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(quantity, lowThreshold);
      }}
      className="space-y-4"
    >
      <div className="px-3 py-2 bg-muted rounded-lg text-sm text-muted-foreground">
        Adding <span className="font-semibold text-foreground">{stockItem.name}</span> to this location
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
            Initial Qty ({stockItem.unit})
          </label>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            pattern="^\d+(\.\d{1,2})?$"
            placeholder="0"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Low Threshold</label>
          <input
            value={lowThreshold}
            onChange={(e) => setLowThreshold(e.target.value)}
            required
            pattern="^\d+(\.\d{1,2})?$"
            placeholder="10"
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Adding…' : 'Add to Location'}
        </button>
      </div>
    </form>
  );
}

// ── Adjust stock form ─────────────────────────────────────────────────────────

function AdjustForm({
  locStock,
  stockItem,
  onSubmit,
  onClose,
  isPending,
}: {
  locStock: LocationStock;
  stockItem: StockItem;
  onSubmit: (delta: number) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [delta, setDelta] = useState('');
  const current = parseFloat(locStock.quantity);
  const deltaNum = parseFloat(delta) || 0;
  const preview = current + deltaNum;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (deltaNum !== 0) onSubmit(deltaNum);
      }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
        <span className="text-sm text-muted-foreground">Current stock</span>
        <span className="text-sm font-semibold text-foreground">
          {locStock.quantity} {stockItem.unit}
        </span>
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
          Adjustment (use − for removal)
        </label>
        <input
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          required
          placeholder="+500 or -50"
          pattern="^-?\d+(\.\d{1,2})?$"
          className={inputClass}
        />
      </div>
      {delta && deltaNum !== 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm text-muted-foreground">New total</span>
          <span className={cn('text-sm font-semibold', preview < 0 ? 'text-destructive' : 'text-foreground')}>
            {preview.toFixed(2)} {stockItem.unit}
          </span>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || deltaNum === 0}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </form>
  );
}

// ── Edit location stock form ──────────────────────────────────────────────────

function EditLocationStockForm({
  locStock,
  stockItem,
  onSubmit,
  onRemove,
  onClose,
  isPending,
}: {
  locStock: LocationStock;
  stockItem: StockItem;
  onSubmit: (quantity: string, lowThreshold: string, isAvailable: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [quantity, setQuantity] = useState(locStock.quantity);
  const [lowThreshold, setLowThreshold] = useState(locStock.lowThreshold);
  const [isAvailable, setIsAvailable] = useState(locStock.isAvailable);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(quantity, lowThreshold, isAvailable);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
            Quantity ({stockItem.unit})
          </label>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            pattern="^\d+(\.\d{1,2})?$"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Low Threshold</label>
          <input
            value={lowThreshold}
            onChange={(e) => setLowThreshold(e.target.value)}
            required
            pattern="^\d+(\.\d{1,2})?$"
            className={inputClass}
          />
        </div>
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm text-foreground">Available at this location</span>
      </label>
      <button
        type="button"
        onClick={onRemove}
        className="w-full h-9 border border-destructive/30 text-destructive text-sm font-medium rounded-xl hover:bg-destructive/10 transition-colors"
      >
        Remove from location
      </button>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Update'}
        </button>
      </div>
    </form>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

type ModalState =
  | { type: 'create-item' }
  | { type: 'edit-item'; item: StockItem }
  | { type: 'add-to-location'; item: StockItem }
  | { type: 'adjust'; item: StockItem; locStock: LocationStock }
  | { type: 'edit-loc-stock'; item: StockItem; locStock: LocationStock };

// ── Panel ─────────────────────────────────────────────────────────────────────

export function StockItemsPanel() {
  const qc = useQueryClient();
  const { tenantId, locationId } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [sortField, setSortField] = useState<'name' | 'quantity'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: stockItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['stock-items'],
    queryFn: getStockItems,
    enabled: !!tenantId,
  });

  const { data: locationStock = [], isLoading: locStockLoading } = useQuery({
    queryKey: ['location-stock', locationId],
    queryFn: () => getLocationStock(locationId!),
    enabled: !!locationId,
  });

  const locStockByItemId = useMemo(() => Object.fromEntries(locationStock.map((ls) => [ls.stockItemId, ls])), [locationStock]);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: ({ name, unit }: { name: string; unit: string }) => createStockItem({ tenantId: tenantId!, name, unit }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-items'] });
      setModal(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, unit }: { id: string; name: string; unit: string }) => updateStockItem(id, { name, unit }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-items'] });
      setModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStockItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-items'] });
      setModal(null);
    },
  });

  const addLocMutation = useMutation({
    mutationFn: (data: { stockItemId: string; quantity: string; lowThreshold: string }) =>
      addLocationStock({ locationId: locationId!, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-stock', locationId] });
      setModal(null);
    },
  });

  const updateLocMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; quantity: string; lowThreshold: string; isAvailable: boolean }) =>
      updateLocationStock(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-stock', locationId] });
      setModal(null);
    },
  });

  const removeLocMutation = useMutation({
    mutationFn: removeLocationStock,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-stock', locationId] });
      setModal(null);
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => adjustLocationStock(id, delta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-stock', locationId] });
      setModal(null);
    },
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    addLocMutation.isPending ||
    updateLocMutation.isPending ||
    removeLocMutation.isPending ||
    adjustMutation.isPending;

  // ── Filter + sort ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = q ? stockItems.filter((i) => i.name.toLowerCase().includes(q) || i.unit.toLowerCase().includes(q)) : stockItems;

    rows = [...rows].sort((a, b) => {
      if (sortField === 'quantity' && locationId) {
        const qa = parseFloat(locStockByItemId[a.id]?.quantity ?? '-1');
        const qb = parseFloat(locStockByItemId[b.id]?.quantity ?? '-1');
        return sortDir === 'asc' ? qa - qb : qb - qa;
      }
      return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });

    return rows;
  }, [stockItems, search, sortField, sortDir, locationId, locStockByItemId]);

  function toggleSort(field: 'name' | 'quantity') {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortIcon({ field }: { field: 'name' | 'quantity' }) {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />;
  }

  const isLoading = itemsLoading || locStockLoading;

  if (!tenantId) {
    return <EmptyState icon={Package} title="No workspace selected" description="Select a workspace to manage inventory." />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stock items…"
          className="flex-1 h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150"
        />
        {locationId && (
          <div className="flex items-center gap-1.5 text-xs text-primary font-medium shrink-0">
            <MapPin size={13} aria-hidden="true" />
            <span>Location stock</span>
          </div>
        )}
        <button
          onClick={() => setModal({ type: 'create-item' })}
          className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus size={15} aria-hidden="true" />
          New Item
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title="No stock items" description="Create your first stock item." />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-2.5 pr-4">
                  <button
                    onClick={() => toggleSort('name')}
                    className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
                  >
                    Item <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left pb-2.5 pr-4 w-20">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unit</span>
                </th>
                {locationId && (
                  <>
                    <th className="text-right pb-2.5 pr-4 w-28">
                      <button
                        onClick={() => toggleSort('quantity')}
                        className="flex items-center justify-end gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors w-full"
                      >
                        Qty <SortIcon field="quantity" />
                      </button>
                    </th>
                    <th className="text-right pb-2.5 pr-4 w-28">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Threshold</span>
                    </th>
                    <th className="text-center pb-2.5 pr-4 w-20">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</span>
                    </th>
                  </>
                )}
                <th className="pb-2.5 w-24" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const ls = locationId ? locStockByItemId[item.id] : undefined;
                const qty = ls ? parseFloat(ls.quantity) : null;
                const threshold = ls ? parseFloat(ls.lowThreshold) : null;
                const isLow = qty !== null && threshold !== null && qty <= threshold;

                return (
                  <tr key={item.id} className="group border-b border-border/50 hover:bg-surface-offset transition-colors">
                    <td className="py-3 pr-4">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-muted-foreground">{item.unit}</span>
                    </td>

                    {locationId && (
                      <>
                        <td className="py-3 pr-4 text-right">
                          {ls ? (
                            <span className={cn('text-sm font-semibold tabular-nums', isLow ? 'text-destructive' : 'text-foreground')}>
                              {ls.quantity}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {ls ? (
                            <span className="text-xs text-muted-foreground tabular-nums">{ls.lowThreshold}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-center">
                          {ls ? (
                            isLow ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                                <AlertTriangle size={9} aria-hidden="true" />
                                Low
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                                OK
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              Not added
                            </span>
                          )}
                        </td>
                      </>
                    )}

                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {locationId && !ls && (
                          <button
                            onClick={() => setModal({ type: 'add-to-location', item })}
                            className="h-7 px-2 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                          >
                            Add
                          </button>
                        )}
                        {locationId && ls && (
                          <>
                            <button
                              onClick={() => setModal({ type: 'adjust', item, locStock: ls })}
                              className="h-7 px-2 rounded-md text-xs font-medium text-foreground hover:bg-muted transition-colors"
                            >
                              Adjust
                            </button>
                            <button
                              onClick={() => setModal({ type: 'edit-loc-stock', item, locStock: ls })}
                              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              aria-label={`Edit ${item.name} location stock`}
                            >
                              <Pencil size={12} aria-hidden="true" />
                            </button>
                          </>
                        )}
                        {!locationId && (
                          <>
                            <button
                              onClick={() => setModal({ type: 'edit-item', item })}
                              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              aria-label={`Edit ${item.name}`}
                            >
                              <Pencil size={12} aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(item.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                              aria-label={`Delete ${item.name}`}
                            >
                              <Trash2 size={12} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'create-item' && tenantId && (
        <Modal title="New Stock Item" onClose={() => setModal(null)}>
          <StockItemForm
            tenantId={tenantId}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSubmit={(name, unit) => createMutation.mutate({ name, unit })}
          />
        </Modal>
      )}

      {modal?.type === 'edit-item' && (
        <Modal title="Edit Stock Item" onClose={() => setModal(null)}>
          <StockItemForm
            initial={modal.item}
            tenantId={tenantId!}
            onClose={() => setModal(null)}
            isPending={isPending}
            onDelete={() => deleteMutation.mutate(modal.item.id)}
            onSubmit={(name, unit) => updateMutation.mutate({ id: modal.item.id, name, unit })}
          />
        </Modal>
      )}

      {modal?.type === 'add-to-location' && locationId && (
        <Modal title={`Add to Location — ${modal.item.name}`} onClose={() => setModal(null)}>
          <AddToLocationForm
            stockItem={modal.item}
            locationId={locationId}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSubmit={(qty, thresh) => addLocMutation.mutate({ stockItemId: modal.item.id, quantity: qty, lowThreshold: thresh })}
          />
        </Modal>
      )}

      {modal?.type === 'adjust' && (
        <Modal title={`Adjust Stock — ${modal.item.name}`} onClose={() => setModal(null)}>
          <AdjustForm
            locStock={modal.locStock}
            stockItem={modal.item}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSubmit={(delta) => adjustMutation.mutate({ id: modal.locStock.id, delta })}
          />
        </Modal>
      )}

      {modal?.type === 'edit-loc-stock' && (
        <Modal title={`Edit Location Stock — ${modal.item.name}`} onClose={() => setModal(null)}>
          <EditLocationStockForm
            locStock={modal.locStock}
            stockItem={modal.item}
            onClose={() => setModal(null)}
            isPending={isPending}
            onRemove={() => removeLocMutation.mutate(modal.locStock.id)}
            onSubmit={(qty, thresh, avail) =>
              updateLocMutation.mutate({ id: modal.locStock.id, quantity: qty, lowThreshold: thresh, isAvailable: avail })
            }
          />
        </Modal>
      )}
    </div>
  );
}
