'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock,
  Fingerprint,
  Globe,
  History,
  Link2,
  Loader2,
  Mail,
  Monitor,
  Route,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  User,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Popover } from 'radix-ui';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';

import { type AuditLog, getAuditLogs, parseAuditMeta } from '@/lib/api/audit.service';
import { getStaff, roleAtLeast } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  franchise_owner: 'Franchise Owner',
  store_manager: 'Store Manager',
  barista: 'Barista',
  hr_manager: 'HR Manager',
  marketing_manager: 'Marketing',
  auditor: 'Auditor',
};

function fmtDuration(ms?: number | null) {
  if (ms == null) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function statusColor(code?: number | null) {
  if (code == null) return 'bg-muted text-muted-foreground';
  if (code < 300) return 'bg-success/10 text-success';
  if (code < 400) return 'bg-primary/10 text-primary';
  if (code < 500) return 'bg-warning/10 text-warning';
  return 'bg-destructive/10 text-destructive';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function actionColor(action: string) {
  if (/delete|remove/i.test(action)) return 'text-destructive bg-destructive/10 border-destructive/20';
  if (/create|add/i.test(action)) return 'text-success bg-success/10 border-success/20';
  if (/update|patch|edit/i.test(action)) return 'text-primary bg-primary/10 border-primary/20';
  if (/transfer|receive|adjust/i.test(action)) return 'text-warning bg-warning/10 border-warning/20';
  return 'text-muted-foreground bg-muted border-border';
}

function humanise(str: string) {
  return str.replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Detail panel (details + metadata) ──────────────────────────────────────────

function AuditDetailPanel({ log }: { log: AuditLog }) {
  const meta = parseAuditMeta(log.metadata);
  const response = parseAuditMeta(log.response);
  const duration = fmtDuration(log.durationMs);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
      {/* Details */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Details</p>
        <InfoGroup>
          <InfoRow icon={User} label="Actor" value={log.userName ?? 'System / anonymous'} />
          {log.userRole && <InfoRow icon={Shield} label="Role" value={ROLE_LABEL[log.userRole] ?? log.userRole} />}
          {log.userEmail && <InfoRow icon={Mail} label="Email" value={log.userEmail} copyable />}
          {log.method && <InfoRow icon={Route} label="Method" value={log.method} />}
          {log.path && <InfoRow icon={Link2} label="Path" value={log.path} copyable />}
          {log.statusCode != null && <InfoRow icon={ShieldCheck} label="Status" value={String(log.statusCode)} />}
          {duration && <InfoRow icon={Timer} label="Duration" value={duration} />}
          {log.tenantId && <InfoRow icon={Building2} label="Tenant" value={log.tenantId} copyable />}
          {log.resourceId && <InfoRow icon={Link2} label="Resource ID" value={log.resourceId} copyable />}
          {log.ipAddress && <InfoRow icon={Globe} label="IP address" value={log.ipAddress} copyable />}
          {log.requestId && <InfoRow icon={Fingerprint} label="Request ID" value={log.requestId} copyable />}
          {log.userAgent && <InfoRow icon={Monitor} label="User agent" value={log.userAgent} />}
        </InfoGroup>
      </div>

      {/* Metadata + response */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Metadata</p>
        {meta ? (
          <pre className="text-xs text-muted-foreground bg-background border border-border rounded-xl px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(meta, null, 2)}
          </pre>
        ) : (
          <p className="text-[11px] text-muted-foreground">No metadata.</p>
        )}

        {response && (
          <>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Response</p>
            <pre className="text-xs text-muted-foreground bg-background border border-border rounded-xl px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(response, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const duration = fmtDuration(log.durationMs);

  return (
    <>
      <tr
        className="group border-b border-border/50 transition-colors align-top cursor-pointer hover:bg-surface-offset"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-3 md:px-5 py-4 w-6 align-top">
          <ChevronDown
            size={14}
            className={cn('text-muted-foreground transition-transform duration-150 mt-0.5', open && 'rotate-180')}
            aria-hidden="true"
          />
        </td>
        <td className="px-3 md:px-5 py-4 w-40 align-top">
          <span
            className={cn(
              'inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md border whitespace-nowrap',
              actionColor(log.action),
            )}
          >
            {humanise(log.action)}
          </span>
        </td>
        <td className="px-3 md:px-5 py-4 align-top">
          <p className="text-sm font-medium text-foreground leading-snug">{humanise(log.resourceType)}</p>
          {(log.method || log.path) && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5 opacity-70 truncate max-w-md">
              {log.method && <span className="font-semibold">{log.method}</span>} {log.path}
            </p>
          )}
        </td>
        <td className="hidden lg:table-cell px-5 py-4 w-48 align-top">
          {log.userName || log.userEmail ? (
            <>
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-foreground leading-snug truncate max-w-36">{log.userName ?? '—'}</p>
                {log.userRole && (
                  <span className="text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {ROLE_LABEL[log.userRole] ?? log.userRole}
                  </span>
                )}
              </div>
              {log.userEmail && <p className="text-xs text-muted-foreground truncate max-w-44 mt-0.5">{log.userEmail}</p>}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">System / anonymous</span>
          )}
        </td>
        <td className="hidden md:table-cell px-5 py-4 pr-6 w-44 align-top">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
            <Clock size={11} aria-hidden="true" className="shrink-0" />
            {formatDate(log.createdAt)}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            {log.statusCode != null && (
              <span className={cn('text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md', statusColor(log.statusCode))}>
                {log.statusCode}
              </span>
            )}
            {duration && <span className="text-[11px] text-muted-foreground tabular-nums">{duration}</span>}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border/50 bg-surface-offset/50">
          <td colSpan={5} className="px-4 md:px-8 pt-3 pb-5">
            <AuditDetailPanel log={log} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const LIMIT = 50;

type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom';

const ACTION_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All actions' },
  { value: 'order.create', label: 'Order created' },
  { value: 'order.status_update', label: 'Order status updated' },
  { value: 'order.cancel', label: 'Order cancelled' },
  { value: 'staff.create', label: 'Staff created' },
  { value: 'staff.update', label: 'Staff updated' },
  { value: 'stock.adjust', label: 'Stock adjusted' },
  { value: 'stock.transfer', label: 'Stock transferred' },
  { value: 'stock.bulk_update', label: 'Stock bulk updated' },
  { value: 'data.export', label: 'Data exported' },
  { value: 'tenant.delete', label: 'Tenant deleted' },
  { value: 'location.delete', label: 'Location deleted' },
  { value: 'hr.leave_approved', label: 'Leave approved' },
  { value: 'hr.leave_declined', label: 'Leave declined' },
  { value: 'hr.expense_approved', label: 'Expense approved' },
  { value: 'hr.expense_declined', label: 'Expense declined' },
  { value: 'hr.payslip_finalised', label: 'Payslip finalised' },
];

const RESOURCE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All resources' },
  { value: 'order', label: 'Orders' },
  { value: 'staff', label: 'Staff' },
  { value: 'stock', label: 'Stock' },
  { value: 'tenant', label: 'Tenants' },
  { value: 'location', label: 'Locations' },
  { value: 'leave_request', label: 'Leave requests' },
  { value: 'expense_claim', label: 'Expense claims' },
  { value: 'payslip', label: 'Payslips' },
];

const DATE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

function optionLabel(options: SelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? humanise(value);
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

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 pl-2.5 pr-1.5 text-xs font-medium text-primary">
      <span className="max-w-52 truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="flex size-5 items-center justify-center rounded-full hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <X size={11} aria-hidden="true" />
      </button>
    </span>
  );
}

function AuditLogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Same gate as the header's audit drawer — franchise_owner and above only.
  const role = useAuthStore((s) => s.role);
  const canView = roleAtLeast(role, 'franchise_owner');
  useEffect(() => {
    if (role && !canView) router.replace('/dashboard');
  }, [role, canView, router]);

  const tenantId = useWorkspaceStore((s) => s.tenantId);
  const initialFrom = searchParams.get('from') ?? '';
  const initialTo = searchParams.get('to') ?? '';
  const requestedPreset = searchParams.get('range') as DatePreset | null;
  const validPreset = requestedPreset && DATE_OPTIONS.some((option) => option.value === requestedPreset) ? requestedPreset : null;

  const [page, setPage] = useState(() => initialPage(searchParams.get('page')));
  const [action, setAction] = useState(searchParams.get('action') ?? 'all');
  const [resourceType, setResourceType] = useState(searchParams.get('resourceType') ?? 'all');
  const [actorId, setActorId] = useState(searchParams.get('userId') ?? 'all');
  const [resourceSearch, setResourceSearch] = useState(searchParams.get('resourceId') ?? '');
  const [debouncedResourceId, setDebouncedResourceId] = useState(resourceSearch);
  const [datePreset, setDatePreset] = useState<DatePreset>(validPreset ?? (initialFrom || initialTo ? 'custom' : 'all'));
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedResourceId(resourceSearch.trim()), resourceSearch ? 400 : 0);
    return () => window.clearTimeout(timeout);
  }, [resourceSearch]);

  const invalidDateRange = Boolean(from && to && from > to);
  const hasFilters =
    action !== 'all' || resourceType !== 'all' || actorId !== 'all' || !!debouncedResourceId || datePreset !== 'all' || !!from || !!to;
  const advancedFilterCount = Number(actorId !== 'all') + Number(datePreset === 'custom' && (!!from || !!to));

  const { data: staff = [] } = useQuery({
    queryKey: ['staff', tenantId],
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: canView && !!tenantId,
  });

  const actorOptions = useMemo<SelectOption[]>(() => {
    const options = staff
      .map((member) => ({ value: member.userId, label: member.name || member.email || member.userId }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (actorId !== 'all' && !options.some((option) => option.value === actorId)) {
      options.unshift({ value: actorId, label: actorId });
    }
    return [{ value: 'all', label: 'All actors' }, ...options];
  }, [actorId, staff]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['audit-logs', page, action, resourceType, actorId, debouncedResourceId, from, to],
    queryFn: () =>
      getAuditLogs({
        page,
        limit: LIMIT,
        action: action === 'all' ? undefined : action,
        resourceType: resourceType === 'all' ? undefined : resourceType,
        userId: actorId === 'all' ? undefined : actorId,
        resourceId: debouncedResourceId || undefined,
        from: from ? startOfLocalDay(from) : undefined,
        to: to ? endOfLocalDay(to) : undefined,
      }),
    enabled: canView && !invalidDateRange,
    placeholderData: (previousData) => previousData,
  });

  const logs = useMemo(() => data?.data ?? [], [data?.data]);
  const totalPages = data?.pages ?? 1;

  const actionOptions = useMemo(() => {
    const discovered = logs
      .map((log) => log.action)
      .filter((value, index, values) => values.indexOf(value) === index)
      .filter((value) => !ACTION_OPTIONS.some((option) => option.value === value))
      .map((value) => ({ value, label: humanise(value) }));
    return [...ACTION_OPTIONS, ...discovered];
  }, [logs]);

  const resourceOptions = useMemo(() => {
    const discovered = logs
      .map((log) => log.resourceType)
      .filter((value, index, values) => values.indexOf(value) === index)
      .filter((value) => !RESOURCE_OPTIONS.some((option) => option.value === value))
      .map((value) => ({ value, label: humanise(value) }));
    if (
      resourceType !== 'all' &&
      !RESOURCE_OPTIONS.some((option) => option.value === resourceType) &&
      !discovered.some((option) => option.value === resourceType)
    ) {
      discovered.unshift({ value: resourceType, label: humanise(resourceType) });
    }
    return [...RESOURCE_OPTIONS, ...discovered];
  }, [logs, resourceType]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    ['page', 'action', 'resourceType', 'userId', 'resourceId', 'range', 'from', 'to'].forEach((key) => params.delete(key));
    if (page > 1) params.set('page', String(page));
    if (action !== 'all') params.set('action', action);
    if (resourceType !== 'all') params.set('resourceType', resourceType);
    if (actorId !== 'all') params.set('userId', actorId);
    if (debouncedResourceId) params.set('resourceId', debouncedResourceId);
    if (datePreset !== 'all') params.set('range', datePreset);
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState(null, '', nextUrl);
  }, [action, actorId, datePreset, debouncedResourceId, from, page, resourceType, to]);

  function resetPage() {
    setPage(1);
  }

  function changeDatePreset(value: string) {
    const next = value as DatePreset;
    setDatePreset(next);
    resetPage();
    if (next === 'all') {
      setFrom('');
      setTo('');
    } else if (next === 'custom') {
      window.setTimeout(() => setAdvancedOpen(true), 0);
    } else {
      const dates = datesForPreset(next);
      setFrom(dates.from);
      setTo(dates.to);
    }
  }

  function clearFilters() {
    setAction('all');
    setResourceType('all');
    setActorId('all');
    setResourceSearch('');
    setDebouncedResourceId('');
    setDatePreset('all');
    setFrom('');
    setTo('');
    setPage(1);
  }

  const filterBar = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1 lg:max-w-sm">
          <Input
            type="search"
            value={resourceSearch}
            onChange={(event) => {
              setResourceSearch(event.target.value);
              resetPage();
            }}
            aria-label="Find by resource ID"
            placeholder="Find by resource ID…"
            leftIcon={<Search size={14} />}
            rightAction={
              resourceSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setResourceSearch('');
                    setDebouncedResourceId('');
                    resetPage();
                  }}
                  aria-label="Clear resource ID search"
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              ) : undefined
            }
            className="bg-background border-border"
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
          value={resourceType}
          onValueChange={(value) => {
            setResourceType(value);
            resetPage();
          }}
          options={resourceOptions}
          ariaLabel="Filter by resource type"
          className="w-[calc(50%-0.25rem)] sm:w-44"
        />
        <Select
          value={datePreset}
          onValueChange={changeDatePreset}
          options={DATE_OPTIONS}
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
                <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
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
              className="z-[90] w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">More filters</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Narrow results by actor or an exact date range.</p>
                </div>
                <Popover.Close asChild>
                  <button
                    type="button"
                    aria-label="Close filters"
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </Popover.Close>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actor</label>
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Custom dates</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={from}
                      onChange={(event) => {
                        setFrom(event.target.value);
                        setDatePreset('custom');
                        resetPage();
                      }}
                      aria-label="Audit logs from date"
                      className="bg-background border-border px-2"
                    />
                    <Input
                      type="date"
                      value={to}
                      onChange={(event) => {
                        setTo(event.target.value);
                        setDatePreset('custom');
                        resetPage();
                      }}
                      aria-label="Audit logs to date"
                      className="bg-background border-border px-2"
                    />
                  </div>
                  {invalidDateRange && (
                    <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle size={12} aria-hidden="true" /> The end date must be on or after the start date.
                    </p>
                  )}
                </div>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <span
          className="ml-auto flex min-w-24 items-center justify-end gap-1.5 text-xs text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {isFetching && !isLoading && <Loader2 size={12} className="animate-spin" aria-label="Updating results" />}
          {data ? `${data.total.toLocaleString()} entries` : ''}
        </span>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
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
              label={`Resource: ${optionLabel(resourceOptions, resourceType)}`}
              onRemove={() => {
                setResourceType('all');
                resetPage();
              }}
            />
          )}
          {actorId !== 'all' && (
            <FilterChip
              label={`Actor: ${optionLabel(actorOptions, actorId)}`}
              onRemove={() => {
                setActorId('all');
                resetPage();
              }}
            />
          )}
          {debouncedResourceId && (
            <FilterChip
              label={`ID: ${debouncedResourceId}`}
              onRemove={() => {
                setResourceSearch('');
                setDebouncedResourceId('');
                resetPage();
              }}
            />
          )}
          {datePreset !== 'all' && (
            <FilterChip
              label={datePreset === 'custom' ? `Date: ${from || 'Any'} – ${to || 'Any'}` : `Date: ${optionLabel(DATE_OPTIONS, datePreset)}`}
              onRemove={() => {
                setDatePreset('all');
                setFrom('');
                setTo('');
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
        </div>
      )}
    </div>
  );

  if (!canView) return null;

  return (
    <PageLayout eyebrow="System" title="Audit Log" headerSlot={filterBar} headerBorder fullHeight>
      <div className="h-full flex flex-col">
        {/* Audit table */}
        <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted">
                  <th className="px-3 md:px-5 py-3.5 w-6" />
                  <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-40">
                    Action
                  </th>
                  <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Resource
                  </th>
                  <th className="hidden lg:table-cell px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-48">
                    User
                  </th>
                  <th className="hidden md:table-cell px-5 py-3.5 pr-6 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest w-44">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {invalidDateRange ? (
                  <tr>
                    <td colSpan={5} className="py-24">
                      <EmptyState
                        icon={CalendarDays}
                        title="Check the date range"
                        description="The end date must be on or after the start date."
                      />
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={5} className="py-24">
                      <div className="flex flex-col items-center gap-3 px-6 text-center">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                          <AlertCircle size={22} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Couldn’t load audit logs</p>
                          <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                          Try again
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td
                          key={j}
                          className={cn('px-3 md:px-5 py-4', j === 3 && 'hidden lg:table-cell', j === 4 && 'hidden md:table-cell')}
                        >
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${45 + ((i * 13 + j * 17) % 40)}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-24">
                      <EmptyState
                        icon={History}
                        title="No audit logs found"
                        description={hasFilters ? 'Try adjusting your filters.' : 'Actions performed in the system will appear here.'}
                      />
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => <LogRow key={log.id} log={log} />)
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
              <p className="text-xs text-muted-foreground tabular-nums">
                Page {page} of {totalPages} · {(data?.total ?? 0).toLocaleString()} entries
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 px-3 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-surface-offset transition-colors disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 px-3 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-surface-offset transition-colors disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

function AuditLogPageFallback() {
  return (
    <PageLayout eyebrow="System" title="Audit Log" headerBorder fullHeight>
      <div className="h-full rounded-2xl border border-border bg-card p-5">
        <div className="h-9 w-full max-w-2xl animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-lg bg-muted/70" />
          ))}
        </div>
      </div>
    </PageLayout>
  );
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<AuditLogPageFallback />}>
      <AuditLogPageContent />
    </Suspense>
  );
}
