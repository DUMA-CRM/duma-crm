'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Popover } from 'radix-ui';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AuditCopyButton, AuditInspector, type AuditPivot } from '@/components/audit/AuditInspector';
import { AuditTable, auditRowId } from '@/components/audit/AuditTable';
import { AlertCircle, CalendarDays, History, Layers3, ListView, Loader2, Search, SlidersHorizontal, User, X } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { FilterChip } from '@/components/shared/FilterChip';
import { SegmentedControl, type SegmentedOption } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';

import { type AuditLog, getAuditLogs } from '@/lib/api/audit.service';
import { getStaff } from '@/lib/api/staff.service';
import { groupAuditLogs } from '@/lib/audit/groups';
import { auditActor, auditPhrase, auditRole, auditSeverity, fullTimestamp } from '@/lib/audit/narrative';
import { COMMON_ACTIONS, actionFilterLabel, actionResource, resourceMeta, resourcePickerOptions } from '@/lib/audit/vocabulary';
import { hasCapability } from '@/lib/auth/capabilities';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * The audit endpoint is mounted with `getPagination(c, 50, 200)`, so 200 is a
 * hard ceiling — a 500 option would be silently clamped and the control would
 * be claiming a page size the API will not serve.
 */
const PAGE_SIZES = [50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 50;
/** Long enough not to churn the list under someone reading it. */
const LIVE_INTERVAL_MS = 20_000;

type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom';
type GroupMode = 'record' | 'entry';

const DATE_FILTERS: SelectOption[] = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

const RANGE_LABEL: Record<DatePreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'Any time',
  custom: 'Custom range',
};

const GROUP_OPTIONS: SegmentedOption<GroupMode>[] = [
  { value: 'record', label: 'By record', icon: Layers3 },
  { value: 'entry', label: 'Every entry', icon: ListView },
];

const ACTION_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All actions' },
  ...COMMON_ACTIONS.map((value) => ({ value, label: actionFilterLabel(value) })),
];

// The whole known vocabulary, not a shortlist: a record type missing from the
// picker is indistinguishable from one the log has never seen.
const RESOURCE_OPTIONS: SelectOption[] = [{ value: 'all', label: 'All records' }, ...resourcePickerOptions()];

// ── Helpers ───────────────────────────────────────────────────────────────────

function optionLabel(options: SelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function datesForPreset(preset: Exclude<DatePreset, 'all' | 'custom'>) {
  const end = new Date();
  const start = new Date();
  if (preset === '7d') start.setDate(start.getDate() - 6);
  if (preset === '30d') start.setDate(start.getDate() - 29);
  return { from: dateInputValue(start), to: dateInputValue(end) };
}

function startOfLocalDay(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function endOfLocalDay(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function initialPage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/** A hand-edited `?limit=` outside the offered sizes falls back rather than being sent. */
function initialPageSize(value: string | null) {
  const parsed = Number(value);
  return PAGE_SIZES.includes(parsed as (typeof PAGE_SIZES)[number]) ? parsed : DEFAULT_PAGE_SIZE;
}

/** The inspector docks beside the table on wide screens and slides over below it. */
function useWideLayout() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1280px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

// ── Page ──────────────────────────────────────────────────────────────────────

function AuditLogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Same gate as the header's audit drawer.
  const role = useAuthStore((s) => s.role);
  const capabilities = useAuthStore((s) => s.capabilities);
  const canView = hasCapability(capabilities, 'audit:read');
  useEffect(() => {
    if (role && !canView) router.replace('/dashboard');
  }, [role, canView, router]);

  const tenantId = useWorkspaceStore((s) => s.tenantId);
  const wide = useWideLayout();

  const initialFrom = searchParams.get('from') ?? '';
  const initialTo = searchParams.get('to') ?? '';
  const requestedPreset = searchParams.get('range') as DatePreset | null;
  const validPreset = requestedPreset && requestedPreset in RANGE_LABEL ? requestedPreset : null;

  const [page, setPage] = useState(() => initialPage(searchParams.get('page')));
  const [pageSize, setPageSize] = useState(() => initialPageSize(searchParams.get('limit')));
  const [action, setAction] = useState(searchParams.get('action') ?? 'all');
  const [resourceType, setResourceType] = useState(searchParams.get('resourceType') ?? 'all');
  const [actorId, setActorId] = useState(searchParams.get('userId') ?? 'all');
  const [resourceId, setResourceId] = useState(searchParams.get('resourceId') ?? '');
  const [datePreset, setDatePreset] = useState<DatePreset>(validPreset ?? (initialFrom || initialTo ? 'custom' : 'all'));
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const [search, setSearch] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>('record');
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set());
  // Highlight and inspection are one thing on wide screens and two on narrow:
  // there the slide-over only opens on an explicit click.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Auto-refresh never stops now, so an entry being read can drop off page one
  // mid-read. Retaining the last one keeps the inspector from blanking; the row
  // highlight goes with it, which is the honest signal that it has scrolled out
  // of the live view.
  const [lastSelected, setLastSelected] = useState<AuditLog | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // Relative times stay honest while the page is left open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const invalidDateRange = Boolean(from && to && from > to);
  const hasFilters = action !== 'all' || resourceType !== 'all' || actorId !== 'all' || !!resourceId || datePreset !== 'all';
  // Everything the popover now owns, so its badge counts what is out of sight.
  const advancedFilterCount =
    Number(actorId !== 'all') + Number(resourceType !== 'all') + Number(!!resourceId) + Number(datePreset === 'custom' && (!!from || !!to));

  const { data: staff = [] } = useQuery({
    queryKey: ['staff', tenantId],
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: canView && !!tenantId,
  });

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['audit-logs', page, pageSize, action, resourceType, actorId, resourceId, from, to],
    queryFn: () =>
      getAuditLogs({
        page,
        limit: pageSize,
        action: action === 'all' ? undefined : action,
        resourceType: resourceType === 'all' ? undefined : resourceType,
        userId: actorId === 'all' ? undefined : actorId,
        resourceId: resourceId || undefined,
        from: from ? startOfLocalDay(from) : undefined,
        to: to ? endOfLocalDay(to) : undefined,
      }),
    enabled: canView && !invalidDateRange,
    placeholderData: (previousData) => previousData,
    // Always on: the log keeps itself current with no switch to find.
    refetchInterval: LIVE_INTERVAL_MS,
  });

  const logs = useMemo(() => data?.data ?? [], [data?.data]);
  const totalPages = data?.pages ?? 1;

  /**
   * Text search runs over the loaded page only — the API has no free-text
   * filter — so the placeholder states its scope rather than implying it
   * searched everything.
   */
  const visibleLogs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((log) => {
      return `${auditActor(log)} ${auditRole(log) ?? ''} ${auditPhrase(log)} ${resourceMeta(log.resourceType).plural}`
        .toLowerCase()
        .includes(needle);
    });
  }, [logs, search]);

  const groups = useMemo(() => groupAuditLogs(visibleLogs, auditSeverity, groupMode === 'record'), [groupMode, visibleLogs]);

  // Actions and records the API returned that the shipped lists don't name yet.
  const actionOptions = useMemo(() => {
    const discovered = logs
      .map((log) => log.action)
      .filter((value, index, values) => values.indexOf(value) === index)
      .filter((value) => !ACTION_OPTIONS.some((option) => option.value === value))
      .map((value) => ({ value, label: actionFilterLabel(value) }));
    if (action !== 'all' && ![...ACTION_OPTIONS, ...discovered].some((option) => option.value === action)) {
      discovered.unshift({ value: action, label: actionFilterLabel(action) });
    }

    const all = [...ACTION_OPTIONS, ...discovered];
    if (resourceType === 'all') return all;
    // Picking a record type narrows the action list to that type's own events —
    // an unmapped action stays visible rather than being hidden on a guess.
    return all.filter((option) => {
      if (option.value === 'all' || option.value === action) return true;
      const owner = actionResource(option.value);
      return owner === null || owner === resourceType;
    });
  }, [action, logs, resourceType]);

  const resourceOptions = useMemo(() => {
    const discovered = logs
      .map((log) => log.resourceType)
      .filter((value, index, values) => values.indexOf(value) === index)
      .filter((value) => !RESOURCE_OPTIONS.some((option) => option.value === value))
      .map((value) => ({ value, label: resourceMeta(value).plural }));
    if (resourceType !== 'all' && ![...RESOURCE_OPTIONS, ...discovered].some((option) => option.value === resourceType)) {
      discovered.unshift({ value: resourceType, label: resourceMeta(resourceType).plural });
    }
    return [...RESOURCE_OPTIONS, ...discovered];
  }, [logs, resourceType]);

  const actorOptions = useMemo<SelectOption[]>(() => {
    const options = staff
      .map((member) => ({ value: member.userId, label: member.name || member.email || member.userId }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (actorId !== 'all' && !options.some((option) => option.value === actorId)) {
      options.unshift({ value: actorId, label: actorId });
    }
    return [{ value: 'all', label: 'All actors' }, ...options];
  }, [actorId, staff]);

  // ── URL sync ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    ['page', 'limit', 'action', 'resourceType', 'userId', 'resourceId', 'range', 'from', 'to'].forEach((key) => params.delete(key));
    if (page > 1) params.set('page', String(page));
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set('limit', String(pageSize));
    if (action !== 'all') params.set('action', action);
    if (resourceType !== 'all') params.set('resourceType', resourceType);
    if (actorId !== 'all') params.set('userId', actorId);
    if (resourceId) params.set('resourceId', resourceId);
    if (datePreset !== 'all') params.set('range', datePreset);
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState(null, '', nextUrl);
  }, [action, actorId, datePreset, resourceId, from, page, pageSize, resourceType, to]);

  // ── Filter actions ──────────────────────────────────────────────────────────

  const resetPage = useCallback(() => setPage(1), []);

  const clearDates = useCallback(() => {
    setDatePreset('all');
    setFrom('');
    setTo('');
  }, []);

  function changeDatePreset(value: string) {
    const next = value as DatePreset;
    setDatePreset(next);
    resetPage();
    if (next === 'all') {
      setFrom('');
      setTo('');
      return;
    }
    if (next === 'custom') {
      window.setTimeout(() => setAdvancedOpen(true), 0);
      return;
    }
    const dates = datesForPreset(next);
    setFrom(dates.from);
    setTo(dates.to);
  }

  function clearFilters() {
    setAction('all');
    setResourceType('all');
    setActorId('all');
    setResourceId('');
    setSearch('');
    clearDates();
    resetPage();
  }

  /**
   * A pivot promises "everything", so it clears the date range too — otherwise
   * a trace started from a Today view would silently hide the record's history.
   */
  function applyPivot(pivot: AuditPivot) {
    if (pivot.kind === 'actor') setActorId(pivot.value);
    if (pivot.kind === 'action') setAction(pivot.value);
    if (pivot.kind === 'resourceId') setResourceId(pivot.value);
    clearDates();
    setSearch('');
    resetPage();
  }

  function toggleGroup(key: string) {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const leaveCurrentRows = useCallback(() => {
    setSelectedId(null);
    setLastSelected(null);
    setDrawerOpen(false);
    setExpandedKeys(new Set());
  }, []);

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages));
    leaveCurrentRows();
  }

  function changePageSize(next: number) {
    setPageSize(next);
    // Page 4 of 50-row pages is not page 4 of 200-row pages, so the offset is
    // meaningless after a resize.
    setPage(1);
    leaveCurrentRows();
  }

  // ── Selection & keyboard ────────────────────────────────────────────────────

  const selected = useMemo(
    () => visibleLogs.find((log) => log.id === selectedId) ?? (selectedId ? lastSelected : null),
    [lastSelected, selectedId, visibleLogs],
  );

  const selectEntry = useCallback((log: AuditLog) => {
    setSelectedId(log.id);
    setLastSelected(log);
  }, []);

  /** Every entry currently on screen, in display order — what the arrows walk. */
  const walkable = useMemo(
    () => groups.flatMap((group) => (group.entries.length > 1 && !expandedKeys.has(group.key) ? [] : group.entries)),
    [expandedKeys, groups],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable === true);

      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      // A dialog on top owns its own keys.
      if (document.querySelector('[role="dialog"]')) return;

      if (event.key === 'Escape') {
        setSelectedId(null);
        setLastSelected(null);
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      if (walkable.length === 0) return;

      event.preventDefault();
      const index = walkable.findIndex((log) => log.id === selectedId);
      const next =
        event.key === 'ArrowDown'
          ? index < 0
            ? 0
            : Math.min(index + 1, walkable.length - 1)
          : index < 0
            ? walkable.length - 1
            : Math.max(index - 1, 0);

      const nextLog = walkable[next];
      selectEntry(nextLog);
      document.getElementById(auditRowId(nextLog.id))?.scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectEntry, selectedId, walkable]);

  if (!canView) return null;

  // ── Toolbar ─────────────────────────────────────────────────────────────────

  const toolbar = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1 lg:max-w-sm">
          <Input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search the entries loaded below"
            placeholder={logs.length ? `Search these ${logs.length} entries…` : 'Search these entries…'}
            leftIcon={<Search size={14} />}
            rightAction={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              ) : undefined
            }
            className="border-rule bg-background"
          />
        </div>

        <Select
          value={action}
          onValueChange={(value) => {
            setAction(value);
            resetPage();
          }}
          options={actionOptions}
          ariaLabel="Filter by action"
          className="w-[calc(50%-0.25rem)] sm:w-48"
        />
        <Select
          value={datePreset}
          onValueChange={changeDatePreset}
          options={DATE_FILTERS}
          ariaLabel="Filter by date range"
          icon={<CalendarDays />}
          className="w-[calc(50%-0.25rem)] sm:w-40"
        />

        <Popover.Root open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <Popover.Trigger asChild>
            <Button variant="outline" className="w-[calc(50%-0.25rem)] sm:w-auto" aria-label="Open more audit filters">
              <SlidersHorizontal data-icon="inline-start" />
              More filters
              {advancedFilterCount > 0 && (
                <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-micro font-semibold text-primary-foreground">
                  {advancedFilterCount}
                </span>
              )}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={8}
              collisionPadding={16}
              className="z-90 w-[calc(100vw-2rem)] max-w-sm rounded-sm border border-rule bg-surface p-4 shadow-xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">More filters</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Narrow to one record or an exact date range.</p>
                </div>
                <Popover.Close asChild>
                  <button
                    type="button"
                    aria-label="Close filters"
                    className="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </Popover.Close>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-micro font-semibold tracking-micro uppercase text-muted-foreground">Actor</span>
                  <Select
                    value={actorId}
                    onValueChange={(value) => {
                      setActorId(value);
                      resetPage();
                    }}
                    options={actorOptions}
                    ariaLabel="Filter by actor"
                    icon={<User />}
                    className="w-full"
                  />
                  {!tenantId && <p className="text-xs text-muted-foreground">Select a workspace to load named actors.</p>}
                </div>

                <div className="space-y-1.5">
                  <span className="text-micro font-semibold tracking-micro uppercase text-muted-foreground">Record type</span>
                  <Select
                    value={resourceType}
                    onValueChange={(value) => {
                      setResourceType(value);
                      resetPage();
                    }}
                    options={resourceOptions}
                    ariaLabel="Filter by record type"
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="audit-record-id" className="text-micro font-semibold tracking-micro uppercase text-muted-foreground">
                    Record ID
                  </label>
                  <Input
                    id="audit-record-id"
                    value={resourceId}
                    onChange={(event) => {
                      setResourceId(event.target.value.trim());
                      resetPage();
                    }}
                    placeholder="Paste an exact ID…"
                    className="border-rule bg-background"
                  />
                  <p className="text-xs text-muted-foreground">Matched in full — the audit API has no partial text search.</p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-micro font-semibold tracking-micro uppercase text-muted-foreground">Custom dates</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={from}
                      onChange={(event) => {
                        setFrom(event.target.value);
                        setDatePreset('custom');
                        resetPage();
                      }}
                      aria-label="Audit entries from date"
                      className="border-rule bg-background px-2"
                    />
                    <Input
                      type="date"
                      value={to}
                      onChange={(event) => {
                        setTo(event.target.value);
                        setDatePreset('custom');
                        resetPage();
                      }}
                      aria-label="Audit entries to date"
                      className="border-rule bg-background px-2"
                    />
                  </div>
                  {invalidDateRange && (
                    <p role="alert" className="flex items-center gap-1.5 text-xs text-exception">
                      <AlertCircle size={12} aria-hidden="true" /> The end date must be on or after the start date.
                    </p>
                  )}
                </div>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {hasFilters && (
          <>
            {actorId !== 'all' && (
              <FilterChip
                label={`Actor: ${optionLabel(actorOptions, actorId)}`}
                onRemove={() => {
                  setActorId('all');
                  resetPage();
                }}
              />
            )}
            {action !== 'all' && (
              <FilterChip
                label={`Action: ${optionLabel(actionOptions, action)}`}
                onRemove={() => {
                  setAction('all');
                  resetPage();
                }}
              />
            )}
            {resourceType !== 'all' && (
              <FilterChip
                label={`Record: ${optionLabel(resourceOptions, resourceType)}`}
                onRemove={() => {
                  setResourceType('all');
                  resetPage();
                }}
              />
            )}
            {resourceId && (
              <FilterChip
                label={`ID: ${resourceId}`}
                onRemove={() => {
                  setResourceId('');
                  resetPage();
                }}
              />
            )}
            {datePreset !== 'all' && (
              <FilterChip
                label={datePreset === 'custom' ? `Dates: ${from || 'any'} – ${to || 'any'}` : `Range: ${RANGE_LABEL[datePreset]}`}
                onRemove={() => {
                  clearDates();
                  resetPage();
                }}
              />
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </>
        )}

        {/* A view control, not a filter — it changes how the same entries read. */}
        <SegmentedControl
          options={GROUP_OPTIONS}
          value={groupMode}
          onChange={setGroupMode}
          ariaLabel="Group entries by record, or list every entry"
          className="ml-auto"
        />
      </div>
    </div>
  );

  // ── Table states ────────────────────────────────────────────────────────────

  const constraints = [
    actorId !== 'all' ? `by ${optionLabel(actorOptions, actorId)}` : null,
    action !== 'all' ? `matching “${optionLabel(actionOptions, action)}”` : null,
    resourceType !== 'all' ? `on ${optionLabel(resourceOptions, resourceType).toLowerCase()}` : null,
    resourceId ? `for record ${resourceId}` : null,
    datePreset !== 'all' ? `in ${RANGE_LABEL[datePreset].toLowerCase()}` : null,
  ].filter(Boolean);

  const emptyState = search ? (
    <EmptyState
      icon={Search}
      title="Nothing on this page matches"
      description={`No loaded entry mentions “${search}”. The search only covers the ${logs.length} entries fetched for this page.`}
    />
  ) : (
    <EmptyState
      icon={History}
      title={hasFilters ? 'No entries match' : 'No activity recorded yet'}
      description={
        hasFilters
          ? `Nothing was recorded ${constraints.join(', ')}. Clear a filter or widen the range.`
          : 'Every action taken in this workspace lands here — who did it, what changed, and whether it worked.'
      }
    />
  );

  const pagination = {
    page,
    totalPages,
    onPageChange: goToPage,
    pageSize,
    pageSizeOptions: PAGE_SIZES,
    onPageSizeChange: changePageSize,
    rowLabel: 'Entries',
  };

  // The total is a property of the page, not of the toolbar, so it reads once
  // in the masthead where every other page states its own scale.
  const meta = data ? (
    <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground" aria-live="polite">
      {isFetching && !isLoading && <Loader2 size={12} className="animate-spin" aria-label="Updating results" />}
      {data.total.toLocaleString()} {data.total === 1 ? 'entry' : 'entries'}
    </span>
  ) : undefined;

  return (
    <EditorShell title="Audit log" icon={<History size={20} aria-hidden="true" />} meta={meta} flush>
      {/* One scroll region holding toolbar and table, so the filters scroll
          away with the page. It still needs `min-h-0` to be a scroll container
          at all — without it the column's intrinsic minimum is the full table
          height and the whole shell grows instead. The table's own sticky
          header then pins to the top of this region as the toolbar leaves. */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
            {toolbar}

            {invalidDateRange ? (
              <EmptyState icon={CalendarDays} title="Check the date range" description="The end date must be on or after the start date." />
            ) : isError ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-sm border border-exception/30 bg-card px-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-md bg-exception/8 text-exception">
                  <AlertCircle size={22} aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-base font-semibold text-foreground">The audit log could not be loaded</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Check your connection and try again. Your search and filters will stay in place.
                </p>
                <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
                  Try again
                </Button>
              </div>
            ) : (
              <AuditTable
                groups={groups}
                now={now}
                selectedId={selectedId}
                expandedKeys={expandedKeys}
                onToggleGroup={toggleGroup}
                onSelect={(log) => {
                  selectEntry(log);
                  if (!wide) setDrawerOpen(true);
                }}
                isLoading={isLoading}
                emptyState={emptyState}
                pagination={pagination}
              />
            )}
          </div>
        </div>

        {/* The workbench: band-tinted so it reads as attached to the table. */}
        <aside aria-label="Entry detail" className="hidden w-110 shrink-0 flex-col border-l border-rule bg-band/45 xl:flex 2xl:w-125">
          <AuditInspector log={selected} activeActorId={actorId} activeAction={action} activeResourceId={resourceId} onPivot={applyPivot} />
        </aside>
      </div>

      {/* Below the split breakpoint the same panel slides over the table. */}
      {!wide && drawerOpen && selected && (
        <Drawer
          title={`${auditActor(selected)}${auditRole(selected) ? ` (${auditRole(selected)})` : ''} ${auditPhrase(selected)}`}
          description={fullTimestamp(selected.createdAt)}
          onClose={() => setDrawerOpen(false)}
          actions={<AuditCopyButton value={JSON.stringify(selected, null, 2)} label="entry as JSON" />}
        >
          <AuditInspector
            log={selected}
            activeActorId={actorId}
            activeAction={action}
            activeResourceId={resourceId}
            onPivot={(pivot) => {
              applyPivot(pivot);
              setDrawerOpen(false);
              setSelectedId(null);
            }}
            chrome="drawer"
          />
        </Drawer>
      )}
    </EditorShell>
  );
}

function AuditLogPageFallback() {
  return (
    <EditorShell title="Audit log" icon={<History size={20} aria-hidden="true" />} flush>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 px-3 py-4 md:px-6 md:py-6">
          <div className="h-9 w-full max-w-sm animate-pulse rounded-sm bg-muted" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-sm bg-muted/70" />
            ))}
          </div>
        </div>
        <div className="hidden w-110 shrink-0 border-l border-rule bg-band/45 xl:block 2xl:w-125" />
      </div>
    </EditorShell>
  );
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<AuditLogPageFallback />}>
      <AuditLogPageContent />
    </Suspense>
  );
}
