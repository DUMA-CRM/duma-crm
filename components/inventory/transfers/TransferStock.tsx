'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock,
  FileText,
  type IconComponent,
  Loader2,
  MapPin,
  Package,
  Plus,
  Trash2,
  X,
} from '@/components/icons';
import { fmtQty } from '@/components/inventory/stock/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { FormSection } from '@/components/shared/FormParts';
import { LoadMore } from '@/components/shared/LoadMore';
import { Bone, RowSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type StockTransfer,
  type StockTransferStatus,
  cancelStockTransfer,
  completeStockTransfer,
  createStockTransfer,
  getLocationStock,
  getStockTransfers,
} from '@/lib/modules/inventory/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { groupByDay } from '@/lib/utils/ledger';
import { direction, itemLine, otherSide, quantityError, signedChange } from '@/lib/utils/transfers';
import { formatInstant } from '@/lib/utils/workspace-time';
import { toast } from '@/stores/toastStore';

const STATUS: Record<StockTransferStatus, { label: string; pill: string }> = {
  pending: { label: 'Waiting', pill: 'bg-measured/10 text-measured' },
  completed: { label: 'Moved', pill: 'bg-momentum/8 text-momentum' },
  cancelled: { label: 'Cancelled', pill: 'bg-band text-muted-foreground' },
};

const dateTime = (iso: string) =>
  formatInstant(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const time = (iso: string) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });
const signed = (n: number) => (n > 0 ? `+${fmtQty(n)}` : n < 0 ? `−${fmtQty(-n)}` : '0');

function useInvalidateTransfers() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-transfers') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('location-stock') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('inventory-overview') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('inventory-forecast') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-movements') });
  };
}

// ── New transfer drawer ──────────────────────────────────────────────────────

type Line = { stockItemId: string; quantity: string };
const TRANSFER_FORM = 'create-stock-transfer-form';

/** A transfer out of this location: where to, what and how much. Stock moves only when it's completed. */
export function TransferStockDrawer({
  tenantId,
  locationId,
  initialStockItemId,
  onClose,
}: {
  tenantId: string;
  locationId: string;
  initialStockItemId?: string;
  onClose: () => void;
}) {
  const invalidate = useInvalidateTransfers();
  const { data: locations = [] } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId),
  });
  const { data: stock = [] } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('location-stock', locationId),
    queryFn: () => getLocationStock(locationId),
  });

  const [toLocationId, setToLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ stockItemId: initialStockItemId ?? '', quantity: '' }]);
  const [submitted, setSubmitted] = useState(false);

  const stockable = stock.filter((s) => Number(s.quantity) > 0 && s.stockItem);
  const rowFor = (stockItemId: string) => stockable.find((s) => s.stockItemId === stockItemId);
  const chosen = new Set(lines.map((l) => l.stockItemId).filter(Boolean));
  const from = locations.find((l) => l.id === locationId);
  const destinations = locations.filter((l) => l.id !== locationId);
  const errors = lines.map((line) =>
    line.stockItemId ? quantityError(line.quantity, Number(rowFor(line.stockItemId)?.quantity ?? 0)) : 'Choose an item.',
  );
  const valid = !!toLocationId && errors.every((e) => e === null);
  const setLine = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const create = useMutation({
    mutationFn: () =>
      createStockTransfer({
        fromLocationId: locationId,
        toLocationId,
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({ stockItemId: l.stockItemId, quantity: Number(l.quantity.replace(',', '.')) })),
      }),
    onSuccess: () => {
      invalidate();
      toast('success', 'Transfer created — complete it when the stock physically arrives.');
      onClose();
    },
    onError: (err) => toast('error', err.message || 'The transfer wasn’t created. Check the quantities and try again.'),
  });

  return (
    <Drawer
      title="New transfer"
      description={
        from?.name ? `Send stock from ${from.name}. Nothing moves until it’s marked as arrived.` : 'Send stock to another location.'
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={TRANSFER_FORM} size="lg" className="flex-1" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowLeftRight aria-hidden="true" />}
            Create transfer
          </Button>
        </div>
      }
    >
      <form
        id={TRANSFER_FORM}
        noValidate
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (valid) create.mutate();
        }}
      >
        <FormSection icon={MapPin} title="Route">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <span className="mb-1.5 block text-label uppercase text-muted-foreground">From</span>
              <div className="flex h-9 items-center rounded-md border border-rule/60 bg-band/50 px-3 text-sm text-muted-foreground">
                {from?.name ?? 'This location'}
              </div>
            </div>
            <ArrowRight size={16} className="mx-auto mb-2.5 hidden shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
            <div className="flex-1">
              <span className="mb-1.5 block text-label uppercase text-muted-foreground">To</span>
              <Select
                value={toLocationId}
                onValueChange={setToLocationId}
                options={[{ value: '', label: 'Choose a location' }, ...destinations.map((l) => ({ value: l.id, label: l.name }))]}
                ariaLabel="Destination location"
                className="w-full"
              />
            </div>
          </div>
          {submitted && !toLocationId && <p className="text-xs text-destructive">Choose where it’s going.</p>}
        </FormSection>

        <FormSection icon={Package} title="Items">
          <div className="space-y-3">
            {lines.map((line, index) => {
              const row = rowFor(line.stockItemId);
              const error = submitted ? errors[index] : null;
              return (
                <div key={index} className="rounded-lg border border-rule/60 bg-card p-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Select
                        value={line.stockItemId}
                        onValueChange={(value) => setLine(index, { stockItemId: value })}
                        options={[
                          { value: '', label: 'Choose an item' },
                          ...stockable
                            .filter((item) => item.stockItemId === line.stockItemId || !chosen.has(item.stockItemId))
                            .map((item) => ({ value: item.stockItemId, label: item.stockItem!.name })),
                        ]}
                        ariaLabel={`Item ${index + 1}`}
                        className="w-full"
                      />
                    </div>
                    <div className="w-32 shrink-0">
                      <Input
                        value={line.quantity}
                        onChange={(event) => setLine(index, { quantity: event.target.value })}
                        inputMode="decimal"
                        placeholder="0"
                        aria-label={`Quantity ${index + 1}`}
                        rightIcon={row ? <span className="text-xs">{row.stockItem!.unit}</span> : undefined}
                        className="text-right tabular-nums"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove item"
                      className="shrink-0 text-muted-foreground hover:text-exception"
                      onClick={() =>
                        setLines(lines.length === 1 ? [{ stockItemId: '', quantity: '' }] : lines.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className={error ? 'font-semibold text-destructive' : 'text-muted-foreground'}>
                      {error ?? (row ? `${fmtQty(Number(row.quantity))} ${row.stockItem!.unit} available` : ' ')}
                    </span>
                    {row && !error && (
                      <button
                        type="button"
                        className="font-semibold text-primary hover:underline"
                        onClick={() => setLine(index, { quantity: String(Number(row.quantity)) })}
                      >
                        Send all
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {chosen.size < stockable.length && (
            <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { stockItemId: '', quantity: '' }])}>
              <Plus aria-hidden="true" /> Add item
            </Button>
          )}
        </FormSection>

        <FormSection icon={FileText} title="Note">
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            placeholder="Optional — e.g. running low for the weekend"
            aria-label="Note"
          />
        </FormSection>
      </form>
    </Drawer>
  );
}

// ── Transfers tab ────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

/**
 * Transfers involving this item at this location. The API can't filter by item,
 * so the location's transfers are paged in and filtered here — with a short
 * match the scroll sentinel keeps loading until every page has been looked at.
 */
export function ItemTransfersSection({
  stockItemId,
  locationId,
  unit,
  canWrite,
  onNewTransfer,
}: {
  stockItemId: string;
  locationId: string;
  unit: string;
  canWrite: boolean;
  /** Absent when the item isn't stocked here, so there's nothing to send. */
  onNewTransfer?: () => void;
}) {
  const [status, setStatus] = useState<StockTransferStatus | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const query = useInfiniteQuery({
    queryKey: moduleQueryKeys.inventory.key('stock-transfers', locationId, status),
    queryFn: ({ pageParam }) =>
      getStockTransfers({ locationId, status: status === 'all' ? undefined : status, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
  });

  const transfers = (query.data?.pages.flatMap((page) => page.data) ?? []).filter((t) =>
    t.lines.some((l) => l.stockItemId === stockItemId),
  );
  const pending = transfers.filter((t) => t.status === 'pending');
  const settled = transfers.filter((t) => t.status !== 'pending');
  const days = groupByDay(status === 'pending' ? [] : settled, now);
  const open = transfers.find((t) => t.id === openId) ?? null;
  const exhausted = !query.hasNextPage && !query.isFetchingNextPage;

  return (
    <motion.div className="flex flex-1 flex-col space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      <motion.div variants={SECTION_RISE} className="flex min-h-9 flex-wrap items-center gap-2">
        <h2 className="flex-1 text-base font-semibold tracking-title text-foreground">Transfers</h2>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as StockTransferStatus | 'all')}
          ariaLabel="Status"
          options={[
            { value: 'all', label: 'All transfers' },
            { value: 'pending', label: 'Waiting' },
            { value: 'completed', label: 'Moved' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          className="w-40"
        />
        {canWrite && onNewTransfer && (
          <Button onClick={onNewTransfer}>
            <Plus aria-hidden="true" /> New transfer
          </Button>
        )}
      </motion.div>

      {query.isError ? (
        <ErrorState title="Couldn’t load transfers" onRetry={() => void query.refetch()} />
      ) : query.isPending || (transfers.length === 0 && !exhausted) ? (
        // A day: its label, then the card of transfer rows.
        <div role="status" aria-busy="true" aria-label="Loading transfers">
          <Bone className="mb-2 h-3 w-20" />
          <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {Array.from({ length: 3 }, (_, index) => (
              <RowSkeleton key={index} index={index} />
            ))}
          </div>
        </div>
      ) : transfers.length === 0 ? (
        <motion.div variants={SECTION_RISE} className="flex flex-1 flex-col">
          <EmptyState
            icon={ArrowLeftRight}
            compact
            className="flex-1"
            kind={status === 'all' ? 'start' : status === 'pending' ? 'done' : 'search'}
            title={status === 'all' ? 'No transfers yet' : `Nothing ${STATUS[status].label.toLowerCase()}`}
            description={
              status === 'all'
                ? 'Send stock to another location when one runs short — it leaves here and arrives there once the transfer is marked as arrived.'
                : 'Try another status.'
            }
            action={
              status !== 'all'
                ? { label: 'Show all transfers', onClick: () => setStatus('all') }
                : canWrite && onNewTransfer
                  ? { label: 'New transfer', icon: Plus, onClick: onNewTransfer }
                  : undefined
            }
          />
        </motion.div>
      ) : (
        <>
          {pending.length > 0 && (
            <motion.section variants={SECTION_RISE} aria-label="Waiting to move">
              <h3 className="mb-2 text-label uppercase text-muted-foreground">Waiting to move · {pending.length}</h3>
              <ul className="overflow-hidden rounded-lg border border-measured/30 bg-card">
                {pending.map((t) => (
                  <TransferRow
                    key={t.id}
                    transfer={t}
                    stockItemId={stockItemId}
                    locationId={locationId}
                    unit={unit}
                    when={dateTime(t.createdAt)}
                    onOpen={() => setOpenId(t.id)}
                  />
                ))}
              </ul>
            </motion.section>
          )}
          {days.map((day) => (
            <motion.section key={day.key} variants={SECTION_RISE} aria-label={day.label}>
              <h3 className="mb-2 text-label uppercase text-muted-foreground">{day.label}</h3>
              <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                {day.items.map((t) => (
                  <TransferRow
                    key={t.id}
                    transfer={t}
                    stockItemId={stockItemId}
                    locationId={locationId}
                    unit={unit}
                    when={time(t.createdAt)}
                    onOpen={() => setOpenId(t.id)}
                  />
                ))}
              </ul>
            </motion.section>
          ))}
        </>
      )}
      {!query.isError && (
        <LoadMore hasMore={!!query.hasNextPage} loading={query.isFetchingNextPage} onLoadMore={() => void query.fetchNextPage()} />
      )}

      {open && <TransferDrawer transfer={open} locationId={locationId} canWrite={canWrite} onClose={() => setOpenId(null)} />}
    </motion.div>
  );
}

function TransferRow({
  transfer,
  stockItemId,
  locationId,
  unit,
  when,
  onOpen,
}: {
  transfer: StockTransfer;
  stockItemId: string;
  locationId: string;
  unit: string;
  when: string;
  onOpen: () => void;
}) {
  const out = direction(transfer, locationId) === 'out';
  const change = signedChange(transfer, stockItemId, locationId);
  const { others } = itemLine(transfer, stockItemId);
  const meta = STATUS[transfer.status];
  const Icon: IconComponent = out ? ArrowUpRight : ArrowDownRight;
  const detail = [
    transfer.createdByUser?.name ? `by ${transfer.createdByUser.name}` : null,
    others > 0 ? `+${others} other ${others === 1 ? 'item' : 'items'}` : null,
    transfer.notes,
  ].filter(Boolean);

  return (
    <li className="border-b border-rule/45 last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            out ? 'bg-reference/8 text-reference' : 'bg-primary/8 text-primary',
          )}
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {out ? 'To' : 'From'} {otherSide(transfer, locationId)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {detail.join(' · ') || (out ? 'Sent from here' : 'Sent here')}
          </span>
        </span>
        {change !== null && (
          <span
            className={cn(
              'shrink-0 text-sm font-semibold tabular-nums',
              transfer.status === 'cancelled' ? 'text-muted-foreground line-through' : out ? 'text-foreground' : 'text-primary',
            )}
          >
            {signed(change)} {unit}
          </span>
        )}
        <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold', meta.pill)}>{meta.label}</span>
        <span className="hidden w-28 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground sm:block">
          {when}
        </span>
        <ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </li>
  );
}

/** One transfer: the route, every item on it, and — while waiting — mark it arrived or cancel it. */
function TransferDrawer({
  transfer,
  locationId,
  canWrite,
  onClose,
}: {
  transfer: StockTransfer;
  locationId: string;
  canWrite: boolean;
  onClose: () => void;
}) {
  const invalidate = useInvalidateTransfers();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const out = direction(transfer, locationId) === 'out';
  const meta = STATUS[transfer.status];

  const complete = useMutation({
    mutationFn: () => completeStockTransfer(transfer.id),
    onSuccess: () => {
      invalidate();
      toast('success', `Transfer marked as arrived — stock moved to ${transfer.toLocation?.name ?? 'the other location'}.`);
      onClose();
    },
    onError: (err) => toast('error', err.message || 'The transfer wasn’t completed. Check the sender still has the stock, then try again.'),
  });
  const cancel = useMutation({
    mutationFn: () => cancelStockTransfer(transfer.id),
    onSuccess: () => {
      invalidate();
      toast('info', 'Transfer cancelled — no stock moved.');
      onClose();
    },
    onError: (err) => toast('error', err.message || 'The transfer wasn’t cancelled. Try again.'),
  });
  const pending = complete.isPending || cancel.isPending;
  const actionable = canWrite && transfer.status === 'pending';

  return (
    <Drawer
      title={
        out
          ? `Transfer to ${transfer.toLocation?.name ?? 'another location'}`
          : `Transfer from ${transfer.fromLocation?.name ?? 'another location'}`
      }
      description={`Created ${dateTime(transfer.createdAt)}${transfer.createdByUser?.name ? ` by ${transfer.createdByUser.name}` : ''}.`}
      onClose={onClose}
      footer={
        actionable ? (
          confirmCancel ? (
            <div className="flex gap-2">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirmCancel(false)} disabled={pending}>
                Keep it
              </Button>
              <Button variant="destructive" size="lg" className="flex-1" onClick={() => cancel.mutate()} disabled={pending}>
                {cancel.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                Cancel transfer
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="lg"
                className="text-exception hover:bg-exception/6 hover:text-exception"
                onClick={() => setConfirmCancel(true)}
                disabled={pending}
              >
                Cancel transfer
              </Button>
              <Button size="lg" className="flex-1" onClick={() => complete.mutate()} disabled={pending}>
                {complete.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                Mark as arrived
              </Button>
            </div>
          )
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="rounded-lg border border-rule/60 bg-card p-4">
          <div className="flex items-center gap-3 text-sm">
            <span className={cn('min-w-0 flex-1 truncate font-semibold', out ? 'text-foreground' : 'text-muted-foreground')}>
              {transfer.fromLocation?.name ?? 'From'}
            </span>
            <ArrowRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className={cn('min-w-0 flex-1 truncate text-right font-semibold', out ? 'text-muted-foreground' : 'text-foreground')}>
              {transfer.toLocation?.name ?? 'To'}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-rule/45 pt-3">
            <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', meta.pill)}>{meta.label}</span>
            <span className="text-xs text-muted-foreground">
              {transfer.status === 'pending'
                ? 'Nothing has moved yet. Mark it as arrived once the stock is at the other end.'
                : transfer.status === 'completed'
                  ? `Arrived ${transfer.completedAt ? dateTime(transfer.completedAt) : ''}`.trim()
                  : 'Cancelled — no stock moved.'}
            </span>
          </div>
        </div>

        {confirmCancel && (
          <p className="flex items-start gap-2 rounded-md bg-exception/6 px-3 py-2 text-xs text-exception">
            <Clock size={13} className="mt-px shrink-0" aria-hidden="true" />
            Cancel this transfer? Nothing has moved, so no stock changes at either end.
          </p>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Items <span className="font-normal text-muted-foreground">· {transfer.lines.length}</span>
          </h3>
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {transfer.lines.map((line) => (
              <li key={line.id} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary" aria-hidden="true">
                  <Package size={16} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{line.stockItem?.name ?? 'Item'}</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {fmtQty(Number(line.quantity))} <span className="font-normal text-muted-foreground">{line.stockItem?.unit}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {transfer.notes && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Note</h3>
            <p className="rounded-lg border border-rule/60 bg-card px-3.5 py-3 text-sm leading-relaxed text-foreground">{transfer.notes}</p>
          </section>
        )}
      </div>
    </Drawer>
  );
}
