'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';

import { FormActions, STATUS_META, inputClass, labelClass, lineTotal, linesTotal, money, selectClass, unitMoney, fmtQty } from '@/components/purchasing/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getStockItems } from '@/lib/api/inventory.service';
import {
  type PurchaseOrder,
  type Supplier,
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrders,
  receivePurchaseOrder,
  updatePurchaseOrder,
} from '@/lib/api/purchasing.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');

// ── Create PO ─────────────────────────────────────────────────────────────────

interface DraftLine {
  stockItemId: string;
  quantity: string;
  unitCost: string;
}

function CreatePoForm({ suppliers, locationId, onClose }: { suppliers: Supplier[]; locationId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: stockItems = [] } = useQuery({ queryKey: ['stock-items'], queryFn: getStockItems });
  const [supplierId, setSupplierId] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ stockItemId: '', quantity: '', unitCost: '' }]);

  const validLines = lines.filter((l) => l.stockItemId && Number(l.quantity) > 0 && Number(l.unitCost) >= 0);
  const total = validLines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitCost), 0);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      createPurchaseOrder({
        supplierId,
        locationId,
        expectedAt: expectedAt || undefined,
        notes: notes || undefined,
        lines: validLines.map((l) => ({ stockItemId: l.stockItemId, quantityOrdered: Number(l.quantity), unitCost: Number(l.unitCost) })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast('success', 'Purchase order created.');
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Supplier</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required className={selectClass}>
            <option value="">Select…</option>
            {suppliers
              .filter((s) => s.isActive)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Expected delivery</label>
          <input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Lines</label>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={line.stockItemId}
                onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, stockItemId: e.target.value } : l)))}
                className={cn(selectClass, 'flex-1 min-w-0')}
              >
                <option value="">Item…</option>
                {stockItems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total</span>
        <span className="text-lg font-bold text-primary tabular-nums">{money(total)}</span>
      </div>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      <FormActions onClose={onClose} isPending={isPending} disabled={!supplierId || validLines.length === 0} submitLabel="Create PO" />
    </form>
  );
}

// ── PO detail (submit / receive / invoice) ────────────────────────────────────

function PoDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: po } = useQuery({ queryKey: ['purchase-order', id], queryFn: () => getPurchaseOrder(id) });
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    qc.invalidateQueries({ queryKey: ['purchase-order', id] });
    qc.invalidateQueries({ queryKey: ['location-stock'] });
    qc.invalidateQueries({ queryKey: ['stock-items'] });
  };

  const update = useMutation({
    mutationFn: (data: Parameters<typeof updatePurchaseOrder>[1]) => updatePurchaseOrder(id, data),
    onSuccess: () => {
      invalidate();
      setCancelOpen(false);
      toast('success', 'Purchase order updated.');
    },
    onError: (err) => toast('error', err.message || 'Failed to update the PO.'),
  });

  const receive = useMutation({
    mutationFn: () => {
      // Untouched inputs default to the outstanding amount — mirror exactly
      // what the form displays, otherwise unedited lines would submit as 0.
      const lines = (po?.lines ?? [])
        .map((l) => ({
          purchaseOrderLineId: l.id,
          quantity: Number(receiveQty[l.id] ?? Math.max(0, Number(l.quantityOrdered) - Number(l.quantityReceived))) || 0,
        }))
        .filter((l) => l.quantity > 0);
      if (lines.length === 0) return Promise.reject(new Error('Enter a received quantity for at least one line.'));
      return receivePurchaseOrder(id, { lines });
    },
    onSuccess: (res) => {
      invalidate();
      setReceiveOpen(false);
      setReceiveQty({});
      toast('success', res.status === 'received' ? 'All goods received — PO complete.' : 'Delivery recorded.');
    },
    onError: (err) => toast('error', err.message || 'Failed to record the delivery.'),
  });

  if (!po) return <div className="h-40 rounded-lg bg-muted animate-pulse" />;

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
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-right">Ordered</th>
              <th className="px-3 py-2 text-right">Cost/unit</th>
              <th className="px-3 py-2 text-right">Received</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(po.lines ?? []).map((l) => (
              <tr key={l.id} className="border-t border-border/50">
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
            <tr className="border-t border-border bg-surface-offset/50">
              <td colSpan={4} className="px-3 py-2 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Total
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-bold text-primary">{money(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {po.notes && <p className="text-xs text-muted-foreground">{po.notes}</p>}

      {/* Receive goods */}
      {receiveOpen && (
        <div className="border border-primary/30 bg-primary/5 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Receive delivery</p>
          {(po.lines ?? []).map((l) => (
            <div key={l.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-foreground truncate">{l.stockItem?.name}</span>
              <input
                value={receiveQty[l.id] ?? String(outstanding(l))}
                onChange={(e) => setReceiveQty((prev) => ({ ...prev, [l.id]: e.target.value }))}
                inputMode="decimal"
                aria-label={`Received ${l.stockItem?.name}`}
                className={cn(inputClass, 'w-24 text-right tabular-nums')}
              />
              <span className="text-xs text-muted-foreground w-8">{l.stockItem?.unit}</span>
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
        <div className="border border-border rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Invoice</p>
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
                ? 'Invoice matches the PO total.'
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
        <ConfirmModal
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
}: {
  suppliers: Supplier[];
  locationId: string;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', locationId],
    queryFn: () => getPurchaseOrders({ locationId, limit: 50 }),
  });
  const pos = data?.data ?? [];

  return (
    <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : pos.length === 0 ? (
          <div className="py-24">
            <EmptyState icon={Truck} title="No purchase orders" description='Click "New PO" to order stock from a supplier.' />
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted">
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">PO</th>
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Supplier</th>
                <th className="hidden md:table-cell px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Expected</th>
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                <th className="hidden md:table-cell px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => {
                const meta = STATUS_META[po.status];
                return (
                  <tr
                    key={po.id}
                    onClick={() => setDetailId(po.id)}
                    className="border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
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
          </table>
        )}
      </div>

      {createOpen && (
        <Modal title="New Purchase Order" onClose={() => onCreateOpenChange(false)} className="max-w-xl">
          <CreatePoForm suppliers={suppliers} locationId={locationId} onClose={() => onCreateOpenChange(false)} />
        </Modal>
      )}
      {detailId && (
        <Modal title="Purchase Order" onClose={() => setDetailId(null)} className="max-w-2xl">
          <PoDetail id={detailId} onClose={() => setDetailId(null)} />
        </Modal>
      )}
    </div>
  );
}
