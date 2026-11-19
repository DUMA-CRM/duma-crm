'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Loader2 } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { type OrderDetail, type OrderStatus, deleteOrder } from '@/lib/modules/ordering/client';
import { getTradingSettings } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { orderCode } from '@/lib/utils/orders-list';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { invalidateOrder } from './StatusMenu';

/**
 * Whether to offer deleting an order: it is cancelled, the viewer can refund, and the workspace allows it
 * (Orders → Edit orders; stored with the trading settings, same key). The API checks all three again — this only decides whether to show it.
 */
export function useMayDeleteOrder(status: OrderStatus | undefined): boolean {
  const capabilities = useAuthStore((state) => state.capabilities);
  const canRefund = hasCapability(capabilities, 'orders:refund');
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const trading = useQuery({
    queryKey: moduleQueryKeys.organization.key('trading', tenantId),
    queryFn: () => getTradingSettings(tenantId!),
    enabled: Boolean(tenantId) && canRefund,
  });
  return canRefund && status === 'cancelled' && trading.data?.allowOrderDeletion === true;
}

/**
 * Deleting several cancelled orders from select mode. There is no bulk endpoint, so each goes through
 * `DELETE /orders/:id` in turn; one that fails is reported and left, the rest still go.
 */
export function DeleteOrdersModal({ ids, onClose, onDeleted }: { ids: string[]; onClose: () => void; onDeleted: () => void }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const failed: string[] = [];
      for (const id of ids) {
        try {
          await deleteOrder(id);
          qc.removeQueries({ queryKey: moduleQueryKeys.ordering.key('order', id) });
        } catch {
          failed.push(id);
        }
      }
      return failed;
    },
    onSuccess: (failed) => {
      const deleted = ids.length - failed.length;
      if (deleted > 0) toast('success', `${deleted} ${deleted === 1 ? 'order' : 'orders'} deleted.`);
      if (failed.length > 0) toast('error', `${failed.length} couldn’t be deleted: ${failed.map(orderCode).join(', ')}.`);
      onClose();
      onDeleted();
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('orders') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.ordering.key('orders-all') });
    },
  });
  const count = ids.length;
  return (
    <Modal
      title={`Delete ${count} cancelled ${count === 1 ? 'order' : 'orders'}?`}
      description="This can’t be undone — only the audit log keeps a copy."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={remove.isPending}>
            Keep them
          </Button>
          <Button variant="destructive" size="lg" className="flex-1" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Delete for good
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">
        They disappear from orders and reports, together with any payment and refund records.
      </p>
    </Modal>
  );
}

/** Deleting a cancelled order for good — its payments, refunds and receipts go with it; the audit log keeps a copy. */
export function DeleteOrderModal({
  order,
  onClose,
  onDeleted,
}: {
  /** Payments and refunds when the full order is loaded; a list row doesn't carry them. */
  order: Pick<OrderDetail, 'id'> & Partial<Pick<OrderDetail, 'payments' | 'refunds'>>;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteOrder(order.id),
    onSuccess: () => {
      onClose();
      onDeleted?.();
      qc.removeQueries({ queryKey: moduleQueryKeys.ordering.key('order', order.id) });
      invalidateOrder(qc, order.id);
      toast('success', `Order ${orderCode(order.id)} deleted.`);
    },
    onError: (error) => toast('error', error.message || 'The order wasn’t deleted.'),
  });
  const known = order.payments !== undefined || order.refunds !== undefined;
  const moneyMoved = (order.payments?.length ?? 0) > 0 || (order.refunds?.length ?? 0) > 0;
  return (
    <Modal
      title={`Delete order ${orderCode(order.id)}?`}
      description="This can’t be undone — only the audit log keeps a copy."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={remove.isPending}>
            Keep order
          </Button>
          <Button variant="destructive" size="lg" className="flex-1" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Delete for good
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">
        {!known
          ? 'It disappears from orders and reports, together with any payment and refund records.'
          : moneyMoved
            ? 'It disappears from orders and reports, together with its payment and refund records.'
            : 'It disappears from orders and reports.'}
      </p>
    </Modal>
  );
}
