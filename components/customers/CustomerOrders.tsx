'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { useState } from 'react';

import { type Order, getOrders } from '@/lib/api/orders.service';
import { STATUS_CONFIG } from '@/lib/constants/customers';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

function OrderRow({ order }: { order: Order }) {
  const status = STATUS_CONFIG[order.status];

  return (
    <div className="flex items-center gap-4 py-2.5 border-b border-border/50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <ShoppingBag size={13} className="text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-muted-foreground truncate">#{order.id.slice(0, 8)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Badge variant={status.variant}>{status.label}</Badge>
        {order.totalAmount != null && (
          <span className="text-xs font-semibold text-foreground tabular-nums">£{(order.totalAmount / 1).toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}

export function CustomerOrders({ customerId }: { customerId: string }) {
  const { locationId } = useWorkspaceStore();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-orders', customerId, locationId, page],
    queryFn: () =>
      getOrders({
        customerId,
        locationId: locationId ?? undefined,
        page,
        limit: 10,
      }),
  });

  const orders = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>ORDERS</Label>
        {data && <span className="text-xs text-muted-foreground">{data.total} total</span>}
      </div>

      <div className="bg-background rounded-2xl border border-border px-3 py-1">
        {isLoading ? (
          <div className="flex flex-col gap-3 py-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/3" />
                </div>
                <div className="h-5 w-14 bg-muted rounded-md animate-pulse" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">No orders found.</p>
        ) : (
          orders.map((o) => <OrderRow key={o.id} order={o} />)
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2">
          <Button variant="ghost" size="xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={13} aria-hidden="true" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="ghost" size="xs" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
            <ChevronRight size={13} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
