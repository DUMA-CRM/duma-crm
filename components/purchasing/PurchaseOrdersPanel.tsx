'use client';

import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useCallback, useMemo, useState } from 'react';

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  Package,
  PackageCheck,
  Plus,
  Send,
  Trash2,
  Truck,
  XCircle,
} from '@/components/icons';
import { fmtQty } from '@/components/purchasing/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact, Switch } from '@/components/settings/controls';
import { ConfirmDrawer } from '@/components/shared/ConfirmDrawer';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ModalActions } from '@/components/shared/FormParts';
import { LoadMore } from '@/components/shared/LoadMore';
import { useWorkspaceCurrency, useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { getStockItems } from '@/lib/modules/inventory/client';
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
import { dueLabel, invoiceDifference, isOverdue, orderTotal, receivedShare } from '@/lib/utils/purchase-orders';
import { dayLabel } from '@/lib/utils/restock-queue';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

/*
 * Purchase orders, in the restock tab's vocabulary: a summary across the top,
 * a status and supplier selector, then orders by the day they were raised as
 * audit-log rows — reference and supplier, when it's due (or how late), the
 * invoice, a pill, and the next step. The drawer holds the order itself.
 */

const STATUSES: PurchaseOrderStatus[] = ['draft', 'submitted', 'partially_received', 'received', 'cancelled'];

const STATUS: Record<PurchaseOrderStatus, { label: string; tint: string; icon: typeof Truck }> = {
  draft: { label: 'Draft', tint: 'bg-band text-muted-foreground', icon: FileText },
  submitted: { label: 'Awaiting delivery', tint: 'bg-reference/8 text-reference', icon: Send },
  partially_received: { label: 'Part delivered', tint: 'bg-measured/10 text-measured', icon: Truck },
  received: { label: 'Received', tint: 'bg-momentum/8 text-momentum', icon: PackageCheck },
  cancelled: { label: 'Cancelled', tint: 'bg-band text-muted-foreground', icon: XCircle },
};

const defaultExpiry = (shelfLifeDays?: number | null) => {
  if (!shelfLifeDays) return '';
  const date = new Date();
  date.setDate(date.getDate() + shelfLifeDays);
  return date.toISOString().slice(0, 10);
};

/** Unit costs keep up to four decimals — shown in the workspace currency. */
function useUnitMoney() {
  const currency = useWorkspaceCurrency();
  return useCallback(
    (amount: string | number) => {
      try {
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency,
          currencyDisplay: 'narrowSymbol',
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        }).format(Number(amount) || 0);
      } catch {
        return `${Number(amount || 0).toFixed(2)} ${currency}`;
      }
    },
    [currency],
  );
}

// ── Create ───────────────────────────────────────────────────────────────────

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

function CreatePoDrawer({
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
  const money = useWorkspaceMoney();
  const currency = useWorkspaceCurrency();
  const { data: stockItems = [] } = useQuery({ queryKey: moduleQueryKeys.inventory.key('stock-items'), queryFn: getStockItems });
  const [supplierId, setSupplierId] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState(draft?.notes ?? '');
  const [lines, setLines] = useState<DraftLine[]>(draft?.lines ?? [{ stockItemId: '', quantity: '', unitCost: '' }]);
  const validLines = lines.filter((l) => l.stockItemId && Number(l.quantity) > 0 && Number(l.unitCost) >= 0);
  const total = validLines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitCost), 0);
  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive);
  const itemMap = new Map(stockItems.map((item) => [item.id, item]));
  const setLine = (index: number, patch: Partial<DraftLine>) =>
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const create = useMutation({
    mutationFn: () =>
      createPurchaseOrder({
        supplierId,
        locationId,
        expectedAt: expectedAt || undefined,
        notes: notes || undefined,
        restockRequestIds: draft?.restockRequestIds,
        lines: validLines.map((l) => ({ stockItemId: l.stockItemId, quantityOrdered: Number(l.quantity), unitCost: Number(l.unitCost) })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.purchasing.key('purchase-orders') });
      const linked = draft?.restockRequestIds ?? [];
      if (linked.length > 0) {
        void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('restock-requests') });
        toast(
          'success',
          linked.length === 1
            ? 'Purchase order created and linked to the restock request.'
            : `Purchase order created and linked to ${linked.length} restock requests.`,
        );
      } else {
        toast('success', 'Purchase order created.');
      }
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'The purchase order wasn’t created. Try again.'),
  });

  return (
    <Drawer
      title="New purchase order"
      description={draft?.notes ?? 'Pick a supplier, list what you’re ordering, and save it as a draft.'}
      onClose={onClose}
      footer={
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">
              {validLines.length} {validLines.length === 1 ? 'line' : 'lines'}
            </span>
            <span className="text-lg font-semibold text-foreground">{money(total)}</span>
          </div>
          <ModalActions
            form="create-po"
            submitLabel="Create purchase order"
            pending={create.isPending}
            disabled={!supplierId || validLines.length === 0}
            onCancel={onClose}
          />
        </div>
      }
    >
      <form
        id="create-po"
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (supplierId && validLines.length > 0) create.mutate();
        }}
      >
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Supplier and delivery</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-label uppercase text-muted-foreground">Supplier</p>
              <Select
                value={supplierId}
                onValueChange={setSupplierId}
                options={[
                  { value: '', label: 'Choose a supplier' },
                  ...activeSuppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
                ]}
                ariaLabel="Supplier"
                className="w-full"
              />
            </div>
            <DatePicker label="Expected delivery" value={expectedAt} onValueChange={setExpectedAt} />
          </div>
          {activeSuppliers.length === 0 && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-measured/10 px-3.5 py-2.5">
              <p className="text-xs text-measured">Add an active supplier before ordering.</p>
              {onManageSuppliers && (
                <Button type="button" variant="outline" size="sm" onClick={onManageSuppliers}>
                  Add supplier
                </Button>
              )}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-foreground">What you’re ordering</h3>
            <span className="text-xs text-muted-foreground">Cost per unit in {currency}</span>
          </div>
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {lines.map((line, index) => {
              const item = itemMap.get(line.stockItemId);
              const lineTotal = Number(line.quantity) * Number(line.unitCost);
              return (
                <li key={index} className="border-b border-rule/45 px-3.5 py-3 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Select
                      value={line.stockItemId}
                      onValueChange={(value) =>
                        setLine(index, { stockItemId: value, unitCost: line.unitCost || itemMap.get(value)?.costPerUnit || '' })
                      }
                      options={[
                        { value: '', label: 'Choose an item' },
                        ...stockItems.map((option) => ({ value: option.id, label: option.name })),
                      ]}
                      ariaLabel={`Item on line ${index + 1}`}
                      className="min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setLines(lines.filter((_, i) => i !== index))}
                      aria-label={`Remove line ${index + 1}`}
                      className="text-muted-foreground hover:text-exception"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <input
                      value={line.quantity}
                      onChange={(event) => setLine(index, { quantity: event.target.value })}
                      inputMode="decimal"
                      placeholder="Qty"
                      aria-label={`Quantity on line ${index + 1}`}
                      className="h-8 w-20 rounded-md border border-input bg-background px-2 text-right text-sm text-foreground outline-none focus:border-ring"
                    />
                    <span className="w-12 truncate">{item?.unit ?? 'units'}</span>
                    <span>×</span>
                    <input
                      value={line.unitCost}
                      onChange={(event) => setLine(index, { unitCost: event.target.value })}
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-label={`Cost per unit on line ${index + 1}`}
                      className="h-8 w-24 rounded-md border border-input bg-background px-2 text-right text-sm text-foreground outline-none focus:border-ring"
                    />
                    <span className="ml-auto text-sm font-semibold text-foreground">
                      {Number.isFinite(lineTotal) && lineTotal > 0 ? money(lineTotal) : '—'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setLines([...lines, { stockItemId: '', quantity: '', unitCost: '' }])}
          >
            <Plus data-icon="inline-start" />
            Add line
          </Button>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Note</h3>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Delivery instructions, account number… (optional)"
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </section>
      </form>
    </Drawer>
  );
}

// ── Detail ───────────────────────────────────────────────────────────────────

const PROGRESS: PurchaseOrderStatus[] = ['draft', 'submitted', 'received'];

function PoDrawer({ id, canWrite, onClose }: { id: string; canWrite: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const money = useWorkspaceMoney();
  const unitMoney = useUnitMoney();
  const [now] = useState(() => new Date());
  const {
    data: po,
    isPending,
    isError,
    refetch,
  } = useQuery({ queryKey: moduleQueryKeys.purchasing.key('purchase-order', id), queryFn: () => getPurchaseOrder(id) });
  const [receiving, setReceiving] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [receiveContainers, setReceiveContainers] = useState<Record<string, string>>({});
  const [receiveExpiry, setReceiveExpiry] = useState<Record<string, string>>({});
  const [receiveLot, setReceiveLot] = useState<Record<string, string>>({});
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.purchasing.key('purchase-orders') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.purchasing.key('purchase-order', id) });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('location-stock') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('inventory-overview') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-items') });
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
      // what the form shows, or unedited lines would submit as 0.
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
          return { purchaseOrderLineId: l.id, units: quantities.map((initialQuantity) => ({ initialQuantity, expiryDate, lotNumber })) };
        })
        .filter((line): line is NonNullable<typeof line> => line !== null);
      if (lines.length === 0) return Promise.reject(new Error('Enter a received quantity for at least one line.'));
      return receivePurchaseOrder(id, { lines });
    },
    onSuccess: (res) => {
      invalidate();
      setReceiving(false);
      setReceiveQty({});
      setReceiveContainers({});
      setReceiveExpiry({});
      setReceiveLot({});
      toast('success', res.status === 'received' ? 'Everything received — the order is complete.' : 'Delivery recorded.');
    },
    onError: (err) => toast('error', err.message || 'The delivery wasn’t recorded. Check the quantities and try again.'),
  });

  if (isPending || isError || !po)
    return (
      <Drawer title="Purchase order" onClose={onClose}>
        {isError ? (
          <ErrorState title="This purchase order couldn’t be loaded" onRetry={() => void refetch()} />
        ) : (
          <div className="space-y-3" aria-hidden="true">
            <div className="h-24 animate-pulse rounded-lg bg-band/60" />
            <div className="h-48 animate-pulse rounded-lg bg-band/60" />
          </div>
        )}
      </Drawer>
    );

  const meta = STATUS[po.status];
  const total = orderTotal(po.lines);
  const share = receivedShare(po.lines);
  const invoiceValue = invoiceAmount !== null ? invoiceAmount : (po.invoiceAmount ?? '');
  const invoiceNumValue = invoiceNumber !== null ? invoiceNumber : (po.invoiceNumber ?? '');
  const difference = invoiceDifference(invoiceValue, total);
  const due = dueLabel(po, now);
  const late = isOverdue(po, now);
  const outstanding = (l: NonNullable<PurchaseOrder['lines']>[number]) =>
    Math.max(0, Number(l.quantityOrdered) - Number(l.quantityReceived));
  const open = po.status === 'submitted' || po.status === 'partially_received';
  const complete = (po.lines ?? []).filter((l) => outstanding(l) === 0).length;
  const reached = po.status === 'cancelled' ? -1 : po.status === 'partially_received' ? 1 : PROGRESS.indexOf(po.status);

  return (
    <Drawer
      title={receiving ? `Receive ${po.reference}` : po.reference}
      description={`${po.supplier?.name ?? 'Supplier'} → ${po.location?.name ?? 'location'}`}
      onClose={onClose}
      className="max-w-2xl"
      footer={
        receiving ? (
          <ModalActions
            form="receive-po"
            submitLabel="Record delivery"
            pendingLabel="Recording…"
            pending={receive.isPending}
            onCancel={() => setReceiving(false)}
          />
        ) : canWrite && po.status !== 'received' && po.status !== 'cancelled' ? (
          <div className="flex items-center gap-2">
            {(po.status === 'draft' || po.status === 'submitted') && (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                Cancel order
              </Button>
            )}
            <span className="flex-1" />
            {po.status === 'draft' && (
              <Button onClick={() => update.mutate({ status: 'submitted' })} disabled={update.isPending}>
                {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send data-icon="inline-start" />}
                Mark as sent to supplier
              </Button>
            )}
            {open && (
              <Button onClick={() => setReceiving(true)}>
                <Truck data-icon="inline-start" />
                Receive delivery
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {receiving ? (
        <form
          id="receive-po"
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            receive.mutate();
          }}
        >
          <p className="text-sm text-muted-foreground">
            What arrived. Each line starts at what’s still to come — change it if the delivery was short.
            {complete > 0 && ` ${complete} ${complete === 1 ? 'line has' : 'lines have'} already arrived in full.`}
          </p>
          <ul className="space-y-2">
            {(po.lines ?? [])
              .filter((l) => outstanding(l) > 0)
              .map((l) => (
                <li key={l.id} className="rounded-lg border border-rule/60 bg-card p-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{l.stockItem?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtQty(l.quantityReceived)} of {fmtQty(l.quantityOrdered)} {l.stockItem?.unit} so far
                    </p>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="block">
                      <span className="mb-1 block text-label uppercase text-muted-foreground">Received</span>
                      <input
                        value={receiveQty[l.id] ?? String(outstanding(l))}
                        onChange={(event) => setReceiveQty((prev) => ({ ...prev, [l.id]: event.target.value }))}
                        inputMode="decimal"
                        aria-label={`Received ${l.stockItem?.name}`}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-ring"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-label uppercase text-muted-foreground">Containers</span>
                      <input
                        value={receiveContainers[l.id] ?? ''}
                        onChange={(event) => setReceiveContainers((prev) => ({ ...prev, [l.id]: event.target.value }))}
                        inputMode="numeric"
                        placeholder={l.stockItem?.defaultContainerQuantity ? 'Auto' : '1'}
                        aria-label={`Containers of ${l.stockItem?.name}`}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-right text-sm outline-none focus:border-ring"
                      />
                    </label>
                    <DatePicker
                      label={l.stockItem?.isPerishable ? 'Expiry *' : 'Expiry'}
                      value={receiveExpiry[l.id] ?? defaultExpiry(l.stockItem?.defaultShelfLifeDays)}
                      onValueChange={(expiry) => setReceiveExpiry((prev) => ({ ...prev, [l.id]: expiry }))}
                      aria-label={`Expiry of ${l.stockItem?.name}`}
                      required={l.stockItem?.isPerishable}
                    />
                    <label className="block">
                      <span className="mb-1 block text-label uppercase text-muted-foreground">Lot</span>
                      <input
                        value={receiveLot[l.id] ?? ''}
                        onChange={(event) => setReceiveLot((prev) => ({ ...prev, [l.id]: event.target.value }))}
                        placeholder="Optional"
                        aria-label={`Lot of ${l.stockItem?.name}`}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring"
                      />
                    </label>
                  </div>
                </li>
              ))}
          </ul>
        </form>
      ) : (
        <div className="space-y-6">
          {/* Headline: what it comes to, where it's up to. */}
          <div className="overflow-hidden rounded-lg border border-rule/60 bg-field">
            <div className="flex items-start gap-3.5 px-4 pt-4 pb-3.5">
              <span
                className={cn(
                  'flex size-12 shrink-0 items-center justify-center rounded-lg',
                  late ? 'bg-exception/8 text-exception' : meta.tint,
                )}
              >
                <meta.icon size={22} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-semibold tracking-headline text-foreground">{money(total)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(po.lines ?? []).length} {(po.lines ?? []).length === 1 ? 'line' : 'lines'}
                  {due && <span className={cn(late && 'font-medium text-exception')}> · {due}</span>}
                  {!due && po.expectedAt && ` · expected ${formatDate(po.expectedAt)}`}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold',
                  late ? 'bg-exception/8 text-exception' : meta.tint,
                )}
              >
                {late ? 'Overdue' : meta.label}
              </span>
            </div>
            {po.status === 'cancelled' ? (
              <p className="border-t border-rule/45 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                Cancelled — nothing more will arrive.
              </p>
            ) : (
              <ol className="grid grid-cols-3 gap-1.5 border-t border-rule/45 px-4 pt-3 pb-3.5">
                {['Draft', 'Sent to supplier', 'Received'].map((label, index) => (
                  <li key={label}>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-band">
                      <span
                        className={cn(
                          'block h-full rounded-full',
                          index <= reached ? (index === reached ? 'bg-primary' : 'bg-momentum/50') : '',
                        )}
                        style={{
                          width: index === 2 && po.status === 'partially_received' ? `${share * 100}%` : index <= reached ? '100%' : '0%',
                        }}
                      />
                    </span>
                    <span
                      className={cn('mt-1.5 block text-xs', index === reached ? 'font-semibold text-foreground' : 'text-muted-foreground')}
                    >
                      {index === 2 && po.status === 'partially_received' ? `${Math.round(share * 100)}% received` : label}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Lines</h3>
            <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
              {(po.lines ?? []).map((l) => {
                const ordered = Number(l.quantityOrdered) || 0;
                const got = Math.min(ordered, Number(l.quantityReceived) || 0);
                const complete = ordered > 0 && got >= ordered;
                return (
                  <li key={l.id} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-md',
                        complete ? 'bg-momentum/8 text-momentum' : 'bg-band text-muted-foreground',
                      )}
                    >
                      {complete ? <Check size={16} aria-hidden="true" /> : <Package size={16} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{l.stockItem?.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {fmtQty(l.quantityOrdered)} {l.stockItem?.unit} × {unitMoney(l.unitCost)}
                        {po.status !== 'draft' && ` · ${fmtQty(l.quantityReceived)} received`}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-foreground">{money(ordered * (Number(l.unitCost) || 0))}</span>
                  </li>
                );
              })}
              <li className="flex items-baseline justify-between bg-band/25 px-3.5 py-3">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <span className="text-base font-semibold text-foreground">{money(total)}</span>
              </li>
            </ul>
            {po.notes && <p className="mt-2 px-1 text-xs italic text-muted-foreground">“{po.notes}”</p>}
          </section>

          {po.status !== 'draft' && po.status !== 'cancelled' && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Invoice</h3>
              <div className="space-y-3 rounded-lg border border-rule/60 bg-card p-3.5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-label uppercase text-muted-foreground">Invoice number</span>
                    <input
                      value={invoiceNumValue}
                      onChange={(event) => setInvoiceNumber(event.target.value)}
                      disabled={!canWrite}
                      className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring disabled:opacity-60"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-label uppercase text-muted-foreground">Amount</span>
                    <input
                      value={invoiceValue}
                      onChange={(event) => setInvoiceAmount(event.target.value)}
                      inputMode="decimal"
                      disabled={!canWrite}
                      className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-right text-sm outline-none focus:border-ring disabled:opacity-60"
                    />
                  </label>
                </div>
                {difference !== null && (
                  <p
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-medium',
                      Math.abs(difference) <= 0.01 ? 'text-momentum' : 'text-measured',
                    )}
                  >
                    {Math.abs(difference) <= 0.01 ? (
                      <CheckCircle2 size={13} aria-hidden="true" />
                    ) : (
                      <AlertTriangle size={13} aria-hidden="true" />
                    )}
                    {Math.abs(difference) <= 0.01
                      ? 'Matches the order total.'
                      : `${money(Math.abs(difference))} ${difference > 0 ? 'more' : 'less'} than the order total of ${money(total)}.`}
                  </p>
                )}
                {canWrite && (
                  <div className="flex items-center gap-3 border-t border-rule/45 pt-3">
                    <Switch
                      label="Invoice matched"
                      checked={po.invoiceMatched}
                      onChange={(checked) => update.mutate({ invoiceMatched: checked })}
                    />
                    <span className="flex-1 text-sm text-foreground">Checked against the delivery</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate({
                          invoiceNumber: invoiceNumValue || null,
                          invoiceAmount: invoiceValue === '' ? null : Number(invoiceValue),
                        })
                      }
                    >
                      Save invoice
                    </Button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {cancelOpen && (
        <ConfirmDrawer
          title="Cancel this purchase order?"
          message={
            <>
              Cancel <span className="font-semibold text-foreground">{po.reference}</span>? It can’t be undone.
            </>
          }
          isPending={update.isPending}
          onConfirm={() => update.mutate({ status: 'cancelled' })}
          onClose={() => setCancelOpen(false)}
        />
      )}
    </Drawer>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

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
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'purchasing:write');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [ownStatus, setOwnStatus] = useState<'all' | PurchaseOrderStatus>('all');
  const statusFilter = status ?? ownStatus;
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [now] = useState(() => new Date());
  const supplierId = supplierFilter === 'all' ? undefined : supplierFilter;

  const list = useInfiniteQuery({
    queryKey: moduleQueryKeys.purchasing.key('purchase-orders', locationId, statusFilter, supplierFilter),
    queryFn: ({ pageParam }) =>
      getPurchaseOrders({ locationId, status: statusFilter === 'all' ? undefined : statusFilter, supplierId, page: pageParam, limit: 25 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });

  const FILTERS: ('all' | PurchaseOrderStatus)[] = ['all', ...STATUSES];
  const countQueries = useQueries({
    queries: FILTERS.map((countStatus) => ({
      queryKey: moduleQueryKeys.purchasing.key('purchase-orders', 'count', locationId, countStatus, supplierFilter),
      queryFn: () => getPurchaseOrders({ locationId, status: countStatus === 'all' ? undefined : countStatus, supplierId, limit: 1 }),
    })),
  });
  const counts = Object.fromEntries(FILTERS.map((s, i) => [s, countQueries[i].data?.total ?? 0])) as Record<
    'all' | PurchaseOrderStatus,
    number
  >;

  const orders = useMemo(() => {
    const seen = new Set<string>();
    return (list.data?.pages ?? []).flatMap((page) => page.data).filter((po) => (seen.has(po.id) ? false : (seen.add(po.id), true)));
  }, [list.data?.pages]);
  const total = list.data?.pages[0]?.total ?? 0;
  const overdue = orders.filter((po) => isOverdue(po, now)).length;
  const groups = useMemo(() => {
    const map = new Map<string, PurchaseOrder[]>();
    for (const po of orders) {
      const label = dayLabel(po.createdAt, now);
      map.set(label, [...(map.get(label) ?? []), po]);
    }
    return [...map.entries()];
  }, [orders, now]);

  const changeStatus = (next: 'all' | PurchaseOrderStatus) => (onStatusChange ? onStatusChange(next) : setOwnStatus(next));
  const statusLabel = (value: 'all' | PurchaseOrderStatus) => (value === 'all' ? 'All orders' : STATUS[value].label);

  return (
    <motion.div className="space-y-4" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      {/* A summary of where orders stand — the selector below does the filtering. */}
      <motion.dl variants={SECTION_RISE} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Fact surface="page" icon={Truck} label="All orders" value={counts.all} />
        <Fact surface="page" icon={FileText} label="Drafts" value={counts.draft} hint={counts.draft > 0 ? 'Not sent yet' : undefined} />
        <Fact
          surface="page"
          icon={Send}
          label="Awaiting delivery"
          value={counts.submitted}
          tone={overdue > 0 ? 'danger' : 'default'}
          hint={overdue > 0 ? `${overdue} overdue` : undefined}
        />
        <Fact surface="page" icon={Truck} label="Part delivered" value={counts.partially_received} />
        <Fact surface="page" icon={PackageCheck} label="Received" value={counts.received} />
      </motion.dl>

      <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(value) => changeStatus(value as 'all' | PurchaseOrderStatus)}
          options={FILTERS.map((value) => ({ value, label: `${statusLabel(value)} · ${counts[value]}` }))}
          ariaLabel="Status"
          className="w-56"
        />
        <Select
          value={supplierFilter}
          onValueChange={setSupplierFilter}
          options={[
            { value: 'all', label: 'All suppliers' },
            ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
          ]}
          ariaLabel="Supplier"
          className="w-52"
        />
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {list.isFetching && !list.isPending && <Loader2 size={12} className="animate-spin" aria-label="Updating" />}
          {total} {total === 1 ? 'order' : 'orders'}
        </span>
      </motion.div>

      <motion.section variants={SECTION_RISE} aria-label="Purchase orders">
        {list.isError ? (
          <ErrorState
            title="Purchase orders couldn’t be loaded"
            description="Nothing was read, so this isn’t an empty list."
            onRetry={() => void list.refetch()}
          />
        ) : list.isPending ? (
          <div className="h-64 animate-pulse rounded-lg bg-band/60" aria-label="Loading purchase orders" />
        ) : orders.length === 0 ? (
          <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            <EmptyState
              icon={Truck}
              title={statusFilter === 'all' && supplierFilter === 'all' ? 'No purchase orders yet' : 'Nothing matches'}
              description={
                statusFilter === 'all' && supplierFilter === 'all'
                  ? 'Create one with the button above, or from the suggested order on the Stock tab.'
                  : 'Try another status or supplier.'
              }
            />
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([label, dayOrders]) => (
              <div key={label}>
                <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">{label}</h2>
                <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                  {dayOrders.map((po) => (
                    <OrderRow
                      key={po.id}
                      po={po}
                      now={now}
                      selected={po.id === detailId}
                      canWrite={canWrite}
                      onOpen={() => setDetailId(po.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
            <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoadMore={() => void list.fetchNextPage()} />
          </div>
        )}
      </motion.section>

      {createOpen && (
        <CreatePoDrawer
          key={draft?.restockRequestIds?.join(',') ?? draft?.notes ?? 'blank'}
          suppliers={suppliers}
          locationId={draft?.locationId ?? locationId}
          draft={draft}
          onClose={() => onCreateOpenChange(false)}
          onManageSuppliers={onManageSuppliers}
        />
      )}
      {detailId && <PoDrawer key={detailId} id={detailId} canWrite={canWrite} onClose={() => setDetailId(null)} />}
    </motion.div>
  );
}

/** One order as an audit-log row. The next step sits on the row and opens the order to take it. */
function OrderRow({
  po,
  now,
  selected,
  canWrite,
  onOpen,
}: {
  po: PurchaseOrder;
  now: Date;
  selected: boolean;
  canWrite: boolean;
  onOpen: () => void;
}) {
  const meta = STATUS[po.status];
  const late = isOverdue(po, now);
  const due = dueLabel(po, now);
  const step = !canWrite
    ? null
    : po.status === 'draft'
      ? 'Send'
      : po.status === 'submitted' || po.status === 'partially_received'
        ? 'Receive'
        : null;
  const invoice = po.invoiceMatched ? 'Invoice matched' : po.invoiceNumber ? `Invoice ${po.invoiceNumber} not matched` : null;

  return (
    <li className="border-b border-rule/45 last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          selected ? 'bg-band' : 'hover:bg-band/40',
        )}
      >
        <span
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', late ? 'bg-exception/8 text-exception' : meta.tint)}
        >
          <meta.icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">
            <span className="font-semibold">{po.reference}</span> · {po.supplier?.name ?? 'Supplier'}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {due ? (
              <span className={cn(late && 'font-medium text-exception')}>{due}</span>
            ) : po.expectedAt ? (
              `Expected ${formatDate(po.expectedAt)}`
            ) : (
              'No delivery date'
            )}
            {invoice && <span className={cn(!po.invoiceMatched && 'text-measured')}> · {invoice}</span>}
          </span>
        </span>
        <span
          className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold', late ? 'bg-exception/8 text-exception' : meta.tint)}
        >
          {late ? 'Overdue' : meta.label}
        </span>
        {step ? (
          <span className="hidden h-8 shrink-0 items-center gap-1 rounded-md border border-rule/60 bg-background px-2.5 text-xs font-semibold text-foreground sm:inline-flex">
            {step === 'Send' ? <Send size={12} aria-hidden="true" /> : <Truck size={12} aria-hidden="true" />}
            {step}
          </span>
        ) : (
          <ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>
    </li>
  );
}
