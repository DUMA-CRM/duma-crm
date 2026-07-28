'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, RefreshCw, Search, Send } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';

import { type EmailDelivery, getEmailDeliveries, retryEmailDelivery } from '@/lib/api/email.service';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { deliveryBadge } from './shared';

const STATUS_FILTERS = [
  { value: 'all' as const, label: 'All' },
  { value: 'sent' as const, label: 'Sent' },
  { value: 'queued' as const, label: 'Waiting' },
  { value: 'failed' as const, label: 'Failed' },
];

/** Plain-language meaning of each delivery status. */
const STATUS_HELP: Record<EmailDelivery['status'], string> = {
  queued: 'Waiting to be sent',
  sending: 'Being sent right now',
  sent: 'Handed to the mail server',
  failed: 'Could not be sent',
  cancelled: 'Stopped before sending',
};

export function HistoryPanel({ onPreview }: { onPreview: (delivery: EmailDelivery) => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'sent' | 'queued' | 'failed'>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['email-deliveries', tenantId, page],
    queryFn: () => getEmailDeliveries(tenantId ?? undefined, page),
    enabled: !!tenantId,
    refetchInterval: 15_000,
  });
  const retry = useMutation({
    mutationFn: (id: string) => retryEmailDelivery(id, tenantId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-deliveries'] });
      toast('success', 'Queued for another attempt.');
    },
    onError: (error) => toast('error', error.message),
  });

  const deliveries = useMemo(() => data?.data ?? [], [data?.data]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return deliveries
      .filter((delivery) => {
        if (status === 'all') return true;
        if (status === 'queued') return delivery.status === 'queued' || delivery.status === 'sending';
        return delivery.status === status;
      })
      .filter((delivery) =>
        query ? `${delivery.toEmail} ${delivery.toName ?? ''} ${delivery.subject}`.toLowerCase().includes(query) : true,
      );
  }, [deliveries, status, search]);
  const columns: DataTableColumn<EmailDelivery>[] = [
    {
      id: 'recipient',
      header: 'Recipient',
      minWidth: 180,
      cell: ({ row: delivery }) => (
        <>
          <p className="text-sm font-medium">{delivery.toName || delivery.toEmail}</p>
          {delivery.toName && <p className="text-xs text-muted-foreground">{delivery.toEmail}</p>}
        </>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      minWidth: 240,
      maxWidth: 420,
      cell: ({ row: delivery }) => (
        <>
          <p className="truncate text-sm">{delivery.subject}</p>
          <p className="text-xs text-muted-foreground">{delivery.template?.name ?? delivery.trigger.replaceAll('_', ' ')}</p>
          {delivery.lastError && <p className="mt-1 line-clamp-2 text-xs text-destructive">{delivery.lastError}</p>}
        </>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 'fit',
      cell: ({ row: delivery }) => (
        <>
          <Badge variant={deliveryBadge[delivery.status]}>{delivery.status}</Badge>
          <p className="mt-1 text-[10px] text-muted-foreground">{STATUS_HELP[delivery.status]}</p>
        </>
      ),
    },
    {
      id: 'when',
      header: 'When',
      width: 'fit',
      wrap: 'nowrap',
      cellClassName: 'text-xs text-muted-foreground',
      cell: ({ row: delivery }) => (
        <>
          {new Date(delivery.sentAt ?? delivery.createdAt).toLocaleString('en-GB')}
          {delivery.attemptCount > 1 && (
            <span className="block text-[10px]">
              attempt {delivery.attemptCount}/{delivery.maxAttempts}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'actions',
      width: 'fit',
      align: 'right',
      cell: ({ row: delivery }) => (
        <div className="flex items-center justify-end gap-2">
          {delivery.status === 'failed' && (
            <Button
              variant="outline"
              size="sm"
              disabled={retry.isPending}
              onClick={(event) => {
                event.stopPropagation();
                retry.mutate(delivery.id);
              }}
            >
              <RefreshCw /> Try again
            </Button>
          )}
          <Eye size={15} className="text-muted-foreground" aria-hidden="true" />
        </div>
      ),
    },
  ];

  if (!deliveries.length && !isLoading) {
    return (
      <EmptyState
        icon={Send}
        title="No emails sent yet"
        description="Every automatic and manual email lands here, so you can see what your customers received."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every email your business has sent. Click a row to see exactly what the customer received.
        </p>
        <span className="text-xs text-muted-foreground">Refreshes automatically</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl options={STATUS_FILTERS} value={status} onChange={setStatus} />
        <div className="w-full max-w-xs">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            leftIcon={<Search size={14} />}
            placeholder="Search recipient or subject…"
            aria-label="Search deliveries"
          />
        </div>
        {(status !== 'all' || search.trim()) && (
          <span className="text-xs text-muted-foreground">
            {visible.length} of {deliveries.length} on this page
          </span>
        )}
      </div>

      <DataTable
        aria-label="Email delivery history"
        data={visible}
        columns={columns}
        getRowKey={(delivery) => delivery.id}
        isLoading={isLoading}
        emptyState={<EmptyState icon={Search} title="Nothing matches" description="Try a different search or status." />}
        onRowClick={({ row }) => onPreview(row)}
        rowAriaLabel={({ row }) => `Open email to ${row.toEmail}: ${row.subject}`}
        minWidth={760}
        footer={
          (data?.pages ?? 1) > 1 ? (
            <div className="flex items-center justify-end gap-2 border-t border-border p-3">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {data?.pages}
              </span>
              <Button variant="outline" size="sm" disabled={page === data?.pages} onClick={() => setPage((value) => value + 1)}>
                Next
              </Button>
            </div>
          ) : null
        }
        footerClassName="p-0"
      />
    </div>
  );
}
