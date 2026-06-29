'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, ClipboardList, MapPin, Pencil, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

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
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type FilterStatus = 'all' | RestockStatus;

const STATUS_OPTIONS = [
  { value: 'all' as const, label: 'All' },
  { value: 'pending' as const, label: 'Pending' },
  { value: 'approved' as const, label: 'Approved' },
  { value: 'fulfilled' as const, label: 'Done' },
  { value: 'rejected' as const, label: 'Rejected' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'standard' as const, label: 'Standard' },
  { value: 'urgent' as const, label: 'Urgent' },
] as const;

const STATUS_VARIANT: Record<RestockStatus, 'warning' | 'success' | 'primary' | 'destructive'> = {
  pending: 'warning',
  approved: 'primary',
  fulfilled: 'success',
  rejected: 'destructive',
};

const btnCancel =
  'flex-1 h-8 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:bg-surface-offset transition-colors';
const btnPrimary =
  'flex-1 h-8 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60';
const btnDestructive =
  'flex-1 h-8 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold rounded-lg transition-colors disabled:opacity-60';
const textareaClass = cn(
  'w-full bg-surface-offset border border-transparent rounded-lg px-3 py-2 text-xs text-foreground',
  'placeholder:text-muted-foreground outline-none resize-none',
  'focus:border-primary focus:ring-2 focus:ring-primary/15',
  'transition-[border-color,box-shadow] duration-150',
);

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function RestockRequestsSidebar() {
  const { tenantId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPriority, setEditPriority] = useState<RestockPriority>('standard');
  const [editNotes, setEditNotes] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: response, isLoading } = useQuery({
    queryKey: ['restock-requests'],
    queryFn: () => getRestockRequests({ limit: 100 }),
    refetchInterval: 30_000,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ['stock-items'],
    queryFn: () => getStockItems(),
  });

  const { mutate: update, isPending: updatePending } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateRestockRequest>[1] }) =>
      updateRestockRequest(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
      setEditingId(null);
    },
  });

  const { mutate: remove, isPending: deletePending } = useMutation({
    mutationFn: deleteRestockRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
      setDeletingId(null);
    },
  });

  const locationMap = Object.fromEntries(locations.map((l) => [l.id, l.name]));
  const stockItemMap = Object.fromEntries(stockItems.map((s) => [s.id, s]));

  const requests = response?.data ?? [];
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const filtered = (filterStatus === 'all' ? requests : requests.filter((r) => r.status === filterStatus)).filter((r) => {
    if (!search.trim()) return true;
    const item = r.stockItem ?? stockItemMap[r.stockItemId];
    const q = search.toLowerCase();
    return (item?.name ?? '').toLowerCase().includes(q) || (locationMap[r.locationId] ?? '').toLowerCase().includes(q);
  });

  function startEdit(req: RestockRequest) {
    const { priority, notes } = decodeNotes(req.notes);
    setEditingId(req.id);
    setEditQty(String(req.requestedQty));
    setEditPriority(priority);
    setEditNotes(notes);
    setDeletingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditQty('');
    setEditNotes('');
  }

  function handleSave(id: string) {
    const qtyNum = parseInt(editQty, 10);
    if (!editQty || isNaN(qtyNum) || qtyNum < 1) return;
    update({ id, data: { requestedQty: qtyNum, notes: encodeNotes(editPriority, editNotes) } });
  }

  return (
    <div className="w-115 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0 space-y-3">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">History</p>
            {pendingCount > 0 && <Badge variant="warning">{pendingCount} pending</Badge>}
          </div>
          <p className="font-semibold text-foreground">Submitted Requests</p>
        </div>

        <Input
          placeholder="Search by item or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={13} />}
        />

        <SegmentedControl options={STATUS_OPTIONS} value={filterStatus} onChange={setFilterStatus} />
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-2.5">
          {isLoading ? (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-28 bg-surface-offset rounded-xl animate-pulse" />
              ))}
            </>
          ) : filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <ClipboardList size={32} className="text-muted-foreground/40" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {search ? 'No results found' : 'No requests'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {search
                    ? 'Try a different search term.'
                    : filterStatus === 'all'
                      ? 'Submit your first restock request using the form.'
                      : `No ${filterStatus} requests found.`}
                </p>
              </div>
            </div>
          ) : (
            filtered.map((req) => {
              const item = req.stockItem ?? stockItemMap[req.stockItemId];
              const { priority, notes } = decodeNotes(req.notes);
              const locationName = locationMap[req.locationId];
              const isEditing = editingId === req.id;
              const isDeleting = deletingId === req.id;

              return (
                <div key={req.id} className="bg-background rounded-xl p-4 border border-border space-y-2.5">
                  {/* Always-visible header */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm text-foreground leading-snug line-clamp-2">
                      {item?.name ?? '—'}
                    </p>
                    <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                      {priority === 'urgent' && !isEditing && <Badge variant="destructive">Urgent</Badge>}
                      <Badge variant={STATUS_VARIANT[req.status]}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Badge>
                    </div>
                  </div>

                  {/* Edit form */}
                  {isEditing ? (
                    <div className="space-y-3 pt-1">
                      <Input
                        label="QUANTITY"
                        type="number"
                        min={1}
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        placeholder="0"
                      />
                      <div className="flex flex-col gap-1.5">
                        <Label uppercase>Priority</Label>
                        <SegmentedControl options={PRIORITY_OPTIONS} value={editPriority} onChange={setEditPriority} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label uppercase>Notes</Label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Additional notes…"
                          maxLength={900}
                          rows={2}
                          className={textareaClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={cancelEdit} className={btnCancel}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSave(req.id)}
                          disabled={updatePending}
                          className={btnPrimary}
                        >
                          {updatePending ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : isDeleting ? (
                    /* Delete confirmation */
                    <div className="space-y-3 pt-1">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={13} className="text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-foreground">This will permanently delete the request. Are you sure?</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setDeletingId(null)} className={btnCancel}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(req.id)}
                          disabled={deletePending}
                          className={btnDestructive}
                        >
                          {deletePending ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal details view */
                    <>
                      <div className="space-y-1">
                        {locationName && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin size={11} className="shrink-0" />
                            <span className="truncate">{locationName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs">
                          <span className="font-semibold text-foreground">{req.requestedQty}</span>
                          <span className="text-muted-foreground">{item?.unit ?? 'units'}</span>
                          <span className="text-muted-foreground">requested</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays size={11} className="shrink-0" />
                          <span>{formatDate(req.createdAt)}</span>
                        </div>
                      </div>

                      {notes && (
                        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-2 line-clamp-3">
                          {notes}
                        </p>
                      )}

                      {req.status === 'pending' && (
                        <div className={cn('flex gap-1 pt-2', notes || locationName ? 'border-t border-border' : '')}>
                          <button
                            type="button"
                            onClick={() => startEdit(req)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded-lg hover:bg-surface-offset transition-colors"
                          >
                            <Pencil size={11} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingId(req.id);
                              setEditingId(null);
                            }}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive h-7 px-2 rounded-lg hover:bg-destructive/10 transition-colors ml-auto"
                          >
                            <Trash2 size={11} />
                            Delete
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
