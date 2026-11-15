'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';

import { Copy, ExternalLink, ListChecks, User } from '@/components/icons';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import type { Order, OrderStatus } from '@/lib/modules/ordering/client';
import { toast } from '@/lib/toast';
import { orderCode } from '@/lib/utils/orders-list';

import { VoidModal, nextStatuses, useStatusChange } from './StatusMenu';
import { STATUS_META } from './orderMeta';

const STEP_LABEL: Partial<Record<OrderStatus, string>> = { preparing: 'Start preparing', ready: 'Mark ready', done: 'Complete' };

/**
 * Right-click (or long-press) on an order row: the same next steps as the
 * status pill, plus open, the customer, copy the code and start selecting.
 * Every item is also reachable without the menu — it is a shortcut, not a route.
 */
export function OrderRowMenu({
  order,
  onOpen,
  onSelect,
  children,
}: {
  order: Order;
  onOpen: () => void;
  /** Starts select mode with this order picked; absent without `orders:bulk` or while selecting. */
  onSelect?: () => void;
  children: ReactNode;
}) {
  const router = useRouter();
  const [voiding, setVoiding] = useState(false);
  const change = useStatusChange(order);
  const nexts = nextStatuses(order);
  const code = orderCode(order.id);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>{code}</ContextMenuLabel>
          <ContextMenuItem icon={ExternalLink} onSelect={onOpen}>
            Open order
          </ContextMenuItem>
          {nexts.length > 0 && <ContextMenuSeparator />}
          {nexts.map((next) =>
            next === 'cancelled' ? (
              <ContextMenuItem
                key={next}
                icon={STATUS_META[next].icon}
                danger
                disabled={change.isPending}
                onSelect={() => setVoiding(true)}
              >
                Cancel order…
              </ContextMenuItem>
            ) : (
              <ContextMenuItem
                key={next}
                icon={STATUS_META[next].icon}
                disabled={change.isPending}
                onSelect={() => change.mutate({ status: next })}
              >
                {STEP_LABEL[next] ?? STATUS_META[next].label}
              </ContextMenuItem>
            ),
          )}
          <ContextMenuSeparator />
          {order.customerId && (
            <ContextMenuItem icon={User} onSelect={() => router.push(`/customers/${order.customerId}`)}>
              Open customer
            </ContextMenuItem>
          )}
          <ContextMenuItem
            icon={Copy}
            onSelect={() =>
              void navigator.clipboard.writeText(code).then(
                () => toast('success', `${code} copied.`),
                () => toast('error', 'Couldn’t copy the code.'),
              )
            }
          >
            Copy order code
          </ContextMenuItem>
          {onSelect && (
            <ContextMenuItem icon={ListChecks} onSelect={onSelect}>
              Select
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {voiding && <VoidModal order={order} onClose={() => setVoiding(false)} />}
    </>
  );
}
