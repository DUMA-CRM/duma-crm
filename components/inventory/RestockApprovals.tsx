'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Package,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { getStockItems } from '@/lib/api/inventory.service';
import {
  type RestockPriority,
  type RestockRequest,
  type RestockStatus,
  decodeNotes,
  deleteRestockRequest,
  encodeNotes,
  getRestockRequests,
  updateRestockRequest,
} from '@/lib/api/restock.service';
import { roleAtLeast } from '@/lib/api/staff.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_ORDER: RestockStatus[] = ['pending', 'approved', 'rejected', 'fulfilled'];
const PAGE_SIZE = 25;

const STATUS_META: Record<
  RestockStatus,
  { label: string; variant: 'warning' | 'success' | 'destructive' | 'muted'; iconBg: string; iconFg: string }
> = {
  pending: { label: 'Pending', variant: 'warning', iconBg: 'bg-warning/10', iconFg: 'text-warning' },
  approved: { label: 'Approved', variant: 'success', iconBg: 'bg-success/10', iconFg: 'text-success' },
  rejected: { label: 'Rejected', variant: 'destructive', iconBg: 'bg-destructive/10', iconFg: 'text-destructive' },
  fulfilled: { label: 'Ordered', variant: 'muted', iconBg: 'bg-muted', iconFg: 'text-muted-foreground' },
};

const PRIORITY_OPTIONS = [
  { value: 'standard' as const, label: 'Standard' },
  { value: 'urgent' as const, label: 'Urgent' },
] as const;

const textareaClass = cn(
  'w-full bg-surface-offset border border-transparent rounded-lg px-3 py-2 text-sm text-foreground',
  'placeholder:text-muted-foreground outline-none resize-none',
  'focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150',
);

// ── Row ───────────────────────────────────────────────────────────────────────

function RequestRow({
  request,
  locationName,
  onApprove,
  onReject,
  onFulfill,
  onSave,
  onDelete,
  statusPending,
  savePending,
  deletePending,
  canDelete,
  fulfillLabel,
}: {
  request: RestockRequest;
  locationName: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onFulfill: (id: string) => void;
  onSave: (id: string, data: { requestedQty: number; notes?: string }) => void;
  onDelete: (id: string) => void;
  statusPending: boolean;
  savePending: boolean;
  deletePending: boolean;
  canDelete: boolean;
  fulfillLabel: string;
}) {
  const { priority, notes } = decodeNotes(request.notes);
  const meta = STATUS_META[request.status];
  const isPending = request.status === 'pending';
  const unit = request.stockItem?.unit ?? 'units';

  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [editQty, setEditQty] = useState(String(request.requestedQty));
  const [editPriority, setEditPriority] = useState<RestockPriority>(priority);
  const [editNotes, setEditNotes] = useState(notes);

  function startEdit() {
    setEditQty(String(request.requestedQty));
    setEditPriority(priority);
    setEditNotes(notes);
    setMode('edit');
  }

  function save() {
    const q = parseInt(editQty, 10);
    if (!q || q < 1) return;
    onSave(request.id, { requestedQty: q, notes: encodeNotes(editPriority, editNotes) });
    setMode('view');
  }

  return (
    <div
      className={cn(
        'px-4 py-4 border-b border-border/50 last:border-0 transition-opacity',
        statusPending && 'opacity-50 pointer-events-none',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        {/* Icon */}
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5', meta.iconBg)}>
          <ClipboardList size={15} className={meta.iconFg} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">
              {request.stockItem?.name ?? <span className="font-mono text-xs">{request.id.slice(0, 8)}</span>}
            </p>
            {priority === 'urgent' && (
              <Badge variant="destructive" className="text-[10px]">
                Urgent
              </Badge>
            )}
            <Badge variant={meta.variant} className="text-[10px]">
              {meta.label}
            </Badge>
          </div>

          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Package size={11} />
              {request.requestedQty} {unit} requested
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin size={11} />
              {locationName}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays size={11} />
              {timeAgo(request.createdAt)}
            </span>
          </div>

          {notes && mode === 'view' && <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-2">{notes}</p>}
        </div>

        {/* Actions */}
        {isPending && mode === 'view' && (
          <div className="flex flex-wrap items-center gap-1.5 self-end shrink-0">
            <button
              type="button"
              onClick={startEdit}
              aria-label="Edit request"
              className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-surface-offset hover:text-foreground transition-colors"
            >
              <Pencil size={13} />
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => setMode('delete')}
                aria-label="Delete request"
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
            <div className="w-px h-5 bg-border mx-0.5" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReject(request.id)}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
            >
              <XCircle size={13} />
              Reject
            </Button>
            <Button size="sm" onClick={() => onApprove(request.id)} className="bg-success text-success-foreground hover:bg-success/90">
              <CheckCircle2 size={13} />
              Approve
            </Button>
          </div>
        )}
        {request.status === 'approved' && mode === 'view' && (
          <Button size="sm" onClick={() => onFulfill(request.id)} disabled={statusPending} className="shrink-0">
            <CheckCircle2 size={13} />
            {fulfillLabel}
          </Button>
        )}
      </div>

      {/* Inline edit */}
      {mode === 'edit' && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-32">
              <Input label="QUANTITY" type="number" min={1} value={editQty} onChange={(e) => setEditQty(e.target.value)} placeholder="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label uppercase>Priority</Label>
              <SegmentedControl options={PRIORITY_OPTIONS} value={editPriority} onChange={setEditPriority} />
            </div>
          </div>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Additional notes…"
            maxLength={900}
            rows={2}
            className={textareaClass}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setMode('view')}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={savePending}>
              {savePending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}

      {/* Inline delete confirm */}
      {mode === 'delete' && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-destructive/5 border border-destructive/10 px-3 py-2.5">
          <AlertTriangle size={14} className="text-destructive shrink-0" />
          <p className="text-xs text-destructive flex-1">Delete this request? This can’t be undone.</p>
          <Button variant="ghost" size="sm" onClick={() => setMode('view')}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
            disabled={deletePending}
            onClick={() => onDelete(request.id)}
          >
            {deletePending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── View ──────────────────────────────────────────────────────────────────────

export function RestockApprovals({
  onCreatePurchaseOrder,
}: {
  onCreatePurchaseOrder?: (request: RestockRequest) => void;
} = {}) {
  const { tenantId } = useWorkspaceStore();
  const role = useAuthStore((state) => state.role);
  const [activeTab, setActiveTab] = useState<RestockStatus>('pending');
  const [locationFilter, setLocationFilter] = useState('all');
  const [itemFilter, setItemFilter] = useState('all');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const canDelete = roleAtLeast(role, 'franchise_owner');

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['restock-requests', 'list', activeTab, locationFilter, itemFilter, page],
    queryFn: () =>
      getRestockRequests({
        status: activeTab,
        locationId: locationFilter === 'all' ? undefined : locationFilter,
        stockItemId: itemFilter === 'all' ? undefined : itemFilter,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });
  const { data: stockItems = [] } = useQuery({
    queryKey: ['stock-items'],
    queryFn: getStockItems,
  });

  const countQueries = useQueries({
    queries: STATUS_ORDER.map((status) => ({
      queryKey: ['restock-requests', 'count', status, locationFilter, itemFilter],
      queryFn: () =>
        getRestockRequests({
          status,
          locationId: locationFilter === 'all' ? undefined : locationFilter,
          stockItemId: itemFilter === 'all' ? undefined : itemFilter,
          limit: 1,
        }),
    })),
  });

  const locationMap = Object.fromEntries(locations.map((l) => [l.id, l.name]));
  const counts = Object.fromEntries(STATUS_ORDER.map((status, index) => [status, countQueries[index].data?.total ?? 0])) as Record<
    RestockStatus,
    number
  >;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
  };

  const {
    mutate: changeStatus,
    isPending: statusPending,
    variables: statusVariables,
  } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RestockStatus }) => updateRestockRequest(id, { status }),
    onSuccess: (_request, variables) => {
      invalidate();
      const message =
        variables.status === 'fulfilled'
          ? 'Request marked as fulfilled.'
          : variables.status === 'approved'
            ? 'Request approved.'
            : 'Request rejected.';
      toast('success', message);
    },
    onError: (error: Error) => toast('error', error.message || 'Unable to update the request.'),
  });

  const {
    mutate: saveEdit,
    isPending: savePending,
    variables: saveVariables,
  } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { requestedQty: number; notes?: string } }) => updateRestockRequest(id, data),
    onSuccess: () => {
      invalidate();
      toast('success', 'Request updated.');
    },
    onError: (error: Error) => toast('error', error.message || 'Unable to save the request.'),
  });

  const {
    mutate: removeRequest,
    isPending: deletePending,
    variables: deleteVariables,
  } = useMutation({
    mutationFn: (id: string) => deleteRestockRequest(id),
    onSuccess: () => {
      invalidate();
      toast('success', 'Request deleted.');
    },
    onError: (error: Error) => toast('error', error.message || 'Unable to delete the request.'),
  });

  const requests = data?.data ?? [];
  const totalPages = data?.pages ?? 1;
  const urgentCount = requests.filter((r) => decodeNotes(r.notes).priority === 'urgent').length;

  function changeTab(status: RestockStatus) {
    setActiveTab(status);
    setPage(1);
  }

  function changeLocation(value: string) {
    setLocationFilter(value);
    setPage(1);
  }

  function changeItem(value: string) {
    setItemFilter(value);
    setPage(1);
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ── Filters ────────────────────────────────────────── */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            options={STATUS_ORDER.map((status) => ({
              value: status,
              label: counts[status] > 0 ? `${STATUS_META[status].label} ${counts[status]}` : STATUS_META[status].label,
            }))}
            value={activeTab}
            onChange={changeTab}
          />
          {activeTab === 'pending' && urgentCount > 0 && <Badge variant="destructive">{urgentCount} urgent on this page</Badge>}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,16rem)_minmax(12rem,20rem)_1fr]">
          <Select
            value={locationFilter}
            onValueChange={changeLocation}
            ariaLabel="Filter requests by location"
            icon={<MapPin />}
            options={[
              { value: 'all', label: 'All locations' },
              ...locations
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((location) => ({ value: location.id, label: location.name })),
            ]}
            className="w-full"
          />
          <Select
            value={itemFilter}
            onValueChange={changeItem}
            ariaLabel="Filter requests by stock item"
            icon={<Package />}
            options={[
              { value: 'all', label: 'All items' },
              ...stockItems
                .filter((item) => item.isActive)
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => ({ value: item.id, label: item.name })),
            ]}
            className="w-full"
          />
          <div className="flex items-center justify-end text-xs text-muted-foreground">
            {isFetching && !isLoading ? 'Updating…' : `${data?.total ?? 0} request${data?.total === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      {/* ── Request list ───────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="w-9 h-9 rounded-xl bg-surface-offset animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 bg-surface-offset rounded animate-pulse" />
                  <div className="h-3 w-64 bg-surface-offset rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle size={32} className="mb-3 text-destructive/60" />
            <p className="text-sm font-medium text-foreground">Couldn’t load restock requests</p>
            <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No {STATUS_META[activeTab].label.toLowerCase()} requests.</p>
            {(locationFilter !== 'all' || itemFilter !== 'all') && (
              <p className="mt-1 text-xs text-muted-foreground/70">Try changing the location or item filter.</p>
            )}
            {activeTab === 'pending' && locationFilter === 'all' && itemFilter === 'all' && (
              <p className="text-xs text-muted-foreground/70 mt-1">New requests submitted from the form will appear here.</p>
            )}
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
                locationName={locationMap[r.locationId] ?? `${r.locationId.slice(0, 8)}…`}
                onApprove={(id) => changeStatus({ id, status: 'approved' })}
                onReject={(id) => changeStatus({ id, status: 'rejected' })}
                onFulfill={(id) => {
                  if (onCreatePurchaseOrder) {
                    onCreatePurchaseOrder(r);
                    return;
                  }
                  changeStatus({ id, status: 'fulfilled' });
                }}
                onSave={(id, dataToSave) => saveEdit({ id, data: dataToSave })}
                onDelete={(id) => removeRequest(id)}
                statusPending={statusPending && statusVariables?.id === r.id}
                savePending={savePending && saveVariables?.id === r.id}
                deletePending={deletePending && deleteVariables === r.id}
                canDelete={canDelete}
                fulfillLabel={onCreatePurchaseOrder ? 'Create PO' : 'Mark fulfilled'}
              />
            ))}
          </div>
        )}

        {!isLoading && !isError && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((value) => value - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage((value) => value + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
