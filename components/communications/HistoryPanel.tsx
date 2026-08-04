'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { CalendarRange, CheckCircle2, Clock3, Eye, Mail, RefreshCw, Search, Send, TriangleAlert, Zap } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';

import { type EmailDelivery, getEmailDeliveries, retryEmailDelivery } from '@/lib/api/email.service';
import { formatDateTime } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { PanelHeader, PanelSearch, PanelToolbar, ResultCount } from './PanelChrome';
import { deliveryBadge } from './shared';

type StatusFilter = 'all' | 'sent' | 'queued' | 'failed' | 'cancelled';
type WindowFilter = 'all' | 'today' | '7d' | '30d';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'sent', label: 'Sent' },
  { value: 'queued', label: 'Waiting' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const WINDOW_OPTIONS = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

/** Cut-off for the time filter, or null when it is off. */
const windowStart = (value: WindowFilter): number | null => {
  if (value === 'all') return null;
  const now = new Date();
  if (value === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return now.getTime() - (value === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000;
};

/** Plain-language meaning of each delivery status. */
const STATUS_HELP: Record<EmailDelivery['status'], string> = {
  queued: 'Waiting to be sent',
  sending: 'Being sent right now',
  sent: 'Handed to the mail server',
  failed: 'Could not be sent',
  cancelled: 'Stopped before sending',
};

/** Dot colour per status — pairs with the badge so the row scans at a glance. */
const STATUS_DOT: Record<EmailDelivery['status'], string> = {
  queued: 'bg-muted-foreground',
  sending: 'bg-primary',
  sent: 'bg-success',
  failed: 'bg-destructive',
  cancelled: 'bg-warning',
};

const matchesStatus = (delivery: EmailDelivery, status: StatusFilter) => {
  if (status === 'all') return true;
  // "Waiting" covers both queued and mid-send — the user cannot act on either.
  if (status === 'queued') return delivery.status === 'queued' || delivery.status === 'sending';
  return delivery.status === status;
};

export function HistoryPanel({ onPreview }: { onPreview: (delivery: EmailDelivery) => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [template, setTemplate] = useState('all');
  const [trigger, setTrigger] = useState('all');
  const [sentWithin, setSentWithin] = useState<WindowFilter>('all');
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

  // Filter choices come from the page in view, so the lists never offer a value
  // that would return nothing.
  const templateOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const delivery of deliveries) if (delivery.template) names.set(delivery.template.id, delivery.template.name);
    return [
      { value: 'all', label: 'Any template' },
      ...[...names].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [deliveries]);

  const triggerOptions = useMemo(() => {
    const triggers = [...new Set(deliveries.map((delivery) => delivery.trigger))].sort();
    return [
      { value: 'all', label: 'Any source' },
      ...triggers.map((value) => ({ value, label: value.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase()) })),
    ];
  }, [deliveries]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const since = windowStart(sentWithin);
    return deliveries
      .filter((delivery) => matchesStatus(delivery, status))
      .filter((delivery) => (template === 'all' ? true : delivery.template?.id === template))
      .filter((delivery) => (trigger === 'all' ? true : delivery.trigger === trigger))
      .filter((delivery) => (since === null ? true : new Date(delivery.sentAt ?? delivery.createdAt).getTime() >= since))
      .filter((delivery) =>
        query ? `${delivery.toEmail} ${delivery.toName ?? ''} ${delivery.subject}`.toLowerCase().includes(query) : true,
      );
  }, [deliveries, status, template, trigger, sentWithin, search]);

  const filtering = status !== 'all' || template !== 'all' || trigger !== 'all' || sentWithin !== 'all' || Boolean(search.trim());
  const clearFilters = () => {
    setStatus('all');
    setTemplate('all');
    setTrigger('all');
    setSentWithin('all');
    setSearch('');
  };

  // Counts describe the page in view — the API paginates and does not total by status.
  const counts = useMemo(
    () => ({
      all: deliveries.length,
      sent: deliveries.filter((delivery) => matchesStatus(delivery, 'sent')).length,
      queued: deliveries.filter((delivery) => matchesStatus(delivery, 'queued')).length,
      failed: deliveries.filter((delivery) => matchesStatus(delivery, 'failed')).length,
    }),
    [deliveries],
  );

  const columns: DataTableColumn<EmailDelivery>[] = [
    {
      id: 'recipient',
      header: 'Recipient',
      minWidth: 200,
      cell: ({ row: delivery }) => (
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold uppercase text-primary"
            aria-hidden="true"
          >
            {(delivery.toName || delivery.toEmail).trim().slice(0, 2)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{delivery.toName || delivery.toEmail}</span>
            {delivery.toName && <span className="block truncate text-xs text-muted-foreground">{delivery.toEmail}</span>}
          </span>
        </div>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      minWidth: 240,
      maxWidth: 420,
      cell: ({ row: delivery }) => (
        <>
          <p className="truncate text-sm text-foreground">{delivery.subject}</p>
          <p className="truncate text-xs capitalize text-muted-foreground">
            {delivery.template?.name ?? delivery.trigger.replaceAll('_', ' ')}
          </p>
          {delivery.lastError && (
            <p className="mt-1.5 line-clamp-2 rounded-md border border-destructive/25 bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
              {delivery.lastError}
            </p>
          )}
        </>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 'fit',
      cell: ({ row: delivery }) => (
        <>
          <Badge variant={deliveryBadge[delivery.status]} className="capitalize">
            <span className={cn('size-1.5 rounded-full', STATUS_DOT[delivery.status])} aria-hidden="true" />
            {delivery.status}
          </Badge>
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
          {formatDateTime(delivery.sentAt ?? delivery.createdAt)}
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
      <div className="space-y-4">
        <PanelHeader title="History" description="Every automatic and manual email lands here, so you can see what customers received." />
        <div className="rounded-2xl border border-dashed border-border bg-card">
          <EmptyState
            icon={Send}
            title="No emails sent yet"
            description="Switch on an automation, or send one by hand from a customer record."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PanelHeader
        title="History"
        count={data?.total}
        description="Every email your business has sent. Click a row to see exactly what the customer received."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
            <span className="relative flex size-1.5" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            Live
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          size="sm"
          label="On this page"
          icon={Mail}
          accent="neutral"
          value={counts.all}
          caption={data?.total ? `of ${data.total} sent all time` : undefined}
        />
        <StatCard size="sm" label="Sent" icon={CheckCircle2} accent="success" value={counts.sent} caption="Handed to the mail server" />
        <StatCard size="sm" label="Waiting" icon={Clock3} accent="warning" value={counts.queued} caption="Queued or sending now" />
        <StatCard size="sm" label="Failed" icon={TriangleAlert} accent="danger" value={counts.failed} caption="Needs another attempt" />
      </div>

      <PanelToolbar
        trailing={<PanelSearch value={search} onChange={setSearch} placeholder="Search recipient or subject…" label="Search deliveries" />}
      >
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
          options={STATUS_OPTIONS}
          ariaLabel="Filter by delivery status"
          icon={<CheckCircle2 />}
          className="w-40"
        />
        <Select
          value={template}
          onValueChange={setTemplate}
          options={templateOptions}
          ariaLabel="Filter by template"
          icon={<Mail />}
          className="w-44"
          disabled={templateOptions.length === 1}
        />
        <Select
          value={trigger}
          onValueChange={setTrigger}
          options={triggerOptions}
          ariaLabel="Filter by what sent the email"
          icon={<Zap />}
          className="w-44"
          disabled={triggerOptions.length === 1}
        />
        <Select
          value={sentWithin}
          onValueChange={(value) => setSentWithin(value as WindowFilter)}
          options={WINDOW_OPTIONS}
          ariaLabel="Filter by when the email was sent"
          icon={<CalendarRange />}
          className="w-38"
        />
        {filtering && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </PanelToolbar>

      <DataTable
        aria-label="Email delivery history"
        data={visible}
        columns={columns}
        getRowKey={(delivery) => delivery.id}
        isLoading={isLoading}
        stickyHeader
        emptyState={<EmptyState icon={Search} title="Nothing matches" description="Try a different search or loosen the filters." />}
        onRowClick={({ row }) => onPreview(row)}
        rowAriaLabel={({ row }) => `Open email to ${row.toEmail}: ${row.subject}`}
        minWidth={760}
        footer={
          (data?.pages ?? 1) > 1 ? (
            <div className="flex items-center justify-between gap-2 border-t border-border p-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                Page {page} of {data?.pages}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page === data?.pages} onClick={() => setPage((value) => value + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null
        }
        footerClassName="p-0"
      />

      {/* Under the table, where you land after reading the rows. */}
      {filtering && (
        <div>
          <ResultCount shown={visible.length} total={deliveries.length} noun="on this page" />
        </div>
      )}
    </div>
  );
}
