'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Popover } from 'radix-ui';
import { useState } from 'react';

import { ChevronDown, Loader2, XCircle } from '@/components/icons';
import { MascotGlyph } from '@/components/shared/EmptyState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { type Order, type OrderStatus, type VoidReason, updateOrderStatus } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { paymentClears } from '@/lib/utils/order-workflow';
import { orderCode } from '@/lib/utils/orders-list';
import { toast } from '@/stores/toastStore';

import { NEXT_STATUSES, STATUS_META, VOID_REASON_OPTIONS } from './orderMeta';

/** Everything an order-status change touches: the lists, the order, the kitchen, and the stock it drew. */
export function invalidateOrder(qc: ReturnType<typeof useQueryClient>, orderId: string) {
  void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('orders') });
  void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('orders-all') });
  void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('order', orderId) });
  void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('kds-orders') });
  void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('inventory-overview') });
  void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('location-stock') });
}

/** The status, as the audit log's pill. */
export function StatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs font-semibold', meta.tint, className)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** The mutation behind every status change, including the void that needs a reason. */
export function useStatusChange(order: Pick<Order, 'id'>, onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ status, details }: { status: OrderStatus; details?: { voidReason: VoidReason; voidNotes?: string } }) =>
      updateOrderStatus(order.id, status, details),
    onSuccess: (updated) => {
      invalidateOrder(qc, order.id);
      if (updated.inventoryWarnings?.length) {
        const n = updated.inventoryWarnings.length;
        toast('error', `Order completed with ${n} stock shortfall${n === 1 ? '' : 's'}.`);
      }
      onDone?.();
    },
    onError: (err) => toast('error', err.message || 'The order status wasn’t updated. Try again.'),
  });
}

/**
 * The status pill, and — where the order can still move — a menu of the next
 * steps. Cancelling opens the void dialog, because a void needs a reason for
 * the audit trail. An unpaid order can only be cancelled.
 */
export function StatusMenu({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const change = useStatusChange(order, () => setOpen(false));
  // A finished order doesn't move — a refunded "done" order used to offer
  // "cancel" because its payment no longer read as paid. Otherwise an unpaid
  // order can only be cancelled.
  const nexts =
    NEXT_STATUSES[order.status].length === 0
      ? []
      : !paymentClears(order)
        ? (['cancelled'] as OrderStatus[])
        : NEXT_STATUSES[order.status];

  if (nexts.length === 0) return <StatusPill status={order.status} />;

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            disabled={change.isPending}
            aria-label={`Status: ${STATUS_META[order.status].label}. Change status`}
            className={cn(
              'inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-60',
              STATUS_META[order.status].tint,
            )}
          >
            {change.isPending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <span className={cn('size-1.5 rounded-full', STATUS_META[order.status].dot)} aria-hidden="true" />
            )}
            {STATUS_META[order.status].label}
            <ChevronDown size={11} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            onClick={(event) => event.stopPropagation()}
            className="z-[90] min-w-44 overflow-hidden rounded-lg border border-rule/60 bg-card p-1 shadow-lg"
          >
            <p className="px-2.5 pt-1.5 pb-1 text-label uppercase text-muted-foreground">Move to</p>
            {nexts.map((next) => {
              const meta = STATUS_META[next];
              const Icon = meta.icon;
              return (
                <button
                  key={next}
                  type="button"
                  onClick={() => {
                    if (next === 'cancelled') {
                      setOpen(false);
                      setVoiding(true);
                    } else change.mutate({ status: next });
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-band"
                >
                  <span className={cn('flex size-6 items-center justify-center rounded-md', meta.tint)}>
                    <Icon size={13} aria-hidden="true" />
                  </span>
                  {next === 'cancelled' ? 'Cancel order…' : meta.label}
                </button>
              );
            })}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {voiding && <VoidModal order={order} onClose={() => setVoiding(false)} />}
    </>
  );
}

export function VoidModal({ order, onClose }: { order: Pick<Order, 'id'>; onClose: () => void }) {
  const [reason, setReason] = useState<VoidReason>('customer_request');
  const [notes, setNotes] = useState('');
  const change = useStatusChange(order, onClose);
  const words = useCatalogWords();
  return (
    <Modal
      title={`Cancel order ${orderCode(order.id)}?`}
      description={`It leaves ${words.queue}, and the reason is kept in the audit trail.`}
      illustration={<MascotGlyph icon={XCircle} size={88} expression="triste" tint="text-exception" />}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={change.isPending}>
            Keep order
          </Button>
          <Button
            variant="destructive"
            size="lg"
            className="flex-1"
            disabled={change.isPending}
            onClick={() => change.mutate({ status: 'cancelled', details: { voidReason: reason, voidNotes: notes.trim() || undefined } })}
          >
            {change.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Cancel order
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-label uppercase text-muted-foreground">Reason</p>
          <ChoiceCards value={reason} onChange={setReason} options={VOID_REASON_OPTIONS as { value: VoidReason; label: string }[]} />
        </div>
        <label className="block">
          <span className="mb-1.5 block text-label uppercase text-muted-foreground">Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            placeholder="Anything the audit trail should know"
            className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </label>
      </div>
    </Modal>
  );
}
