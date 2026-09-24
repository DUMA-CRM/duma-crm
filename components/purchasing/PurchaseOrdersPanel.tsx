'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Check, Plus, Trash2, Truck } from '@/components/icons';
import {
  FormActions,
  STATUS_META,
  fmtQty,
  inputClass,
  labelClass,
  lineTotal,
  linesTotal,
  money,
  selectClass,
  unitMoney,
} from '@/components/purchasing/shared';
import { ConfirmDrawer } from '@/components/shared/ConfirmDrawer';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';

import { getStockItems } from '@/lib/modules/inventory/client';
import { updateRestockRequest } from '@/lib/modules/inventory/client';
import {
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type Supplier,
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrders,
  receivePurchaseOrder,
  updatePurchaseOrder,
} from '@/lib/modules/purchasing/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';

const fmtDate = (iso?: string | null) => formatDate(iso);
const defaultExpiry = (shelfLifeDays?: number | null) => {
  if (!shelfLifeDays) return '';
  const date = new Date();
  date.setDate(date.getDate() + shelfLifeDays);
  return date.toISOString().slice(0, 10);
};

// ── Create PO ─────────────────────────────────────────────────────────────────

export interface DraftLine {
  stockItemId: string;
  quantity: string;
  unitCost: string;
}

export interface PurchaseOrderDraft {
  locationId: string;
  /** Restock requests this PO fulfils — all are marked ordered once it is created. */
  restockRequestIds?: string[];
  notes?: string;
  lines: DraftLine[];
}

function CreatePoForm({
  suppliers,
  locationId,
  draft,
  onClose,
  onManageSuppliers,
}: {
  suppliers: Supplier[];
  locationId: string;
  draft?: PurchaseOrderDraft | null;
  onClose: () => void;
  onManageSuppliers?: () => void;
}) {
  const qc = useQueryClient();
  const { data: stockItems = [] } = useQuery({ queryKey: moduleQueryKeys.inventory.key('stock-items'), queryFn: getStockItems });
  const [supplierId, setSupplierId] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState(draft?.notes ?? '');
  const [lines, setLines] = useState<DraftLine[]>(draft?.lines ?? [{ stockItemId: '', quantity: '', unitCost: '' }]);

  const validLines = lines.filter((l) => l.stockItemId && Number(l.quantity) > 0 && Number(l.unitCost) >= 0);
  const total = validLines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitCost), 0);
  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      createPurchaseOrder({
        supplierId,
        locationId,
        expectedAt: expectedAt || undefined,
        notes: notes || undefined,
        lines: validLines.map((l) => ({ stockItemId: l.stockItemId, quantityOrdered: Number(l.quantity), unitCost: Number(l.unitCost) })),
      }),
    onSuccess: async () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.purchasing.key('purchase-orders') });
      const linked = draft?.restockRequestIds ?? [];
      if (linked.length > 0) {
        try {
          await Promise.all(linked.map((requestId) => updateRestockRequest(requestId, { status: 'fulfilled' })));
          void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('restock-requests') });
          toast(
            'success',
            linked.length === 1
              ? 'Purchase order created and restock demand moved to ordered.'
              : `Purchase order created — ${linked.length} requests moved to ordered.`,
          );
        } catch (error) {
          toast('error', error instanceof Error ? error.message : 'Purchase order created, but the demand status could not be updated.');
        }
      } else {
        toast('success', 'Purchase order created.');
      }
      onClose();
    },
  });

  const itemMap = new Map(stockItems.map((s) => [s.id, s]));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (supplierId && validLines.length > 0) mutate();
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Supplier</label>
          <Select
            value={supplierId}
            onValueChange={setSupplierId}
            options={[
              { value: '', label: 'Select…' },
              ...activeSuppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
            ]}
            ariaLabel="Supplier"
            required
            className={selectClass}
          />
        </div>
        <DatePicker label="Expected delivery" value={expectedAt} onValueChange={setExpectedAt} />
      </div>

      {activeSuppliers.length === 0 && (
        <div className="flex items-center justify-between gap-3 rounded-sm border border-warning/20 bg-warning/5 px-3 py-2.5">
          <p className="text-xs text-warning">Add an active supplier before creating a purchase order.</p>
          {onManageSuppliers && (
            <Button type="button" variant="outline" size="sm" onClick={onManageSuppliers}>
              Add supplier
            </Button>
          )}
        </div>
      )}

      <div>
        <label className={labelClass}>Lines</label>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.5rem_5.5rem_2.25rem] items-center gap-2">
              <Select
                value={line.stockItemId}
                onValueChange={(value) =>
                  setLines(lines.map((draftLine, index) => (index === i ? { ...draftLine, stockItemId: value } : draftLine)))
                }
                options={[{ value: '', label: 'Item…' }, ...stockItems.map((item) => ({ value: item.id, label: item.name }))]}
                ariaLabel={`Item for purchase order line ${i + 1}`}
                className={cn(selectClass, 'flex-1 min-w-0')}
              />
              <input
                value={line.quantity}
                onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, quantity: e.target.value } : l)))}
                inputMode="decimal"
                placeholder="Qty"
                aria-label="Quantity"
                className={cn(inputClass, 'w-20 text-right tabular-nums')}
              />
              <span className="text-xs text-muted-foreground w-8 shrink-0">{itemMap.get(line.stockItemId)?.unit ?? ''}</span>
              <input
                value={line.unitCost}
                onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, unitCost: e.target.value } : l)))}
                inputMode="decimal"
                placeholder="£/unit"
                aria-label="Unit cost"
                className={cn(inputClass, 'w-20 text-right tabular-nums')}
              />
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setLines(lines.filter((_, j) => j !== i))}
                aria-label="Remove line"
                className="text-muted-foreground/60 hover:text-destructive shrink-0"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => setLines([...lines, { stockItemId: '', quantity: '', unitCost: '' }])}
          className="mt-2 gap-1.5"
        >
          <Plus size={14} />
          Add line
        </Button>
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass + ' h-auto py-2 resize-none'} />
      </div>

      <div className="flex items-center justify-between border-t border-rule pt-3">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total</span>
        <span className="text-lg font-bold text-primary tabular-nums">{money(total)}</span>
      </div>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      <FormActions
        onClose={onClose}
        isPending={isPending}
        disabled={!supplierId || validLines.length === 0}
        submitLabel="Create purchase order"
      />
    </form>
  );
}

// ── PO detail (submit / receive / invoice) ────────────────────────────────────

function PoDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: po } = useQuery({ queryKey: moduleQueryKeys.purchasing.key('purchase-order', id), queryFn: () => getPurchaseOrder(id) });
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [receiveContainers, setReceiveContainers] = useState<Record<string, string>>({});
  const [receiveExpiry, setReceiveExpiry] = useState<Record<string, string>>({});
  const [receiveLot, setReceiveLot] = useState<Record<string, string>>({});
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: moduleQueryKeys.purchasing.key('purchase-orders') });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.purchasing.key('purchase-order', id) });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('location-stock') });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-items') });
  };

  const update = useMutation({
    mutationFn: (data: Parameters<typeof updatePurchaseOrder>[1]) => updatePurchaseOrder(id, data),
    onSuccess: () => {
      invalidate();
      setCancelOpen(false);
      toast('success', 'Purchase order updated.');
    },
    onError: (err) => toast('error', err.message || 'The purchase order wasn’t updated. Try again.'),
  });

  const receive = useMutation({
    mutationFn: () => {
      // Untouched inputs default to the outstanding amount — mirror exactly
      // what the form displays, otherwise unedited lines would submit as 0.
      const lines = (po?.lines ?? [])
        .map((l) => {
          const total = Number(receiveQty[l.id] ?? Math.max(0, Number(l.quantityOrdered) - Number(l.quantityReceived))) || 0;
          if (total <= 0) return null;
          const defaultContainer = Number(l.stockItem?.defaultContainerQuantity ?? 0);
          const enteredCount = Math.max(0, Math.floor(Number(receiveContainers[l.id] ?? 0)));
          const expiryDate = receiveExpiry[l.id] || defaultExpiry(l.stockItem?.defaultShelfLifeDays) || undefined;
          const lotNumber = receiveLot[l.id] || undefined;
          const quantities: number[] = [];
          if (enteredCount > 0) {
            const each = total / enteredCount;
            for (let i = 0; i < enteredCount; i++) quantities.push(each);
          } else if (defaultContainer > 0) {
            const full = Math.floor(total / defaultContainer);
            for (let i = 0; i < full; i++) quantities.push(defaultContainer);
            const remainder = total - full * defaultContainer;
            if (remainder > 0.0001) quantities.push(remainder);
          } else {
            quantities.push(total);
          }
          if (l.stockItem?.isPerishable && !expiryDate) throw new Error(`Enter an expiry date for ${l.stockItem.name}.`);
          return {
            purchaseOrderLineId: l.id,
            units: quantities.map((initialQuantity) => ({ initialQuantity, expiryDate, lotNumber })),
          };
        })
        .filter((line): line is NonNullable<typeof line> => line !== null);
      if (lines.length === 0) return Promise.reject(new Error('Enter a received quantity for at least one line.'));
      return receivePurchaseOrder(id, { lines });
    },
    onSuccess: (res) => {
      invalidate();
      setReceiveOpen(false);
      setReceiveQty({});
      setReceiveContainers({});
      setReceiveExpiry({});
      setReceiveLot({});
      toast('success', res.status === 'received' ? 'All goods received — purchase order complete.' : 'Delivery recorded.');
    },
    onError: (err) => toast('error', err.message || 'The delivery wasn’t recorded. Check the quantities and try again.'),
  });

  if (!po) return <div className="h-40 rounded-sm bg-muted animate-pulse" />;

  const meta = STATUS_META[po.status];
  const total = linesTotal(po.lines);
  const invoiceValue = invoiceAmount !== null ? invoiceAmount : (po.invoiceAmount ?? '');
  const invoiceNumValue = invoiceNumber !== null ? invoiceNumber : (po.invoiceNumber ?? '');
  const invoiceDelta = invoiceValue !== '' ? Math.abs(Number(invoiceValue) - total) : null;
  const outstanding = (l: NonNullable<PurchaseOrder['lines']>[number]) =>
    Math.max(0, Number(l.quantityOrdered) - Number(l.quantityReceived));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-foreground">{po.reference}</p>
          <p className="text-xs text-muted-foreground">
            {po.supplier?.name} → {po.location?.name} · expected {fmtDate(po.expectedAt)}
          </p>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>

      {/* Lines */}
      <div className="border border-rule rounded-sm overflow-hidden">
        <DataTable className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-micro font-semibold text-muted-foreground uppercase tracking-micro">
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-right">Ordered</th>
              <th className="px-3 py-2 text-right">Cost/unit</th>
              <th className="px-3 py-2 text-right">Received</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(po.lines ?? []).map((l) => (
              <tr key={l.id} className="border-t border-rule">
                <td className="px-3 py-2 font-medium text-foreground">{l.stockItem?.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtQty(l.quantityOrdered)} {l.stockItem?.unit}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{unitMoney(l.unitCost)}</td>
                <td className={cn('px-3 py-2 text-right tabular-nums', outstanding(l) === 0 ? 'text-success' : 'text-muted-foreground')}>
                  {fmtQty(l.quantityReceived)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{money(lineTotal(l))}</td>
              </tr>
            ))}
            <tr className="border-t border-rule bg-band">
              <td colSpan={4} className="px-3 py-2 text-right text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                Total
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-bold text-primary">{money(total)}</td>
            </tr>
          </tbody>
        </DataTable>
      </div>

      {po.notes && <p className="text-xs text-muted-foreground">{po.notes}</p>}

      {/* Receive goods */}
      {receiveOpen && (
        <div className="border border-primary/30 bg-band rounded-sm p-3 space-y-2">
          <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Receive delivery</p>
          {(po.lines ?? []).map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_6rem_4.5rem_8rem_7rem] items-end gap-2">
              <span className="text-sm text-foreground truncate pb-2">{l.stockItem?.name}</span>
              <label className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                Total
                <input
                  value={receiveQty[l.id] ?? String(outstanding(l))}
                  onChange={(e) => setReceiveQty((prev) => ({ ...prev, [l.id]: e.target.value }))}
                  inputMode="decimal"
                  aria-label={`Received ${l.stockItem?.name}`}
                  className={cn(inputClass, 'mt-1 w-full text-right tabular-nums')}
                />
              </label>
              <label className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                Units
                <input
                  value={receiveContainers[l.id] ?? ''}
                  onChange={(e) => setReceiveContainers((prev) => ({ ...prev, [l.id]: e.target.value }))}
                  inputMode="numeric"
                  placeholder={l.stockItem?.defaultContainerQuantity ? 'Auto' : '1'}
                  aria-label={`Containers of ${l.stockItem?.name}`}
                  className={cn(inputClass, 'mt-1 w-full text-right tabular-nums')}
                />
              </label>
              <DatePicker
                label="Expiry"
                value={receiveExpiry[l.id] ?? defaultExpiry(l.stockItem?.defaultShelfLifeDays)}
                onValueChange={(expiry) => setReceiveExpiry((prev) => ({ ...prev, [l.id]: expiry }))}
                aria-label={`Expiry of ${l.stockItem?.name}`}
                required={l.stockItem?.isPerishable}
              />
              <label className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                Lot
                <input
                  value={receiveLot[l.id] ?? ''}
                  onChange={(e) => setReceiveLot((prev) => ({ ...prev, [l.id]: e.target.value }))}
                  placeholder="Optional"
                  aria-label={`Lot of ${l.stockItem?.name}`}
                  className={cn(inputClass, 'mt-1 w-full')}
                />
              </label>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setReceiveOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button size="sm" onClick={() => receive.mutate()} disabled={receive.isPending} className="flex-1">
              {receive.isPending ? 'Recording…' : 'Record Delivery'}
            </Button>
          </div>
        </div>
      )}

      {/* Invoice matching */}
      {po.status !== 'draft' && po.status !== 'cancelled' && (
        <div className="border border-rule rounded-sm p-3 space-y-2">
          <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Invoice</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={invoiceNumValue}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Invoice number"
              className={inputClass}
            />
            <input
              value={invoiceValue}
              onChange={(e) => setInvoiceAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Invoice amount £"
              className={cn(inputClass, 'text-right tabular-nums')}
            />
          </div>
          {invoiceDelta !== null && (
            <p className={cn('text-xs', invoiceDelta <= 0.01 ? 'text-success' : 'text-warning')}>
              {invoiceDelta <= 0.01
                ? 'Invoice matches the purchase order total.'
                : `Invoice differs from the PO total (${money(total)}) by ${money(invoiceDelta)}.`}
            </p>
          )}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-foreground">
              <input
                type="checkbox"
                checked={po.invoiceMatched}
                onChange={(e) => update.mutate({ invoiceMatched: e.target.checked })}
                className="w-4 h-4 rounded accent-primary"
              />
              Matched
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                update.mutate({
                  invoiceNumber: invoiceNumValue || null,
                  invoiceAmount: invoiceValue === '' ? null : Number(invoiceValue),
                })
              }
              disabled={update.isPending}
            >
              Save Invoice
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {po.status === 'draft' && (
          <Button onClick={() => update.mutate({ status: 'submitted' })} disabled={update.isPending} className="flex-1 h-11 gap-1.5">
            <Check size={15} />
            Submit to Supplier
          </Button>
        )}
        {(po.status === 'submitted' || po.status === 'partially_received') && !receiveOpen && (
          <Button onClick={() => setReceiveOpen(true)} className="flex-1 h-11 gap-1.5">
            <Truck size={15} />
            Receive Goods
          </Button>
        )}
        {(po.status === 'draft' || po.status === 'submitted') && (
          <Button variant="outline" onClick={() => setCancelOpen(true)} className="h-11 text-destructive hover:text-destructive">
            Cancel PO
          </Button>
        )}
        <Button variant="outline" onClick={onClose} className="h-11">
          Close
        </Button>
      </div>

      {cancelOpen && (
        <ConfirmDrawer
          title="Cancel Purchase Order"
          message={
            <>
              Cancel <span className="font-semibold text-foreground">{po.reference}</span>? This cannot be undone.
            </>
          }
          isPending={update.isPending}
          onConfirm={() => update.mutate({ status: 'cancelled' })}
          onClose={() => setCancelOpen(false)}
        />
      )}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function PurchaseOrdersPanel({
  suppliers,
  locationId,
  createOpen,
  onCreateOpenChange,
  draft,
  onManageSuppliers,
  status,
  onStatusChange,
}: {
  suppliers: Supplier[];
  locationId: string;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  draft?: PurchaseOrderDraft | null;
  onManageSuppliers?: () => void;
  /** Controlled status filter — omit and the panel keeps its own. */
  status?: 'all' | PurchaseOrderStatus;
  onStatusChange?: (status: 'all' | PurchaseOrderStatus) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [ownStatus, setOwnStatus] = useState<'all' | PurchaseOrderStatus>('all');
  const statusFilter = status ?? ownStatus;
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: moduleQueryKeys.purchasing.key('purchase-orders', locationId, statusFilter, supplierFilter, page),
    queryFn: () =>
      getPurchaseOrders({
        locationId,
        status: statusFilter === 'all' ? undefined : statusFilter,
        supplierId: supplierFilter === 'all' ? undefined : supplierFilter,
        page,
        limit: 25,
      }),
    placeholderData: (previous) => previous,
  });
  const pos = data?.data ?? [];

  return (
    <div className="min-h-0 bg-card border border-rule rounded-sm overflow-hidden flex flex-col">
      <div className="grid gap-2 border-b border-rule p-3 sm:grid-cols-2 xl:grid-cols-[14rem_16rem_1fr]">
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            const next = value as 'all' | PurchaseOrderStatus;
            if (onStatusChange) onStatusChange(next);
            else setOwnStatus(next);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All purchase order statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'submitted', label: 'Awaiting delivery' },
            { value: 'partially_received', label: 'Partially received' },
            { value: 'received', label: 'Received' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          ariaLabel="Filter purchase orders by status"
          className="w-full"
        />
        <Select
          value={supplierFilter}
          onValueChange={(value) => {
            setSupplierFilter(value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All suppliers' },
            ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
          ]}
          ariaLabel="Filter purchase orders by supplier"
          className="w-full"
        />
        <p className="flex items-center justify-end text-xs text-muted-foreground">
          {isFetching && !isLoading ? 'Updating…' : `${data?.total ?? 0} purchase order${data?.total === 1 ? '' : 's'}`}
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : pos.length === 0 ? (
          <div className="py-24">
            <EmptyState icon={Truck} title="No purchase orders yet" description="Create a purchase order to order stock from a supplier." />
          </div>
        ) : (
          <DataTable className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-rule bg-muted">
                <th className="px-3 md:px-5 py-3.5 text-left text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                  PO
                </th>
                <th className="px-3 md:px-5 py-3.5 text-left text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                  Supplier
                </th>
                <th className="hidden md:table-cell px-5 py-3.5 text-left text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                  Expected
                </th>
                <th className="px-3 md:px-5 py-3.5 text-left text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                  Status
                </th>
                <th className="hidden md:table-cell px-5 py-3.5 text-left text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                  Invoice
                </th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => {
                const meta = STATUS_META[po.status];
                return (
                  <tr
                    key={po.id}
                    onClick={() => setDetailId(po.id)}
                    className="border-b border-rule last:border-0 hover:bg-band transition-colors cursor-pointer"
                  >
                    <td className="px-3 md:px-5 py-3.5 font-mono font-bold text-foreground">{po.reference}</td>
                    <td className="px-3 md:px-5 py-3.5 text-foreground">{po.supplier?.name}</td>
                    <td className="hidden md:table-cell px-5 py-3.5 text-muted-foreground tabular-nums">{fmtDate(po.expectedAt)}</td>
                    <td className="px-3 md:px-5 py-3.5">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </td>
                    <td className="hidden md:table-cell px-5 py-3.5">
                      {po.invoiceMatched ? (
                        <Badge variant="success">Matched</Badge>
                      ) : po.invoiceNumber ? (
                        <Badge variant="warning">Unmatched</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </div>

      {!isLoading && (data?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-between border-t border-rule bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Page {page} of {data?.pages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (data?.pages ?? 1) || isFetching}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {createOpen && (
        <Drawer
          title="New Purchase Order"
          description="Pick a supplier, list what you're ordering, and send it."
          onClose={() => onCreateOpenChange(false)}
        >
          <CreatePoForm
            key={draft?.restockRequestIds?.join(',') ?? 'blank'}
            suppliers={suppliers}
            locationId={draft?.locationId ?? locationId}
            draft={draft}
            onClose={() => onCreateOpenChange(false)}
            onManageSuppliers={onManageSuppliers}
          />
        </Drawer>
      )}
      {detailId && (
        <Drawer title="Purchase Order" onClose={() => setDetailId(null)} className="max-w-2xl">
          <PoDetail id={detailId} onClose={() => setDetailId(null)} />
        </Drawer>
      )}
    </div>
  );
}
