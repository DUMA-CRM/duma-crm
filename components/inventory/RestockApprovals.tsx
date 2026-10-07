'use client';

import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Flame,
  Loader2,
  Package,
  PackageOpen,
  Pencil,
  ShoppingCart,
  Trash2,
  Truck,
  XCircle,
} from '@/components/icons';
import { fmtQty, normaliseArray } from '@/components/inventory/stock/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards, FormSection, NumberStepper } from '@/components/shared/FormParts';
import { LoadMore } from '@/components/shared/LoadMore';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { serverCache } from '@/lib/api/cache-policy';
import { hasCapability } from '@/lib/auth/capabilities';
import {
  type InventoryForecast,
  type InventoryOverviewRow,
  type LocationStock,
  getInventoryForecast,
  getInventoryOverview,
  getLocationStock,
  getStockItems,
} from '@/lib/modules/inventory/client';
import {
  type RestockPriority,
  type RestockRequest,
  type RestockStatus,
  decodeNotes,
  deleteRestockRequest,
  encodeNotes,
  getRestockRequests,
  receiveRestockRequest,
  updateRestockRequest,
} from '@/lib/modules/inventory/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';
import { type RestockJourneyStage, restockJourney } from '@/lib/utils/restock-journey';
import { type StockContext, dayLabel, orderRequests, requestContext } from '@/lib/utils/restock-queue';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/*
 * Restock demand: what the team has asked for, and the decision on each. Read
 * as a queue — urgent first, then whoever has waited longest — with the stock
 * behind each request on the row, so approving doesn't mean opening another
 * tab. The Stock tab's vocabulary: a filter row, audit-log rows, pills.
 */

const STATUS_ORDER: RestockStatus[] = ['pending', 'approved', 'fulfilled', 'rejected'];
const PAGE_SIZE = 25;

const STATUS_META: Record<RestockStatus, { label: string; short: string; tint: string; icon: typeof ClipboardList }> = {
  pending: { label: 'Waiting for review', short: 'To review', tint: 'bg-reference/8 text-reference', icon: ClipboardList },
  approved: { label: 'Approved', short: 'Approved', tint: 'bg-momentum/8 text-momentum', icon: CheckCircle2 },
  fulfilled: { label: 'Ordered', short: 'Ordered', tint: 'bg-band text-muted-foreground', icon: Truck },
  rejected: { label: 'Rejected', short: 'Rejected', tint: 'bg-exception/8 text-exception', icon: XCircle },
};

export function RestockApprovals({
  onCreatePurchaseOrder,
  onCreatePurchaseOrderBatch,
  status,
  onStatusChange,
}: {
  onCreatePurchaseOrder?: (request: RestockRequest) => void;
  /** Offered on the approved list when the requests share one location. */
  onCreatePurchaseOrderBatch?: (requests: RestockRequest[]) => void;
  /** Controlled status filter (`all` for every request) — omit and the panel keeps its own. */
  status?: RestockStatus | 'all';
  onStatusChange?: (status: RestockStatus | 'all') => void;
} = {}) {
  const { tenantId, locationId } = useWorkspaceStore();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canDecide = hasCapability(capabilities, 'restock:write');
  const canDelete = hasCapability(capabilities, 'restock:delete');
  const [ownStatus, setOwnStatus] = useState<RestockStatus | 'all'>('all');
  const activeStatus = status ?? ownStatus;
  const [itemFilter, setItemFilter] = useState('all');
  const [receiveRequest, setReceiveRequest] = useState<RestockRequest | null>(null);
  const [now] = useState(() => new Date());
  const queryClient = useQueryClient();

  const list = useInfiniteQuery({
    queryKey: moduleQueryKeys.inventory.key('restock-requests', 'list', activeStatus, itemFilter),
    queryFn: ({ pageParam }) =>
      getRestockRequests({
        status: activeStatus === 'all' ? undefined : activeStatus,
        stockItemId: itemFilter === 'all' ? undefined : itemFilter,
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    placeholderData: (previous) => previous,
  });

  const { data: locations = [] } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });
  const { data: stockItems = [] } = useQuery({ queryKey: moduleQueryKeys.inventory.key('stock-items'), queryFn: getStockItems });

  // The shelf behind each request — for the location picked in the top bar,
  // on the same keys as the Stock tab, so it's usually already cached.
  const { data: rawStock } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('location-stock', locationId),
    queryFn: () => getLocationStock(locationId!),
    enabled: !!locationId,
  });
  const { data: rawOverview } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('inventory-overview', locationId),
    queryFn: () => getInventoryOverview(locationId!),
    enabled: !!locationId,
  });
  const { data: rawForecast } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('inventory-forecast', locationId),
    queryFn: () => getInventoryForecast(locationId!),
    enabled: !!locationId,
    ...serverCache('inventoryForecast'),
  });
  const context = useMemo(() => {
    const map = new Map<string, StockContext>();
    const overview = new Map(normaliseArray<InventoryOverviewRow>(rawOverview).map((row) => [row.stockItemId, row]));
    const forecast = new Map(normaliseArray<InventoryForecast>(rawForecast).map((row) => [row.locationStockId, row]));
    for (const row of normaliseArray<LocationStock>(rawStock)) {
      map.set(row.stockItemId, {
        qty: Number(overview.get(row.stockItemId)?.totalOnHand ?? row.quantity) || 0,
        threshold: Number(row.lowThreshold) || 0,
        unit: row.stockItem?.unit ?? '',
        coverDays: forecast.get(row.id)?.daysOfStockRemaining ?? null,
      });
    }
    return map;
  }, [rawStock, rawOverview, rawForecast]);

  const FILTERS: (RestockStatus | 'all')[] = ['all', ...STATUS_ORDER];
  const countQueries = useQueries({
    queries: FILTERS.map((countStatus) => ({
      queryKey: moduleQueryKeys.inventory.key('restock-requests', 'count', countStatus, itemFilter),
      queryFn: () =>
        getRestockRequests({
          status: countStatus === 'all' ? undefined : countStatus,
          stockItemId: itemFilter === 'all' ? undefined : itemFilter,
          limit: 1,
        }),
    })),
  });
  const counts = Object.fromEntries(FILTERS.map((s, index) => [s, countQueries[index].data?.total ?? 0])) as Record<
    RestockStatus | 'all',
    number
  >;
  const locationName = (id: string) => locations.find((location) => location.id === id)?.name ?? 'Unknown location';

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('restock-requests') });
  const decide = useMutation({
    mutationFn: ({ id, next }: { id: string; next: RestockStatus }) => updateRestockRequest(id, { status: next }),
    onSuccess: (_result, { next }) => {
      invalidate();
      toast('success', next === 'fulfilled' ? 'Marked as ordered.' : next === 'approved' ? 'Request approved.' : 'Request rejected.');
    },
    onError: (error: Error) => toast('error', error.message || 'The request wasn’t updated. Try again.'),
  });
  const save = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { requestedQty: number; notes?: string } }) => updateRestockRequest(id, data),
    onSuccess: () => {
      invalidate();
      toast('success', 'Request updated.');
    },
    onError: (error: Error) => toast('error', error.message || 'The request wasn’t saved. Try again.'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRestockRequest(id),
    onSuccess: () => {
      invalidate();
      toast('success', 'Request deleted.');
    },
    onError: (error: Error) => toast('error', error.message || 'The request wasn’t deleted. Try again.'),
  });

  const requests = useMemo(() => {
    const seen = new Set<string>();
    const all = (list.data?.pages ?? [])
      .flatMap((page) => page.data)
      .filter((request) => (seen.has(request.id) ? false : (seen.add(request.id), true)));
    // "All" is history, newest first; a single status keeps its own order.
    return activeStatus === 'all'
      ? all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : orderRequests(all, (request) => decodeNotes(request.notes).priority);
  }, [list.data?.pages, activeStatus]);
  const total = list.data?.pages[0]?.total ?? 0;
  const urgent = requests.filter((request) => request.status === 'pending' && decodeNotes(request.notes).priority === 'urgent').length;

  // Pending reads as one queue; everything else as history under each day.
  const groups = useMemo(() => {
    if (activeStatus === 'pending') return [{ key: 'queue', label: null as string | null, items: requests }];
    const map = new Map<string, RestockRequest[]>();
    for (const request of requests) {
      const label = dayLabel(request.createdAt, now);
      map.set(label, [...(map.get(label) ?? []), request]);
    }
    return [...map.entries()].map(([label, items]) => ({ key: label, label, items }));
  }, [requests, activeStatus, now]);

  // A purchase order is for one location: the approved requests for the
  // location in the top bar, or all of them if they already share one.
  const batch = requests.filter((request) =>
    locationId ? request.locationId === locationId : request.locationId === requests[0]?.locationId,
  );
  const showBatch = activeStatus === 'approved' && !!onCreatePurchaseOrderBatch && requests.length > 1;
  const canBatch = showBatch && batch.length > 1;

  const changeStatus = (next: RestockStatus | 'all') => (onStatusChange ? onStatusChange(next) : setOwnStatus(next));

  const TILES: { value: RestockStatus | 'all'; label: string; icon: typeof ClipboardList }[] = [
    { value: 'all', label: 'All requests', icon: Package },
    ...STATUS_ORDER.map((value) => ({
      value,
      label: value === 'fulfilled' && !onCreatePurchaseOrder ? 'Completed' : STATUS_META[value].short,
      icon: STATUS_META[value].icon,
    })),
  ];

  return (
    <motion.div className="space-y-4" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      {/* How many requests sit at each stage — and the way in: a tile filters to its stage, again to show all. */}
      <motion.dl variants={SECTION_RISE} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.filter((tile) => tile.value !== 'all').map((tile) => (
          <Fact
            key={tile.value}
            surface="page"
            icon={tile.value === 'pending' && urgent > 0 ? Flame : tile.icon}
            label={tile.label}
            value={counts[tile.value]}
            tone={tile.value === 'pending' && urgent > 0 ? 'danger' : 'default'}
            hint={tile.value === 'pending' && urgent > 0 ? `${urgent} urgent` : undefined}
            onSelect={() => changeStatus(activeStatus === tile.value ? 'all' : tile.value)}
            selected={activeStatus === tile.value}
          />
        ))}
      </motion.dl>

      <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
        <Select
          value={activeStatus}
          onValueChange={(value) => changeStatus(value as RestockStatus | 'all')}
          ariaLabel="Status"
          options={TILES.map((tile) => ({ value: tile.value, label: tile.label }))}
          className="w-52"
        />
        <Select
          value={itemFilter}
          onValueChange={setItemFilter}
          ariaLabel="Item"
          icon={<Package />}
          options={[
            { value: 'all', label: 'All items' },
            ...stockItems
              .filter((item) => item.isActive)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((item) => ({ value: item.id, label: item.name })),
          ]}
          className="w-56"
        />
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
          {list.isFetching && !list.isPending && <Loader2 size={12} className="animate-spin" aria-label="Updating" />}
          {/* A single stage's count is on its tile already. */}
          {activeStatus === 'all' && `${total} ${total === 1 ? 'request' : 'requests'}`}
        </span>
      </motion.div>

      {showBatch && (
        <motion.div
          variants={SECTION_RISE}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3"
        >
          <ShoppingCart size={16} className="shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-foreground">
            {canBatch ? (
              <>
                Order the <span className="font-semibold">{batch.length} approved requests</span> for {locationName(batch[0].locationId)}{' '}
                together.
              </>
            ) : (
              <span className="text-muted-foreground">These span several locations — pick one in the top bar to combine them.</span>
            )}
          </p>
          {canBatch && (
            <Button size="sm" onClick={() => onCreatePurchaseOrderBatch?.(batch)}>
              Create purchase order
            </Button>
          )}
        </motion.div>
      )}

      <motion.section variants={SECTION_RISE} aria-label="Requests">
        {list.isError ? (
          <ErrorState
            title="Restock requests couldn’t be loaded"
            description="Nothing was read, so this isn’t an empty list."
            onRetry={() => void list.refetch()}
          />
        ) : list.isPending ? (
          <ListSkeleton rows={5} label="Loading restock requests" />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={activeStatus === 'pending' ? CheckCircle2 : ClipboardList}
            kind={itemFilter !== 'all' ? 'search' : activeStatus === 'pending' ? 'done' : activeStatus === 'all' ? 'start' : 'search'}
            title={
              activeStatus === 'all'
                ? 'No restock requests yet'
                : activeStatus === 'pending'
                  ? 'Nothing to review'
                  : `No ${STATUS_META[activeStatus].label.toLowerCase()} requests`
            }
            description={
              itemFilter !== 'all'
                ? 'Try another item, or all items.'
                : 'Requests from the team — or from Request more on the Stock tab — land here.'
            }
            action={
              itemFilter !== 'all'
                ? { label: 'Show all items', onClick: () => setItemFilter('all') }
                : activeStatus !== 'all' && activeStatus !== 'pending'
                  ? { label: 'Show all requests', onClick: () => changeStatus('all') }
                  : undefined
            }
          />
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.key}>
                {group.label && <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">{group.label}</h2>}
                <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                  {group.items.map((request) => (
                    <RequestRow
                      key={request.id}
                      request={request}
                      locationName={locationName(request.locationId)}
                      stock={request.locationId === locationId ? context.get(request.stockItemId) : undefined}
                      canDecide={canDecide}
                      canDelete={canDelete}
                      busy={
                        (decide.isPending && decide.variables?.id === request.id) || (remove.isPending && remove.variables === request.id)
                      }
                      saving={save.isPending && save.variables?.id === request.id}
                      orderLabel={onCreatePurchaseOrder ? 'Create purchase order' : 'Receive stock'}
                      onDecide={(next) => decide.mutate({ id: request.id, next })}
                      onOrder={() => (onCreatePurchaseOrder ? onCreatePurchaseOrder(request) : setReceiveRequest(request))}
                      onReceive={() => setReceiveRequest(request)}
                      directReceive={!onCreatePurchaseOrder}
                      onSave={(data) => save.mutate({ id: request.id, data })}
                      onDelete={() => remove.mutate(request.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
            <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoadMore={() => void list.fetchNextPage()} />
          </div>
        )}
      </motion.section>

      {receiveRequest && (
        <ReceiveRestockDrawer
          request={receiveRequest}
          onClose={() => setReceiveRequest(null)}
          onDone={() => {
            setReceiveRequest(null);
            invalidate();
            void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.all });
          }}
        />
      )}
    </motion.div>
  );
}

function ReceiveRestockDrawer({ request, onClose, onDone }: { request: RestockRequest; onClose: () => void; onDone: () => void }) {
  const item = request.stockItem;
  const [quantity, setQuantity] = useState(String(request.requestedQty));
  const [expiryDate, setExpiryDate] = useState(() => {
    if (!item?.isPerishable || !item.defaultShelfLifeDays) return '';
    const date = new Date();
    date.setDate(date.getDate() + item.defaultShelfLifeDays);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const [lotNumber, setLotNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const amount = Number(quantity.replace(',', '.'));
  const quantityError = Number.isFinite(amount) && amount > 0 ? null : 'Enter the quantity that physically arrived.';
  const expiryError = item?.isPerishable && !expiryDate ? 'Perishable stock needs a use-by date.' : null;
  const valid = !quantityError && !expiryError;

  const receive = useMutation({
    mutationFn: () =>
      receiveRestockRequest(request.id, {
        quantity: amount,
        expiryDate: expiryDate || null,
        lotNumber: lotNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast('success', `${fmtQty(amount)} ${item?.unit ?? 'units'} received — stock is now up to date.`);
      onDone();
    },
    onError: (error: Error) => toast('error', error.message || 'The delivery wasn’t received. Check the details and try again.'),
  });

  return (
    <Drawer
      title="Receive stock"
      description={`${item?.name ?? 'Stock item'} · confirm what physically arrived before changing the on-hand balance.`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={receive.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="receive-restock" size="lg" className="flex-1" disabled={receive.isPending}>
            {receive.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PackageOpen aria-hidden="true" />}
            Receive stock
          </Button>
        </div>
      }
    >
      <form
        id="receive-restock"
        noValidate
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (valid) receive.mutate();
        }}
      >
        <FormSection
          icon={PackageOpen}
          title="Delivery"
          note={`Requested ${request.requestedQty} ${item?.unit ?? 'units'}. Change this if less or more arrived.`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Quantity received"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="decimal"
              autoFocus
              rightIcon={<span className="text-xs">{item?.unit ?? 'units'}</span>}
              error={submitted ? (quantityError ?? undefined) : undefined}
            />
            <DatePicker
              label={item?.isPerishable ? 'Use by' : 'Use by (optional)'}
              value={expiryDate}
              onValueChange={setExpiryDate}
              required={item?.isPerishable}
              error={submitted ? (expiryError ?? undefined) : undefined}
              hint={
                item?.isPerishable && item.defaultShelfLifeDays
                  ? `Pre-filled from the ${item.defaultShelfLifeDays}-day shelf life.`
                  : undefined
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Lot number"
              value={lotNumber}
              onChange={(event) => setLotNumber(event.target.value)}
              maxLength={100}
              placeholder="Optional"
            />
            <Input
              label="Delivery note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={1000}
              placeholder="Optional"
            />
          </div>
        </FormSection>
      </form>
    </Drawer>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

function RequestJourney({ stages }: { stages: RestockJourneyStage[] }) {
  const current = stages.find((stage) => stage.state === 'current') ?? stages.at(-1)!;
  return (
    <>
      <ol className="hidden min-w-0 flex-1 items-center lg:flex" aria-label={`Progress: ${stages.map((stage) => stage.label).join(', ')}`}>
        {stages.map((stage, index) => (
          <li key={stage.label} className={cn('flex min-w-0 items-center', index < stages.length - 1 && 'flex-1')}>
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors',
                stage.state === 'done' && 'border-momentum/25 bg-momentum/10 text-momentum',
                stage.state === 'current' && 'border-primary bg-primary text-primary-foreground',
                stage.state === 'next' && 'border-rule/70 bg-field text-muted-foreground',
              )}
            >
              {stage.state === 'done' ? (
                <Check size={11} strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <span className="size-1 rounded-full bg-current" />
              )}
            </span>
            <span
              className={cn(
                'ml-1.5 shrink-0 text-micro font-semibold',
                stage.state === 'current' ? 'text-foreground' : stage.state === 'done' ? 'text-momentum' : 'text-muted-foreground',
              )}
            >
              {stage.label}
            </span>
            {index < stages.length - 1 && (
              <span
                className={cn('mx-2 h-px min-w-3 flex-1', stages[index + 1]?.state === 'done' ? 'bg-momentum/35' : 'bg-rule/55')}
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>
      <span className="truncate text-xs font-semibold text-foreground lg:hidden">{current.label}</span>
    </>
  );
}

/**
 * One request, drawn as an audit-log row: a status-tinted tile, what was asked
 * for, where and the stock behind it, a pill only when it says something, the
 * time, and the decision. Clicking the row unfolds its note, edit and delete,
 * the way an audit group unfolds to its entries.
 */
function RequestRow({
  request,
  locationName,
  stock,
  canDecide,
  canDelete,
  busy,
  saving,
  orderLabel,
  onDecide,
  onOrder,
  onReceive,
  directReceive,
  onSave,
  onDelete,
}: {
  request: RestockRequest;
  locationName: string;
  stock?: StockContext;
  canDecide: boolean;
  canDelete: boolean;
  busy: boolean;
  saving: boolean;
  orderLabel: string;
  onDecide: (next: RestockStatus) => void;
  onOrder: () => void;
  onReceive: () => void;
  directReceive: boolean;
  onSave: (data: { requestedQty: number; notes?: string }) => void;
  onDelete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { priority, notes } = decodeNotes(request.notes);
  const pending = request.status === 'pending';
  const urgent = priority === 'urgent' && pending;
  const meta = STATUS_META[request.status];
  const Icon = urgent ? Flame : meta.icon;
  const unit = request.stockItem?.unit ?? 'units';
  const ctx = pending ? requestContext(request.requestedQty, stock) : null;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [qty, setQty] = useState(request.requestedQty);
  const [editPriority, setEditPriority] = useState<RestockPriority>(priority);
  const [editNotes, setEditNotes] = useState(notes);
  const createdAt = new Date(request.createdAt);
  const received = !!request.receivedAt;
  const journey = restockJourney(request, directReceive);
  // Read once, on mount — the clock can't be read during render.
  const [mountedAt] = useState(() => Date.now());
  const expandable = !!notes || (pending && canDecide);

  return (
    <li className={cn('border-b border-rule/45 last:border-b-0', busy && 'pointer-events-none opacity-50')}>
      <div
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? open : undefined}
        onClick={() => expandable && setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (expandable && (event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
            event.preventDefault();
            setOpen((current) => !current);
          }
        }}
        className={cn(
          'flex min-h-15 items-center gap-3 px-3.5 py-2.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          expandable && 'cursor-pointer',
          open ? 'bg-band/50' : expandable && 'hover:bg-band/40',
        )}
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            urgent ? 'bg-exception/8 text-exception' : meta.tint,
          )}
        >
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 lg:w-48 lg:flex-none">
          <span className="block truncate text-sm text-foreground">
            <span className="font-semibold">{request.stockItem?.name ?? 'Unknown item'}</span> · {request.requestedQty} {unit}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {locationName}
            {ctx && (
              <>
                {' · '}
                <span className={cn(ctx.tone === 'low' ? 'text-measured' : ctx.tone === 'over' ? 'text-exception' : '')}>{ctx.text}</span>
              </>
            )}
            {!ctx && urgent && <span className="text-exception"> · Urgent</span>}
          </span>
        </span>
        <RequestJourney stages={journey} />
        <span className="hidden w-14 shrink-0 text-right text-xs text-muted-foreground sm:block" title={createdAt.toLocaleString('en-GB')}>
          {mountedAt - createdAt.getTime() < 86_400_000 ? TIME.format(createdAt) : timeAgo(request.createdAt)}
        </span>
        {pending && canDecide && (
          <span className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => onDecide('rejected')}>
              Reject
            </Button>
            <Button size="sm" onClick={() => onDecide('approved')}>
              Approve
            </Button>
          </span>
        )}
        {request.status === 'approved' && canDecide && (
          <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={onOrder}>
              <Truck data-icon="inline-start" />
              {orderLabel}
            </Button>
          </span>
        )}
        {request.status === 'fulfilled' && !directReceive && !request.purchaseOrderId && canDecide && (
          <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={onOrder}>
              <ShoppingCart data-icon="inline-start" />
              Add to purchase orders
            </Button>
          </span>
        )}
        {request.status === 'fulfilled' && directReceive && !received && canDecide && (
          <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={onReceive}>
              <PackageOpen data-icon="inline-start" />
              Receive stock
            </Button>
          </span>
        )}
        {expandable && (
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cn('shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          />
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden bg-band/25"
          >
            <div className="space-y-3 px-3.5 py-3 pl-15">
              {mode === 'view' && (
                <>
                  {notes ? (
                    <p className="text-sm italic text-muted-foreground">“{notes}”</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No note.</p>
                  )}
                  {pending && canDecide && (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setMode('edit')}
                        aria-label="Edit request"
                        title="Edit request"
                      >
                        <Pencil />
                      </Button>
                      {canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-exception hover:text-exception"
                          onClick={() => setMode('delete')}
                          aria-label="Delete request"
                          title="Delete request"
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}

              {mode === 'edit' && (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (qty < 1) return;
                    onSave({ requestedQty: qty, notes: encodeNotes(editPriority, editNotes) });
                    setMode('view');
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-label uppercase text-muted-foreground">Quantity ({unit})</p>
                      <NumberStepper label="Quantity" value={qty} onChange={setQty} min={1} />
                    </div>
                    <div>
                      <p className="mb-1.5 text-label uppercase text-muted-foreground">Priority</p>
                      <ChoiceCards
                        value={editPriority}
                        onChange={setEditPriority}
                        options={[
                          { value: 'standard', label: 'Standard' },
                          { value: 'urgent', label: 'Urgent' },
                        ]}
                      />
                    </div>
                  </div>
                  <textarea
                    value={editNotes}
                    onChange={(event) => setEditNotes(event.target.value)}
                    placeholder="A note for whoever orders it (optional)"
                    maxLength={900}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={saving || qty < 1}>
                      {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                      Save changes
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setMode('view')}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {mode === 'delete' && (
                <div className="flex flex-wrap items-center gap-3">
                  <AlertTriangle size={14} className="shrink-0 text-exception" aria-hidden="true" />
                  <p className="min-w-0 flex-1 text-sm text-exception">Delete this request? It can’t be undone.</p>
                  <Button variant="destructive" size="sm" onClick={onDelete}>
                    Delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setMode('view')}>
                    Keep it
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
