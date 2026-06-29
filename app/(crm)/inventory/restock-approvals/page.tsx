'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, ClipboardList, MapPin, Package, XCircle } from 'lucide-react';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  type RestockRequest,
  type RestockStatus,
  decodeNotes,
  getRestockRequests,
  updateRestockRequest,
} from '@/lib/api/restock.service';
import { cn } from '@/lib/utils/cn';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_TABS: { label: string; value: RestockStatus }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Fulfilled', value: 'fulfilled' },
];

const STATUS_BADGE: Record<RestockStatus, { variant: 'warning' | 'success' | 'destructive' | 'muted'; label: string }> = {
  pending: { variant: 'warning', label: 'Pending' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'destructive', label: 'Rejected' },
  fulfilled: { variant: 'muted', label: 'Fulfilled' },
};

// ── Row ───────────────────────────────────────────────────────────────────────

function RequestRow({
  request,
  onApprove,
  onReject,
  isPending,
}: {
  request: RestockRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isPending: boolean;
}) {
  const { priority, notes } = decodeNotes(request.notes);
  const statusBadge = STATUS_BADGE[request.status];
  const isActionable = request.status === 'pending';

  return (
    <div className={cn('flex items-start gap-4 px-4 py-4 border-b border-border/50 last:border-0 transition-opacity', isPending && 'opacity-50 pointer-events-none')}>
      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0 mt-0.5">
        <ClipboardList size={15} className="text-warning" />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">
            {request.stockItem?.name ?? <span className="font-mono text-xs">{request.id.slice(0, 8)}</span>}
          </p>
          <Badge variant={priority === 'urgent' ? 'destructive' : 'muted'} className="text-[10px]">
            {priority}
          </Badge>
          <Badge variant={statusBadge.variant} className="text-[10px]">
            {statusBadge.label}
          </Badge>
        </div>

        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Package size={11} />
            {request.requestedQty} {request.stockItem?.unit ?? 'units'} requested
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={11} />
            {request.locationId.slice(0, 8)}…
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays size={11} />
            {timeAgo(request.createdAt)}
          </span>
        </div>

        {notes && (
          <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-2">{notes}</p>
        )}
      </div>

      {/* Actions */}
      {isActionable && (
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReject(request.id)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          >
            <XCircle size={13} />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => onApprove(request.id)}
            className="bg-success text-success-foreground hover:bg-success/90"
          >
            <CheckCircle2 size={13} />
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RestockApprovalsPage() {
  const [activeTab, setActiveTab] = useState<RestockStatus>('pending');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['restock-approvals', activeTab],
    queryFn: () => getRestockRequests({ status: activeTab, limit: 100 }),
  });

  const requests: RestockRequest[] = Array.isArray(data)
    ? data
    : (data as { data?: RestockRequest[] } | null)?.data ?? [];

  const { mutate: changeStatus, isPending: isMutating } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RestockStatus }) =>
      updateRestockRequest(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restock-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
    },
  });

  const urgentCount = requests.filter((r) => decodeNotes(r.notes).priority === 'urgent').length;

  return (
    <PageLayout
      eyebrow="Super Admin"
      title="Restock Approvals"
      headerBorder
      headerSlot={
        activeTab === 'pending' && urgentCount > 0 ? (
          <Badge variant="destructive">{urgentCount} urgent</Badge>
        ) : undefined
      }
    >
      {/* ── Status tabs ────────────────────────────────────── */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors',
              activeTab === tab.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Request list ───────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No {activeTab} requests.</p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/50 border-b border-border">
              <div className="w-9 shrink-0" />
              <p className="flex-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Item / Details</p>
              {activeTab === 'pending' && (
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0 pr-1">Actions</p>
              )}
            </div>

            {requests.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                onApprove={(id) => changeStatus({ id, status: 'approved' })}
                onReject={(id) => changeStatus({ id, status: 'rejected' })}
                isPending={isMutating}
              />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
