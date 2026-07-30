'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MailX, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { deliveryBadge } from '@/components/communications/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';

import { type EmailDelivery, getEmailDeliveries, retryEmailDelivery } from '@/lib/api/email.service';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** Plain-language meaning of each delivery status. */
const STATUS_HELP: Record<EmailDelivery['status'], string> = {
  queued: 'Waiting to be sent',
  sending: 'Being sent right now',
  sent: 'Handed to the mail server',
  failed: 'Could not be sent',
  cancelled: 'Stopped before sending',
};

/** Every email this customer has been sent, newest first. */
export function CustomerEmails({ customerId }: { customerId: string }) {
  const { tenantId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<EmailDelivery | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customer-emails', tenantId, customerId, page],
    queryFn: () => getEmailDeliveries(tenantId ?? undefined, page, { customerId, limit: 20 }),
    enabled: !!tenantId,
  });

  const retry = useMutation({
    mutationFn: (id: string) => retryEmailDelivery(id, tenantId ?? undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customer-emails'] });
      void queryClient.invalidateQueries({ queryKey: ['email-deliveries'] });
      toast('success', 'Queued for another attempt.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });

  const returned = data?.data ?? [];
  // The list endpoint is asked to filter by customer, but never trust it to have
  // done so — another customer's mail must not appear on this record.
  const emails = returned.filter((delivery) => delivery.customerId === customerId);
  const serverFiltered = returned.length === emails.length;
  const totalPages = data?.pages ?? 1;

  const columns: DataTableColumn<EmailDelivery>[] = [
    {
      id: 'email',
      header: 'Email',
      minWidth: 240,
      maxWidth: 460,
      cell: ({ row: delivery }) => (
        <>
          <p className="truncate text-sm font-medium text-foreground">{delivery.subject}</p>
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
      header: 'Sent',
      width: 'fit',
      wrap: 'nowrap',
      visibility: 'sm',
      cellClassName: 'text-xs text-muted-foreground tabular-nums',
      cell: ({ row: delivery }) => (
        <>
          {when(delivery.sentAt ?? delivery.createdAt)}
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
      cell: ({ row: delivery }) =>
        delivery.status === 'failed' ? (
          <Button
            variant="outline"
            size="sm"
            disabled={retry.isPending}
            onClick={(event) => {
              event.stopPropagation();
              retry.mutate(delivery.id);
            }}
          >
            <RefreshCw size={13} /> Try again
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable
        aria-label="Emails sent to this customer"
        data={emails}
        columns={columns}
        getRowKey={(delivery) => delivery.id}
        isLoading={isLoading}
        minWidth={640}
        emptyState={
          <EmptyState
            icon={MailX}
            title="No emails sent"
            description="Emails from automations or sent by hand to this customer will appear here."
          />
        }
        onRowClick={({ row }) => setPreview(row)}
        rowAriaLabel={({ row }) => `Open email: ${row.subject}`}
        footer={
          emails.length > 0 ? (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {serverFiltered
                  ? `${data?.total ?? emails.length} email${(data?.total ?? emails.length) === 1 ? '' : 's'}`
                  : `${emails.length} of the ${returned.length} most recent emails`}
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

      {preview && (
        <Modal title={preview.subject} onClose={() => setPreview(null)} className="max-w-3xl">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={deliveryBadge[preview.status]}>{preview.status}</Badge>
              <span>{when(preview.sentAt ?? preview.createdAt)}</span>
              <span className="truncate">to {preview.toEmail}</span>
            </div>
            {/* The stored body is the exact HTML the customer received. */}
            <div
              className="overflow-x-auto rounded-2xl border border-border bg-white p-4 text-black"
              dangerouslySetInnerHTML={{ __html: preview.htmlBody }}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
