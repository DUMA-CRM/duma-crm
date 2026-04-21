'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Package, ArrowDownToLine, ChevronDown, Trash2, Settings2, MapPin } from 'lucide-react';
import {
  getStockItems,
  createStockItem,
  updateStockItem,
  deleteStockItem,
  getLocationStock,
  addLocationStock,
  updateLocationStock,
  removeLocationStock,
  adjustLocationStock,
  receiveLocationStock,
  getTenantStock,
  addTenantStock,
  adjustTenantStock,
  getTenantStockItem,
  type StockItem,
  type LocationStock,
  type TenantStock,
  type TenantStockDetail,
} from '@/lib/api/inventory.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Modal } from '@/components/shared/Modal';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils/cn';

const inputClass =
  'w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';

const btnRow = 'flex gap-2 pt-1';
const btnCancel =
  'flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors';
const btnPrimary =
  'flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60';

// ── Forms ─────────────────────────────────────────────────────────────────────

function ItemForm({
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
          autoFocus
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
      <div className={btnRow}>
        <button type="button" onClick={onClose} className={btnCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isPending} className={btnPrimary}>
          {isPending ? 'Saving…' : initial ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

function WarehouseForm({
  initial,
  itemName,
  onSubmit,
  onClose,
  isPending,
}: {
  initial?: TenantStock;
  itemName: string;
  onSubmit: (quantity: string, lowThreshold: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [quantity, setQuantity] = useState(initial?.quantity ?? '0');
  const [lowThreshold, setLowThreshold] = useState(initial?.lowThreshold ?? '0');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(quantity, lowThreshold);
      }}
      className="space-y-4"
    >
      <div className="px-3 py-2 bg-muted rounded-lg text-sm text-muted-foreground">
        Warehouse stock for <span className="font-semibold text-foreground">{itemName}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Quantity</label>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            pattern="^\d+(\.\d{1,2})?$"
            placeholder="1000"
            className={inputClass}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Low Threshold</label>
          <input
            value={lowThreshold}
            onChange={(e) => setLowThreshold(e.target.value)}
            required
            pattern="^\d+(\.\d{1,2})?$"
            placeholder="100"
            className={inputClass}
          />
        </div>
      </div>
      <div className={btnRow}>
        <button type="button" onClick={onClose} className={btnCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isPending} className={btnPrimary}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function AdjustForm({
  currentQty,
  unit,
  label,
  onSubmit,
  onClose,
  isPending,
}: {
  currentQty: number;
  unit: string;
  label: string;
  onSubmit: (delta: number) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [delta, setDelta] = useState('');
  const deltaNum = parseFloat(delta) || 0;
  const preview = currentQty + deltaNum;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (deltaNum !== 0) onSubmit(deltaNum);
      }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground">
          {currentQty} {unit}
        </span>
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Adjustment (+ or −)</label>
        <input
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          required
          pattern="^-?\d+(\.\d{1,2})?$"
          placeholder="+500 or -50"
          className={inputClass}
          autoFocus
        />
      </div>
      {deltaNum !== 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm text-muted-foreground">New total</span>
          <span className={cn('text-sm font-semibold', preview < 0 ? 'text-destructive' : 'text-foreground')}>
            {preview.toFixed(2)} {unit}
          </span>
        </div>
      )}
      <div className={btnRow}>
        <button type="button" onClick={onClose} className={btnCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isPending || deltaNum === 0} className={btnPrimary}>
          {isPending ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </form>
  );
}

function ReceiveForm({
  ls,
  warehouseQty,
  unit,
  onSubmit,
  onClose,
  isPending,
}: {
  ls: LocationStock;
  warehouseQty: number;
  unit: string;
  onSubmit: (qty: number) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [qty, setQty] = useState('');
  const qtyNum = parseFloat(qty) || 0;
  const preview = parseFloat(ls.quantity) + qtyNum;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (qtyNum > 0) onSubmit(qtyNum);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
          <span className="text-xs text-muted-foreground">Warehouse</span>
          <span className="text-sm font-semibold">
            {warehouseQty} {unit}
          </span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
          <span className="text-xs text-muted-foreground">At location</span>
          <span className="text-sm font-semibold">
            {ls.quantity} {unit}
          </span>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
          Quantity to receive · max {warehouseQty} {unit}
        </label>
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          required
          pattern="^\d+(\.\d{1,2})?$"
          placeholder={String(warehouseQty)}
          className={inputClass}
          autoFocus
        />
      </div>
      {qtyNum > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm text-muted-foreground">Location after receive</span>
          <span className="text-sm font-semibold text-foreground">
            {preview.toFixed(2)} {unit}
          </span>
        </div>
      )}
      <div className={btnRow}>
        <button type="button" onClick={onClose} className={btnCancel}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || qtyNum <= 0 || qtyNum > warehouseQty}
          className={btnPrimary + ' flex items-center justify-center gap-1.5'}
        >
          <ArrowDownToLine size={14} aria-hidden="true" />
          {isPending ? 'Receiving…' : 'Receive'}
        </button>
      </div>
    </form>
  );
}

function AddToLocationForm({
  stockItem,
  onSubmit,
  onClose,
  isPending,
}: {
  stockItem: StockItem;
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
        Setting up <span className="font-semibold text-foreground">{stockItem.name}</span> at this location
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
            autoFocus
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
      <div className={btnRow}>
        <button type="button" onClick={onClose} className={btnCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isPending} className={btnPrimary}>
          {isPending ? 'Adding…' : 'Add to Location'}
        </button>
      </div>
    </form>
  );
}

function LocationSettingsForm({
  ls,
  stockItem,
  onSubmit,
  onRemove,
  onClose,
  isPending,
}: {
  ls: LocationStock;
  stockItem: StockItem;
  onSubmit: (lowThreshold: string, isAvailable: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [lowThreshold, setLowThreshold] = useState(ls.lowThreshold);
  const [isAvailable, setIsAvailable] = useState(ls.isAvailable);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(lowThreshold, isAvailable);
      }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
        <span className="text-sm text-muted-foreground">Current stock</span>
        <span className="text-sm font-semibold">
          {ls.quantity} {stockItem.unit}
        </span>
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
          Low Threshold ({stockItem.unit})
        </label>
        <input
          value={lowThreshold}
          onChange={(e) => setLowThreshold(e.target.value)}
          required
          pattern="^\d+(\.\d{1,2})?$"
          className={inputClass}
          autoFocus
        />
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
      <div className={btnRow}>
        <button type="button" onClick={onClose} className={btnCancel}>
          Cancel
        </button>
        <button type="submit" disabled={isPending} className={btnPrimary}>
          {isPending ? 'Saving…' : 'Update'}
        </button>
      </div>
    </form>
  );
}

// ── Expanded location breakdown ───────────────────────────────────────────────

function LocationBreakdown({ stockItemId, allLocations }: { stockItemId: string; allLocations: { id: string; name: string }[] }) {
  const { data: detail, isLoading } = useQuery<TenantStockDetail>({
    queryKey: ['tenant-stock-detail', stockItemId],
    queryFn: () => getTenantStockItem(stockItemId),
  });

  if (isLoading) {
    return (
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-7 w-28 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const locs = detail?.locations ?? [];
  if (locs.length === 0) {
    return <p className="text-xs text-muted-foreground">Not allocated to any location yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {locs.map((ls) => {
        const loc = allLocations.find((l) => l.id === ls.locationId);
        const isLow = parseFloat(ls.quantity) <= parseFloat(ls.lowThreshold);
        return (
          <div
            key={ls.id}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs',
              isLow ? 'bg-destructive/5 border-destructive/20 text-destructive' : 'bg-card border-border text-foreground',
            )}
          >
            <MapPin size={10} aria-hidden="true" />
            <span className="font-medium">{loc?.name ?? ls.locationId}</span>
            <span className={cn('tabular-nums font-semibold', isLow ? 'text-destructive' : 'text-primary')}>{ls.quantity}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Modal state ───────────────────────────────────────────────────────────────

type ModalState =
  | { type: 'new-item' }
  | { type: 'edit-item'; item: StockItem }
  | { type: 'warehouse'; item: StockItem; ts?: TenantStock }
  | { type: 'adjust-warehouse'; item: StockItem; ts: TenantStock }
  | { type: 'add-location'; item: StockItem }
  | { type: 'adjust-location'; item: StockItem; ls: LocationStock }
  | { type: 'receive'; item: StockItem; ls: LocationStock; ts: TenantStock }
  | { type: 'loc-settings'; item: StockItem; ls: LocationStock };

// ── Main panel ────────────────────────────────────────────────────────────────

export function InventoryPanel() {
  const qc = useQueryClient();
  const { tenantId, locationId } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);
  const close = () => setModal(null);

  // ── Queries ──
  const { data: stockItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['stock-items'],
    queryFn: getStockItems,
    enabled: !!tenantId,
  });

  const { data: tenantStock = [], isLoading: loadingTs } = useQuery({
    queryKey: ['tenant-stock'],
    queryFn: getTenantStock,
    enabled: !!tenantId,
  });

  const { data: locationStock = [], isLoading: loadingLs } = useQuery({
    queryKey: ['location-stock', locationId],
    queryFn: () => getLocationStock(locationId!),
    enabled: !!locationId,
  });

  const { data: allLocations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const tsByItemId = useMemo(() => Object.fromEntries(tenantStock.map((ts) => [ts.stockItemId, ts])), [tenantStock]);
  const lsByItemId = useMemo(() => Object.fromEntries(locationStock.map((ls) => [ls.stockItemId, ls])), [locationStock]);

  // ── Mutations ──
  const invQty = (extra?: string[]) => {
    qc.invalidateQueries({ queryKey: ['stock-items'] });
    qc.invalidateQueries({ queryKey: ['tenant-stock'] });
    if (locationId) qc.invalidateQueries({ queryKey: ['location-stock', locationId] });
    extra?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    close();
  };

  const createItem = useMutation({
    mutationFn: ({ name, unit }: { name: string; unit: string }) => createStockItem({ tenantId: tenantId!, name, unit }),
    onSuccess: () => invQty(),
  });
  const updateItem = useMutation({
    mutationFn: ({ id, name, unit }: { id: string; name: string; unit: string }) => updateStockItem(id, { name, unit }),
    onSuccess: () => invQty(),
  });
  const deleteItem = useMutation({
    mutationFn: deleteStockItem,
    onSuccess: () => invQty(),
  });

  const addWarehouse = useMutation({
    mutationFn: ({ stockItemId, quantity, lowThreshold }: { stockItemId: string; quantity: string; lowThreshold: string }) =>
      addTenantStock({ stockItemId, quantity, lowThreshold }),
    onSuccess: () => invQty(),
  });
  const adjustWarehouse = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => adjustTenantStock(id, delta),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['tenant-stock'] });
      qc.invalidateQueries({ queryKey: ['tenant-stock-detail'] });
      close();
    },
  });

  const addLocation = useMutation({
    mutationFn: ({ stockItemId, quantity, lowThreshold }: { stockItemId: string; quantity: string; lowThreshold: string }) =>
      addLocationStock({ locationId: locationId!, stockItemId, quantity, lowThreshold }),
    onSuccess: () => invQty(),
  });
  const adjustLocation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => adjustLocationStock(id, delta),
    onSuccess: () => invQty(),
  });
  const updateLocSettings = useMutation({
    mutationFn: ({ id, lowThreshold, isAvailable }: { id: string; lowThreshold: string; isAvailable: boolean }) =>
      updateLocationStock(id, { lowThreshold, isAvailable }),
    onSuccess: () => invQty(),
  });
  const removeLocation = useMutation({
    mutationFn: removeLocationStock,
    onSuccess: () => invQty(),
  });
  const receiveMutation = useMutation({
    mutationFn: ({ lsId, quantity }: { lsId: string; quantity: number }) => receiveLocationStock(lsId, quantity),
    onSuccess: (_, { lsId }) => invQty(['tenant-stock-detail']),
  });

  const isPending =
    createItem.isPending ||
    updateItem.isPending ||
    deleteItem.isPending ||
    addWarehouse.isPending ||
    adjustWarehouse.isPending ||
    addLocation.isPending ||
    adjustLocation.isPending ||
    updateLocSettings.isPending ||
    removeLocation.isPending ||
    receiveMutation.isPending;

  // ── Filter ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? stockItems.filter((i) => i.name.toLowerCase().includes(q) || i.unit.toLowerCase().includes(q)) : stockItems;
  }, [stockItems, search]);

  if (!tenantId) {
    return <EmptyState icon={Package} title="No workspace selected" description="Select a workspace to manage inventory." />;
  }

  const isLoading = loadingItems || loadingTs || loadingLs;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 shrink-0">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stock items…"
          className="flex-1 h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150"
        />
        <button
          onClick={() => setModal({ type: 'new-item' })}
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
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title="No stock items" description='Click "New Item" to create your first stock item.' />
        ) : (
          <StockTable
            rows={filtered}
            tsByItemId={tsByItemId}
            lsByItemId={lsByItemId}
            allLocations={allLocations}
            locationId={locationId}
            onModal={setModal}
          />
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}

      {modal?.type === 'new-item' && (
        <Modal title="New Stock Item" onClose={close}>
          <ItemForm
            tenantId={tenantId}
            onClose={close}
            isPending={isPending}
            onSubmit={(name, unit) => createItem.mutate({ name, unit })}
          />
        </Modal>
      )}

      {modal?.type === 'edit-item' && (
        <Modal title="Edit Stock Item" onClose={close}>
          <ItemForm
            initial={modal.item}
            tenantId={tenantId}
            onClose={close}
            isPending={isPending}
            onDelete={() => deleteItem.mutate(modal.item.id)}
            onSubmit={(name, unit) => updateItem.mutate({ id: modal.item.id, name, unit })}
          />
        </Modal>
      )}

      {modal?.type === 'warehouse' && (
        <Modal title={modal.ts ? 'Edit Warehouse Stock' : 'Add to Warehouse'} onClose={close}>
          <WarehouseForm
            initial={modal.ts}
            itemName={modal.item.name}
            onClose={close}
            isPending={isPending}
            onSubmit={(qty, thresh) => {
              if (modal.ts) {
                adjustWarehouse.mutate({ id: modal.ts.id, delta: parseFloat(qty) - parseFloat(modal.ts.quantity) });
              } else {
                addWarehouse.mutate({ stockItemId: modal.item.id, quantity: qty, lowThreshold: thresh });
              }
            }}
          />
        </Modal>
      )}

      {modal?.type === 'adjust-warehouse' && (
        <Modal title={`Adjust Warehouse — ${modal.item.name}`} onClose={close}>
          <AdjustForm
            currentQty={parseFloat(modal.ts.quantity)}
            unit={modal.item.unit}
            label="Warehouse stock"
            onClose={close}
            isPending={isPending}
            onSubmit={(delta) => adjustWarehouse.mutate({ id: modal.ts.id, delta })}
          />
        </Modal>
      )}

      {modal?.type === 'add-location' && locationId && (
        <Modal title={`Add to Location — ${modal.item.name}`} onClose={close}>
          <AddToLocationForm
            stockItem={modal.item}
            onClose={close}
            isPending={isPending}
            onSubmit={(qty, thresh) => addLocation.mutate({ stockItemId: modal.item.id, quantity: qty, lowThreshold: thresh })}
          />
        </Modal>
      )}

      {modal?.type === 'adjust-location' && (
        <Modal title={`Adjust Location Stock — ${modal.item.name}`} onClose={close}>
          <AdjustForm
            currentQty={parseFloat(modal.ls.quantity)}
            unit={modal.item.unit}
            label="Location stock"
            onClose={close}
            isPending={isPending}
            onSubmit={(delta) => adjustLocation.mutate({ id: modal.ls.id, delta })}
          />
        </Modal>
      )}

      {modal?.type === 'receive' && (
        <Modal title={`Receive — ${modal.item.name}`} onClose={close}>
          <ReceiveForm
            ls={modal.ls}
            warehouseQty={parseFloat(modal.ts.quantity)}
            unit={modal.item.unit}
            onClose={close}
            isPending={isPending}
            onSubmit={(qty) => receiveMutation.mutate({ lsId: modal.ls.id, quantity: qty })}
          />
        </Modal>
      )}

      {modal?.type === 'loc-settings' && (
        <Modal title={`Location Settings — ${modal.item.name}`} onClose={close}>
          <LocationSettingsForm
            ls={modal.ls}
            stockItem={modal.item}
            onClose={close}
            isPending={isPending}
            onRemove={() => removeLocation.mutate(modal.ls.id)}
            onSubmit={(thresh, avail) => updateLocSettings.mutate({ id: modal.ls.id, lowThreshold: thresh, isAvailable: avail })}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Table (extracted to avoid one giant render fn) ────────────────────────────

function StockTable({
  rows,
  tsByItemId,
  lsByItemId,
  allLocations,
  locationId,
  onModal,
}: {
  rows: StockItem[];
  tsByItemId: Record<string, TenantStock>;
  lsByItemId: Record<string, LocationStock>;
  allLocations: { id: string; name: string }[];
  locationId: string | null;
  onModal: (s: ModalState) => void;
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className="w-7 pb-2.5" />
          <th className="text-left pb-2.5 pr-4">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Item</span>
          </th>
          <th className="text-left pb-2.5 pr-4 w-16">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unit</span>
          </th>
          <th className="text-right pb-2.5 pr-4 w-32">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Warehouse</span>
          </th>
          {locationId && (
            <th className="text-right pb-2.5 pr-4 w-32">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">At Location</span>
            </th>
          )}
          <th className="pb-2.5 w-48" />
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <StockRow
            key={item.id}
            item={item}
            ts={tsByItemId[item.id]}
            ls={locationId ? lsByItemId[item.id] : undefined}
            allLocations={allLocations}
            locationId={locationId}
            onModal={onModal}
          />
        ))}
      </tbody>
    </table>
  );
}

function StockRow({
  item,
  ts,
  ls,
  allLocations,
  locationId,
  onModal,
}: {
  item: StockItem;
  ts?: TenantStock;
  ls?: LocationStock;
  allLocations: { id: string; name: string }[];
  locationId: string | null;
  onModal: (s: ModalState) => void;
}) {
  const [open, setOpen] = useState(false);

  const tsQty = ts ? parseFloat(ts.quantity) : null;
  const tsLow = ts ? tsQty! <= parseFloat(ts.lowThreshold) : false;

  const lsQty = ls ? parseFloat(ls.quantity) : null;
  const lsLow = ls ? lsQty! <= parseFloat(ls.lowThreshold) : false;

  return (
    <>
      <tr
        className={cn(
          'group border-b border-border/50 hover:bg-surface-offset transition-colors cursor-pointer',
          open && 'bg-surface-offset',
        )}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Expand */}
        <td className="py-3 pl-1">
          <ChevronDown
            size={14}
            className={cn('text-muted-foreground transition-transform duration-150', open && 'rotate-180')}
            aria-hidden="true"
          />
        </td>

        {/* Name */}
        <td className="py-3 pr-4">
          <p className="text-sm font-medium text-foreground">{item.name}</p>
        </td>

        {/* Unit */}
        <td className="py-3 pr-4">
          <span className="text-xs text-muted-foreground">{item.unit}</span>
        </td>

        {/* Warehouse qty */}
        <td className="py-3 pr-4 text-right">
          {ts ? (
            <span className={cn('text-sm font-semibold tabular-nums', tsLow ? 'text-destructive' : 'text-foreground')}>{ts.quantity}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>

        {/* Location qty */}
        {locationId && (
          <td className="py-3 pr-4 text-right">
            {ls ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums',
                  lsLow ? 'text-destructive' : 'text-foreground',
                )}
              >
                {lsLow && <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />}
                {ls.quantity}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </td>
        )}

        {/* Actions */}
        <td className="py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <RowActions item={item} ts={ts} ls={ls} locationId={locationId} onModal={onModal} />
          </div>
        </td>
      </tr>

      {/* Expanded: location breakdown */}
      {open && (
        <tr className="border-b border-border/50 bg-surface-offset/40">
          <td colSpan={locationId ? 6 : 5} className="px-8 pb-3 pt-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Stock across locations</p>
            <LocationBreakdown stockItemId={item.id} allLocations={allLocations} />
          </td>
        </tr>
      )}
    </>
  );
}

function RowActions({
  item,
  ts,
  ls,
  locationId,
  onModal,
}: {
  item: StockItem;
  ts?: TenantStock;
  ls?: LocationStock;
  locationId: string | null;
  onModal: (s: ModalState) => void;
}) {
  const actionBtn = 'h-7 px-2.5 rounded-md text-xs font-medium transition-colors';

  return (
    <>
      {/* Location-aware actions */}
      {locationId && (
        <>
          {ls && ts && (
            <button
              onClick={() => onModal({ type: 'receive', item, ls, ts })}
              className={cn(actionBtn, 'text-primary hover:bg-primary/10 flex items-center gap-1')}
            >
              <ArrowDownToLine size={11} aria-hidden="true" />
              Receive
            </button>
          )}
          {ls && (
            <button
              onClick={() => onModal({ type: 'adjust-location', item, ls })}
              className={cn(actionBtn, 'text-foreground hover:bg-muted')}
            >
              Adjust
            </button>
          )}
          {!ls && (
            <button onClick={() => onModal({ type: 'add-location', item })} className={cn(actionBtn, 'text-primary hover:bg-primary/10')}>
              + Add here
            </button>
          )}
          {ls && (
            <button
              onClick={() => onModal({ type: 'loc-settings', item, ls })}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Location stock settings"
            >
              <Settings2 size={12} aria-hidden="true" />
            </button>
          )}
        </>
      )}

      {/* Warehouse action */}
      {ts ? (
        <button
          onClick={() => onModal({ type: 'adjust-warehouse', item, ts })}
          className={cn(actionBtn, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
        >
          Wh. adjust
        </button>
      ) : (
        <button
          onClick={() => onModal({ type: 'warehouse', item })}
          className={cn(actionBtn, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
        >
          + Warehouse
        </button>
      )}

      {/* Edit item */}
      <button
        onClick={() => onModal({ type: 'edit-item', item })}
        className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label={`Edit ${item.name}`}
      >
        <Pencil size={12} aria-hidden="true" />
      </button>
    </>
  );
}
