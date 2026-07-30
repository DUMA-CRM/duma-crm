'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';

import { type Order, getOrders } from '@/lib/api/orders.service';
import { STATUS_CONFIG } from '@/lib/constants/customers';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** What was in the order: "2 × Flat White, 1 × Croissant +2 more". */
function itemSummary(order: Order): string | null {
  if (!order.items?.length) return null;
  const parts = order.items.map((item) => `${item.quantity} × ${item.name}`);
  return parts.length > 2 ? `${parts.slice(0, 2).join(', ')} +${parts.length - 2} more` : parts.join(', ');
}

export function CustomerOrders({ customerId }: { customerId: string }) {
  const router = useRouter();
  const { locationId } = useWorkspaceStore();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-orders', customerId, locationId, page],
    queryFn: () =>
      getOrders({
        customerId,
        locationId: locationId ?? undefined,
        page,
        limit: 20,
      }),
  });

  const orders = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const columns: DataTableColumn<Order>[] = [
    {
      id: 'order',
      header: 'Order',
      minWidth: 220,
      cell: ({ row: order }) => {
        const summary = itemSummary(order);
        return (
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <ShoppingBag size={14} className="text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-foreground">#{order.id.slice(0, 8)}</p>
              <p className="truncate text-xs text-muted-foreground">{summary ?? order.source.replaceAll('_', ' ')}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'placed',
      header: 'Placed',
      width: 'fit',
      wrap: 'nowrap',
      cellClassName: 'tabular-nums',
      cell: ({ row: order }) => (
        <>
          <p className="text-sm text-foreground">{date(order.createdAt)}</p>
          <p className="text-xs text-muted-foreground">{time(order.createdAt)}</p>
        </>
      ),
    },
    {
      id: 'source',
      header: 'Source',
      width: 'fit',
      visibility: 'md',
      cellClassName: 'text-xs text-muted-foreground capitalize',
      cell: ({ row: order }) => order.source.replaceAll('_', ' '),
    },
    {
      id: 'status',
      header: 'Status',
      width: 'fit',
      cell: ({ row: order }) => <Badge variant={STATUS_CONFIG[order.status].variant}>{STATUS_CONFIG[order.status].label}</Badge>,
    },
    {
      id: 'total',
      header: 'Total',
      width: 'fit',
      align: 'right',
      cellClassName: 'tabular-nums font-semibold',
      cell: ({ row: order }) => (order.totalAmount != null ? `£${Number(order.totalAmount).toFixed(2)}` : '—'),
    },
    {
      id: 'open',
      width: 'fit',
      align: 'right',
      cell: () => <ChevronRight size={15} className="text-muted-foreground" aria-hidden="true" />,
    },
  ];

  return (
    <DataTable
      aria-label="Customer orders"
      data={orders}
      columns={columns}
      getRowKey={(order) => order.id}
      isLoading={isLoading}
      minWidth={640}
      emptyState={<EmptyState icon={ShoppingBag} title="No orders yet" description="Orders placed by this customer will appear here." />}
      onRowClick={({ row }) => router.push(`/orders?order=${row.id}`)}
      rowAriaLabel={({ row }) => `Open order ${row.id.slice(0, 8)}`}
      footer={
        orders.length > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {data?.total ?? orders.length} order{(data?.total ?? orders.length) === 1 ? '' : 's'}
              {totalPages > 1 && ` · page ${page} of ${totalPages}`}
            </p>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                  Next
                </Button>
              </div>
            )}
          </div>
        ) : null
      }
      footerClassName="p-0"
    />
  );
}
