'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, ChevronDown, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';

import {
  type TenantStock,
  type TenantStockDetail,
  addTenantStock,
  adjustTenantStock,
  getStockItems,
  getTenantStock,
  getTenantStockItem,
  receiveLocationStock,
  removeTenantStock,
  transferLocationStock,
  updateTenantStock,
} from '@/lib/api/inventory.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const inputClass =
  'w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';

// ── Add to warehouse form ─────────────────────────────────────────────────────

function AddToWarehouseForm({
  onSubmit,
  onClose,
  isPending,
  alreadyTracked,
}: {
  onSubmit: (stockItemId: string, quantity: string, lowThreshold: string) => void;
  onClose: () => void;
  isPending: boolean;
  alreadyTracked: Set<string>;
}) {
  const { data: allItems = [] } = useQuery({ queryKey: ['stock-items'], queryFn: getStockItems });
  const available = allItems.filter((i) => !alreadyTracked.has(i.id));

  const [stockItemId, setStockItemId] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [lowThreshold, setLowThreshold] = useState('0');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(stockItemId, quantity, lowThreshold);
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Stock Item</label>
        <select
          value={stockItemId}
          onChange={(e) => setStockItemId(e.target.value)}
          required
          className={inputClass.replace('h-10', 'h-10') + ' cursor-pointer'}
        >
          <option value="">Select item…</option>
          {available.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit})
            </option>
          ))}
        </select>
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
          disabled={isPending || !stockItemId}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Adding…' : 'Add to Warehouse'}
        </button>
      </div>
    </form>
  );
}

// ── Adjust form ───────────────────────────────────────────────────────────────

function AdjustForm({
  row,
  onSubmit,
  onClose,
  isPending,
}: {
  row: TenantStock;
  onSubmit: (delta: number) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [delta, setDelta] = useState('');
  const current = parseFloat(row.quantity);
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
        <span className="text-sm text-muted-foreground">Warehouse stock</span>
        <span className="text-sm font-semibold text-foreground">
          {row.quantity} {row.stockItem?.unit}
        </span>
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Adjustment</label>
        <input
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          required
          pattern="^-?\d+(\.\d{1,2})?$"
          placeholder="+500 or -50"
          className={inputClass}
        />
      </div>
      {deltaNum !== 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm text-muted-foreground">New total</span>
          <span className={cn('text-sm font-semibold', preview < 0 ? 'text-destructive' : 'text-foreground')}>
            {preview.toFixed(2)} {row.stockItem?.unit}
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

// ── Transfer form ─────────────────────────────────────────────────────────────

function TransferForm({
  detail,
  locations,
  onSubmit,
  onClose,
  isPending,
}: {
  detail: TenantStockDetail;
  locations: { id: string; name: string }[];
  onSubmit: (fromLocationStockId: string | null, toLocationId: string, quantity: number, toLocationStockId: string | null) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [fromId, setFromId] = useState('warehouse');
  const [toId, setToId] = useState('');
  const [qty, setQty] = useState('');

  const detailLocations = detail.locations ?? [];
  const fromLocStock = detailLocations.find((l) => l.id === fromId);
  const maxQty = fromId === 'warehouse' ? parseFloat(detail.quantity) : fromLocStock ? parseFloat(fromLocStock.quantity) : 0;

  // Only locations that already have a stock row for this item can receive
  const locationsWithStock = new Set(detailLocations.map((l) => l.locationId));
  const toOptions = locations.filter((l) => locationsWithStock.has(l.id) && l.id !== fromLocStock?.locationId);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = parseFloat(qty);
        if (!q || !toId) return;
        const toLocStock = detailLocations.find((l) => l.locationId === toId);
        onSubmit(fromId === 'warehouse' ? null : fromId, toId, q, toLocStock?.id ?? null);
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">From</label>
        <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={inputClass + ' cursor-pointer'}>
          <option value="warehouse">
            Warehouse ({detail.quantity} {detail.stockItem?.unit})
          </option>
          {detailLocations.map((ls) => {
            const loc = locations.find((l) => l.id === ls.locationId);
            return (
              <option key={ls.id} value={ls.id}>
                {loc?.name ?? ls.locationId} ({ls.quantity} {detail.stockItem?.unit})
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">To Location</label>
        <select value={toId} onChange={(e) => setToId(e.target.value)} required className={inputClass + ' cursor-pointer'}>
          <option value="">Select destination…</option>
          {toOptions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
          Quantity {detail.stockItem?.unit ? `(${detail.stockItem.unit})` : ''} · max {maxQty}
        </label>
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          required
          pattern="^\d+(\.\d{1,2})?$"
          placeholder="100"
          className={inputClass}
        />
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
          disabled={isPending || !toId || !qty}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
        >
          <ArrowRightLeft size={14} aria-hidden="true" />
          {isPending ? 'Moving…' : 'Transfer'}
        </button>
      </div>
    </form>
  );
}

// ── Expandable row ────────────────────────────────────────────────────────────

function TenantStockRow({
  row,
  locations,
  onAdjust,
  onTransfer,
  onDelete,
}: {
  row: TenantStock;
  locations: { id: string; name: string }[];
  onAdjust: () => void;
  onTransfer: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const { data: detail } = useQuery<TenantStockDetail>({
    queryKey: ['tenant-stock-detail', row.stockItemId],
    queryFn: () => getTenantStockItem(row.stockItemId),
    enabled: open,
  });

  const isLow = parseFloat(row.quantity) <= parseFloat(row.lowThreshold);

  return (
    <>
      <tr
        className={cn(
          'group border-b border-border/50 cursor-pointer hover:bg-surface-offset transition-colors',
          open && 'bg-surface-offset',
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-3 pr-4 w-6">
          <ChevronDown
            size={14}
            className={cn('text-muted-foreground transition-transform duration-150', open && 'rotate-180')}
            aria-hidden="true"
          />
        </td>
        <td className="py-3 pr-4">
          <p className="text-sm font-medium text-foreground">{row.stockItem?.name}</p>
        </td>
        <td className="py-3 pr-4">
          <span className="text-xs text-muted-foreground">{row.stockItem?.unit}</span>
        </td>
        <td className="py-3 pr-4 text-right">
          <span className={cn('text-sm font-semibold tabular-nums', isLow ? 'text-destructive' : 'text-foreground')}>{row.quantity}</span>
        </td>
        <td className="py-3 pr-4 text-right">
          <span className="text-xs text-muted-foreground tabular-nums">{row.lowThreshold}</span>
        </td>
        <td className="py-3">
          <div
            className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onTransfer}
              className="h-7 px-2 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
            >
              <ArrowRightLeft size={12} aria-hidden="true" />
              Move
            </button>
            <button onClick={onAdjust} className="h-7 px-2 rounded-md text-xs font-medium text-foreground hover:bg-muted transition-colors">
              Adjust
            </button>
            <button
              onClick={onDelete}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              aria-label="Remove from warehouse"
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded location breakdown */}
      {open && (
        <tr className="border-b border-border/50 bg-surface-offset/50">
          <td colSpan={6} className="px-4 pb-3 pt-1">
            {!detail ? (
              <div className="flex gap-2 py-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-7 w-28 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (detail.locations ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">Not allocated to any location yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2 py-1">
                {(detail.locations ?? []).map((ls) => {
                  const loc = locations.find((l) => l.id === ls.locationId);
                  const locLow = parseFloat(ls.quantity) <= parseFloat(ls.lowThreshold);
                  return (
                    <div
                      key={ls.id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs',
                        locLow ? 'bg-destructive/5 border-destructive/20 text-destructive' : 'bg-card border-border text-foreground',
                      )}
                    >
                      <span className="font-medium">{loc?.name ?? ls.locationId}</span>
                      <span className={cn('tabular-nums font-semibold', locLow ? 'text-destructive' : 'text-primary')}>{ls.quantity}</span>
                      <span className="text-muted-foreground">{row.stockItem?.unit}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

type ModalState = { type: 'add' } | { type: 'adjust'; row: TenantStock } | { type: 'transfer'; row: TenantStock };

export function WarehousePanel() {
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState | null>(null);

  const { data: tenantStock = [], isLoading } = useQuery({
    queryKey: ['tenant-stock'],
    queryFn: getTenantStock,
    enabled: !!tenantId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: (data: { stockItemId: string; quantity: string; lowThreshold: string }) => addTenantStock(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-stock'] });
      setModal(null);
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => adjustTenantStock(id, delta),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['tenant-stock'] });
      qc.invalidateQueries({ queryKey: ['tenant-stock-detail'] });
      setModal(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeTenantStock,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-stock'] }),
  });

  const transferMutation = useMutation({
    mutationFn: async ({
      row,
      fromLocationStockId,
      toLocationId,
      toLocationStockId,
      quantity,
    }: {
      row: TenantStock;
      fromLocationStockId: string | null;
      toLocationId: string;
      toLocationStockId: string | null;
      quantity: number;
    }) => {
      if (fromLocationStockId) {
        return transferLocationStock(fromLocationStockId, toLocationId, quantity);
      }
      // Warehouse → location via receive (deducts warehouse stock + audit log)
      if (!toLocationStockId) throw new Error('No location stock row for this item at the selected location.');
      return receiveLocationStock(toLocationStockId, quantity);
    },
    onSuccess: (_, { row }) => {
      qc.invalidateQueries({ queryKey: ['tenant-stock'] });
      qc.invalidateQueries({ queryKey: ['tenant-stock-detail', row.stockItemId] });
      qc.invalidateQueries({ queryKey: ['location-stock'] });
      setModal(null);
    },
  });

  const alreadyTracked = useMemo(() => new Set(tenantStock.map((r) => r.stockItemId)), [tenantStock]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? tenantStock.filter((r) => r.stockItem?.name.toLowerCase().includes(q) || r.stockItem?.unit.toLowerCase().includes(q))
      : tenantStock;
  }, [tenantStock, search]);

  const isPending = addMutation.isPending || adjustMutation.isPending || removeMutation.isPending || transferMutation.isPending;

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
          placeholder="Search warehouse stock…"
          className="flex-1 h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150"
        />
        <button
          onClick={() => setModal({ type: 'add' })}
          className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus size={15} aria-hidden="true" />
          Add Stock
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title="No warehouse stock" description="Add stock items to start tracking warehouse inventory." />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2.5 w-6" />
                <th className="text-left pb-2.5 pr-4">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Item</span>
                </th>
                <th className="text-left pb-2.5 pr-4 w-20">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unit</span>
                </th>
                <th className="text-right pb-2.5 pr-4 w-28">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Qty</span>
                </th>
                <th className="text-right pb-2.5 pr-4 w-28">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Threshold</span>
                </th>
                <th className="pb-2.5 w-36" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <TenantStockRow
                  key={row.id}
                  row={row}
                  locations={locations}
                  onAdjust={() => setModal({ type: 'adjust', row })}
                  onTransfer={() => setModal({ type: 'transfer', row })}
                  onDelete={() => removeMutation.mutate(row.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal?.type === 'add' && (
        <Modal title="Add to Warehouse" onClose={() => setModal(null)}>
          <AddToWarehouseForm
            alreadyTracked={alreadyTracked}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSubmit={(stockItemId, quantity, lowThreshold) => addMutation.mutate({ stockItemId, quantity, lowThreshold })}
          />
        </Modal>
      )}

      {modal?.type === 'adjust' && (
        <Modal title={`Adjust — ${modal.row.stockItem?.name}`} onClose={() => setModal(null)}>
          <AdjustForm
            row={modal.row}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSubmit={(delta) => adjustMutation.mutate({ id: modal.row.id, delta })}
          />
        </Modal>
      )}

      {modal?.type === 'transfer' && (
        <TransferModalWrapper
          row={modal.row}
          locations={locations}
          onClose={() => setModal(null)}
          isPending={isPending}
          onSubmit={(fromLocStockId, toLocationId, quantity, toLocStockId) =>
            transferMutation.mutate({
              row: modal.row,
              fromLocationStockId: fromLocStockId,
              toLocationId,
              toLocationStockId: toLocStockId,
              quantity,
            })
          }
        />
      )}
    </div>
  );
}

// Fetches detail before rendering the transfer form
function TransferModalWrapper({
  row,
  locations,
  onClose,
  isPending,
  onSubmit,
}: {
  row: TenantStock;
  locations: { id: string; name: string }[];
  onClose: () => void;
  isPending: boolean;
  onSubmit: (fromLocStockId: string | null, toLocationId: string, quantity: number, toLocStockId: string | null) => void;
}) {
  const { data: detail, isLoading } = useQuery<TenantStockDetail>({
    queryKey: ['tenant-stock-detail', row.stockItemId],
    queryFn: () => getTenantStockItem(row.stockItemId),
  });

  return (
    <Modal title={`Move Stock — ${row.stockItem?.name}`} onClose={onClose}>
      {isLoading || !detail ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <TransferForm detail={detail} locations={locations} onClose={onClose} isPending={isPending} onSubmit={onSubmit} />
      )}
    </Modal>
  );
}
