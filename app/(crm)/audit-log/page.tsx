'use client';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { AuditActivityList } from '@/components/audit/AuditActivityList';
import { AuditCopyButton, AuditInspector, type AuditPivot } from '@/components/audit/AuditInspector';
import { History, Loader2, Search, User, X } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { FilterChip } from '@/components/shared/FilterChip';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';

import { ApiError } from '@/lib/api/client';
import { entryMatches, groupEntriesLocally, mergeGroupPages } from '@/lib/audit/groups';
import { auditActor, auditPhrase, auditRole, auditSeverity, fullTimestamp } from '@/lib/audit/narrative';
import { actionFilterLabel, resourcePickerOptions } from '@/lib/audit/vocabulary';
import { hasCapability } from '@/lib/auth/capabilities';
import { type AuditGroupsResponse, type AuditLog, getAuditGroups, getAuditLogs } from '@/lib/modules/audit/client';
import { getStaff } from '@/lib/modules/identity/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { resolvedTimeZone } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** Groups per "Load more". */
const PAGE_SIZE = 25;
/** Long enough not to churn the list under someone reading it. */
const LIVE_INTERVAL_MS = 20_000;
const SEARCH_DEBOUNCE_MS = 300;

// The whole known vocabulary: a record type missing from the picker is
// indistinguishable from one the log has never seen.
const RECORD_OPTIONS: SelectOption[] = [{ value: 'all', label: 'Everything' }, ...resourcePickerOptions()];

/** The detail panel docks beside the list on wide screens and slides over below it. */
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

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * The audit log: who did what, grouped by the API into one row per person per
 * record per day, under day headings, newest first, loading more as you
 * scroll. Search, a person and a record type are the whole toolbar — the
 * "trace from here" pivots in the detail panel cover the rest (one action, one
 * record) and show as chips.
 */
function AuditLogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.role);
  const capabilities = useAuthStore((s) => s.capabilities);
  const canView = hasCapability(capabilities, 'audit:read');
  useEffect(() => {
    if (role && !canView) router.replace('/dashboard');
  }, [role, canView, router]);

  const tenantId = useWorkspaceStore((s) => s.tenantId);
  const wide = useWideLayout();
  const timeZone = useMemo(() => resolvedTimeZone(), []);

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const q = useDebounced(search.trim(), SEARCH_DEBOUNCE_MS);
  const [actorId, setActorId] = useState(searchParams.get('userId') ?? 'all');
  const [resourceType, setResourceType] = useState(searchParams.get('resourceType') ?? 'all');
  // Set only by a pivot from the detail panel; shown as removable chips.
  const [action, setAction] = useState(searchParams.get('action') ?? '');
  const [resourceId, setResourceId] = useState(searchParams.get('resourceId') ?? '');

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  // Relative day headings stay honest while the page is left open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const filtered = !!q || actorId !== 'all' || resourceType !== 'all' || !!action || !!resourceId;

  const { data: staff = [] } = useQuery({
    queryKey: moduleQueryKeys.identity.key('staff', tenantId),
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: canView && !!tenantId,
  });

  const queryClient = useQueryClient();
  const activity = useInfiniteQuery({
    queryKey: moduleQueryKeys.audit.key('audit-groups', q, actorId, resourceType, action, resourceId, timeZone),
    queryFn: async ({ pageParam }): Promise<AuditGroupsResponse & { approximate?: true }> => {
      const filters = {
        userId: actorId === 'all' ? undefined : actorId,
        resourceType: resourceType === 'all' ? undefined : resourceType,
        action: action || undefined,
        resourceId: resourceId || undefined,
      };
      try {
        return await getAuditGroups({ ...filters, page: pageParam, limit: PAGE_SIZE, tz: timeZone, q: q || undefined });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        // An API from before GET /audit-logs/groups: group each page of raw
        // entries here instead. Search covers only that page, and a record's
        // entries can split across pages — the limits the endpoint removes.
        const entries = await getAuditLogs({ ...filters, page: pageParam, limit: 100 });
        const groups = groupEntriesLocally(
          entries.data.filter((entry) => entryMatches(entry, q)),
          timeZone,
          auditSeverity,
        );
        // That API ignores `?ids=`, so an opened group is served from here.
        for (const group of groups) {
          const own = entries.data.filter((entry) => group.entryIds.includes(entry.id));
          queryClient.setQueryData(moduleQueryKeys.audit.key('audit-group-entries', group.key, group.entryIds.join(',')), {
            ...entries,
            data: own,
          });
        }
        return {
          data: groups,
          total: entries.total,
          page: entries.page,
          limit: entries.limit,
          pages: entries.pages,
          timeZone,
          approximate: true,
        };
      }
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: canView,
    placeholderData: (previous) => previous,
    refetchInterval: LIVE_INTERVAL_MS,
  });

  const groups = useMemo(() => mergeGroupPages(activity.data?.pages ?? []), [activity.data?.pages]);
  const total = activity.data?.pages[0]?.total ?? 0;
  // Counts from the fallback are entries, not groups.
  const approximate = !!activity.data?.pages[0]?.approximate;

  const actorOptions = useMemo<SelectOption[]>(() => {
    const options = staff
      .map((member) => ({ value: member.userId, label: member.name || member.email || member.userId }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (actorId !== 'all' && !options.some((option) => option.value === actorId))
      options.unshift({ value: actorId, label: 'Someone else' });
    return [{ value: 'all', label: 'Everyone' }, ...options];
  }, [actorId, staff]);

  // A shareable URL for the view on screen.
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (actorId !== 'all') params.set('userId', actorId);
    if (resourceType !== 'all') params.set('resourceType', resourceType);
    if (action) params.set('action', action);
    if (resourceId) params.set('resourceId', resourceId);
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', next);
  }, [q, actorId, resourceType, action, resourceId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) setSelected(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!canView) return null;

  function clearFilters() {
    setSearch('');
    setActorId('all');
    setResourceType('all');
    setAction('');
    setResourceId('');
  }

  /** A pivot narrows to one person, action or record — and clears the search so nothing else hides it. */
  function applyPivot(pivot: AuditPivot) {
    if (pivot.kind === 'actor') setActorId(pivot.value);
    if (pivot.kind === 'action') setAction(pivot.value);
    if (pivot.kind === 'resourceId') setResourceId(pivot.value);
    setSearch('');
    setExpandedKey(null);
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-56 flex-1 lg:max-w-sm">
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search the audit log"
          placeholder="Search people, records, details…"
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
        />
      </div>
      <Select value={actorId} onValueChange={setActorId} options={actorOptions} ariaLabel="Who" icon={<User />} className="w-44" />
      <Select value={resourceType} onValueChange={setResourceType} options={RECORD_OPTIONS} ariaLabel="What" className="w-44" />
      {action && <FilterChip label={`Only “${actionFilterLabel(action)}”`} onRemove={() => setAction('')} />}
      {resourceId && <FilterChip label="One record" onRemove={() => setResourceId('')} />}
      {filtered && (
        <button type="button" onClick={clearFilters} className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
          Clear
        </button>
      )}
    </div>
  );

  const body = activity.isPending ? (
    <div>
      <Bone className="mx-1 mb-2 h-4 w-20" />
      <ListSkeleton rows={8} label="Loading activity" />
    </div>
  ) : activity.isError && groups.length === 0 ? (
    <ErrorState title="The audit log could not be loaded" onRetry={() => void activity.refetch()} />
  ) : groups.length === 0 ? (
    <EmptyState
      icon={filtered ? Search : History}
      title={filtered ? 'Nothing matches' : 'No activity yet'}
      description={
        filtered
          ? 'Try another search, or clear the filters.'
          : 'Every change made in this workspace lands here — who did it, what changed, and whether it worked.'
      }
      kind={filtered ? 'search' : 'start'}
      action={filtered ? { label: 'Clear filters', onClick: clearFilters } : undefined}
    />
  ) : (
    <AuditActivityList
      groups={groups}
      now={now}
      selectedId={selected?.id ?? null}
      expandedKey={expandedKey}
      onToggle={(key) => setExpandedKey((current) => (current === key ? null : key))}
      onSelect={(entry) => setSelected((current) => (current?.id === entry.id ? null : entry))}
      hasMore={!!activity.hasNextPage}
      loadingMore={activity.isFetchingNextPage}
      onLoadMore={() => void activity.fetchNextPage()}
      total={approximate ? null : total}
    />
  );

  // No count on the fallback path: it would be raw entries, not what is listed.
  const meta =
    activity.data && !approximate ? (
      <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground" aria-live="polite">
        {activity.isFetching && !activity.isFetchingNextPage && <Loader2 size={12} className="animate-spin" aria-label="Updating" />}
        {total.toLocaleString()} {total === 1 ? 'activity' : 'activities'}
      </span>
    ) : undefined;

  return (
    <EditorShell title="Audit log" icon={<History size={20} aria-hidden="true" />} meta={meta} flush>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
          {toolbar}
          {body}
        </div>

        {wide && selected && (
          <aside aria-label="Entry detail" className="flex w-110 shrink-0 flex-col border-l border-rule bg-band/45 2xl:w-125">
            <AuditInspector
              log={selected}
              activeActorId={actorId}
              activeAction={action}
              activeResourceId={resourceId}
              onPivot={applyPivot}
              onClose={() => setSelected(null)}
              now={now}
            />
          </aside>
        )}
      </div>

      {!wide && selected && (
        <Drawer
          title={`${auditActor(selected)}${auditRole(selected) ? ` (${auditRole(selected)})` : ''} ${auditPhrase(selected)}`}
          description={fullTimestamp(selected.createdAt)}
          onClose={() => setSelected(null)}
          actions={<AuditCopyButton value={JSON.stringify(selected, null, 2)} label="entry as JSON" />}
        >
          <AuditInspector
            log={selected}
            activeActorId={actorId}
            activeAction={action}
            activeResourceId={resourceId}
            onPivot={(pivot) => {
              applyPivot(pivot);
              setSelected(null);
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
      <div className="space-y-5 px-3 py-4 md:px-6 md:py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Bone className="h-9 min-w-56 flex-1 lg:max-w-sm" />
          <Bone className="h-9 w-44" />
          <Bone className="h-9 w-44" />
        </div>
        <div>
          <Bone className="mx-1 mb-2 h-4 w-20" />
          <ListSkeleton rows={8} label="Loading activity" />
        </div>
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
