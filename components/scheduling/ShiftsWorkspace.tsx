'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { BarChart3, CalendarClock, CalendarRange, ChevronLeft, ChevronRight, MapPin, Search, Send, X } from '@/components/icons';
import { Avatar, canSeeMoney, fmtMoney } from '@/components/people/shared';
import { CoveragePanel } from '@/components/scheduling/CoveragePanel';
import { type ShiftDrawerTarget, ShiftRecordDrawer, hourlyRateOf, unpaidBreakFor } from '@/components/scheduling/ShiftRecordDrawer';
import {
  type ShiftRecord,
  WORK_STATE,
  type WorkState,
  dayKey,
  fmtDuration,
  fmtHours,
  fmtTime,
  mondayOf,
  rangeDays,
  rangeLabel,
  shiftMinutes,
  staffLabel,
  toDateInput,
  workStateOf,
} from '@/components/scheduling/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { getEmployees } from '@/lib/api/hr.service';
import { getPayrollRuns } from '@/lib/api/payroll.service';
import { getScheduledShifts, getVariance, publishScheduledShifts } from '@/lib/api/scheduling.service';
import { type Shift, getActiveShifts, getShifts } from '@/lib/api/shifts.service';
import { getStaff, roleAtLeast } from '@/lib/api/staff.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const PAGE_SIZE = 12;

type SortKey = 'date_desc' | 'date_asc' | 'staff' | 'hours_desc' | 'cost_desc';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'staff', label: 'Staff A–Z' },
  { value: 'hours_desc', label: 'Longest hours' },
  { value: 'cost_desc', label: 'Highest cost' },
];

const PRESETS = ['this_week', 'last_week', 'next_week', 'this_month', 'last_30'] as const;
type RangePreset = (typeof PRESETS)[number];

const PRESET_LABEL: Record<RangePreset, string> = {
  this_week: 'This week',
  last_week: 'Last week',
  next_week: 'Next week',
  this_month: 'This month',
  last_30: 'Last 30 days',
};

const RANGE_PRESETS = [...PRESETS.map((value) => ({ value, label: PRESET_LABEL[value] })), { value: 'custom', label: 'Custom range…' }];

const matchesPreset = (preset: RangePreset, from: string, to: string) => {
  const range = presetRange(preset);
  return range.from === from && range.to === to;
};

/** Inclusive from/to for a named range, as the YYYY-MM-DD the date inputs use. */
function presetRange(preset: RangePreset): { from: string; to: string } {
  const today = new Date();
  if (preset === 'this_month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: toDateInput(first), to: toDateInput(last) };
  }
  if (preset === 'last_30') {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { from: toDateInput(start), to: toDateInput(today) };
  }
  const monday = mondayOf(today);
  if (preset === 'last_week') monday.setDate(monday.getDate() - 7);
  if (preset === 'next_week') monday.setDate(monday.getDate() + 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toDateInput(monday), to: toDateInput(sunday) };
}

const STATE_FILTERS: { value: 'all' | WorkState; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'no_show', label: 'No show' },
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * The single staff shift register: the rota (what was planned) and the time
 * clock (what was actually worked) as one row per person per day. Clicking a
 * row opens the record drawer, which is also where new records are created.
 */
export function ShiftsWorkspace({
  creating = false,
  onCreatingChange,
}: {
  creating?: boolean;
  onCreatingChange?: (open: boolean) => void;
}) {
  const { tenantId, locationId } = useWorkspaceStore();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const money = canSeeMoney(role);
  // Running the clock for someone else is store_manager+ on the API — hr_manager
  // out-ranks nobody here, so check the rank rather than team access.
  const canClock = roleAtLeast(role, 'store_manager');

  // Only the row's identity is held — the record itself is re-read from the
  // live rows below, so clocking in or out updates the open drawer in place.
  const [openRow, setOpenRow] = useState<{ mode: 'create' | 'edit'; id: string; date: string } | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('date_desc');
  const [stateFilter, setStateFilter] = useState<'all' | WorkState>('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [page, setPage] = useState(1);

  function closeDrawer() {
    setOpenRow(null);
    onCreatingChange?.(false);
  }

  // Ticks so a running shift's elapsed time stays honest.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Range ───────────────────────────────────────────────────────────────────

  const week = useMemo(() => presetRange('this_week'), []);
  const [from, setFrom] = useState(week.from);
  const [to, setTo] = useState(week.to);
  const [customRange, setCustomRange] = useState(false);
  const fromISO = useMemo(() => new Date(`${from}T00:00:00`).toISOString(), [from]);
  const toISO = useMemo(() => new Date(`${to}T23:59:59`).toISOString(), [to]);

  const isThisWeek = from === week.from && to === week.to;
  // A hand-picked range shows as "Custom", as does any range the arrows land on
  // that no preset describes.
  const activePreset = useMemo(
    () => (customRange ? 'custom' : (PRESETS.find((preset) => matchesPreset(preset, from, to)) ?? 'custom')),
    [customRange, from, to],
  );
  // Arrows step by whatever the range spans, so a month pages by a month.
  function stepRange(direction: 1 | -1) {
    const span = rangeDays(from, to) * direction;
    const f = new Date(`${from}T00:00:00`);
    const t = new Date(`${to}T00:00:00`);
    f.setDate(f.getDate() + span);
    t.setDate(t.getDate() + span);
    setFrom(toDateInput(f));
    setTo(toDateInput(t));
  }

  function applyPreset(value: string) {
    if (value === 'custom') {
      setCustomRange(true);
      return;
    }
    const range = presetRange(value as RangePreset);
    setCustomRange(false);
    setFrom(range.from);
    setTo(range.to);
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: staff = [] } = useQuery({
    queryKey: ['staff', tenantId],
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees', tenantId],
    queryFn: getEmployees,
    enabled: !!tenantId,
  });
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['scheduled-shifts', locationId, fromISO, toISO],
    queryFn: () => getScheduledShifts({ locationId: locationId!, from: fromISO, to: toISO }),
    enabled: !!locationId,
  });
  // Planned-vs-actual, joined into each row by scheduledShiftId.
  const { data: variance = [] } = useQuery({
    queryKey: ['variance', locationId, fromISO, toISO],
    queryFn: () => getVariance({ locationId: locationId ?? undefined, from: fromISO, to: toISO }),
    enabled: !!locationId,
  });
  const { data: active = [] } = useQuery({ queryKey: ['shifts-active'], queryFn: getActiveShifts, refetchInterval: 60_000 });
  // Exact clock in/out times. store_manager+ on the API — a 403 (hr_manager)
  // just means rows fall back to the variance summary, so keep it quiet.
  const { data: clockRecords = [] } = useQuery({
    queryKey: ['shifts', locationId],
    queryFn: () => getShifts({ locationId: locationId ?? undefined }),
    meta: { silentError: true },
  });
  // Which days are already through payroll.
  const { data: payrollRuns = [] } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: getPayrollRuns,
    enabled: money,
    meta: { silentError: true },
  });

  const employeesByUser = useMemo(() => new Map(employees.map((e) => [e.userId, e])), [employees]);
  const staffById = useMemo(() => new Map(staff.map((member) => [member.userId, member])), [staff]);
  const varianceMap = useMemo(() => new Map(variance.map((v) => [v.scheduledShiftId, v])), [variance]);
  const locationById = useMemo(() => new Map(locations.map((location) => [location.id, location.name])), [locations]);

  /** Every clock record in the visible range, live ones included, newest last. */
  const clockedInRange = useMemo(() => {
    const byId = new Map<string, Shift>();
    for (const entry of [...clockRecords, ...active]) {
      const at = new Date(entry.clockedIn).getTime();
      if (at < new Date(fromISO).getTime() || at > new Date(toISO).getTime()) continue;
      if (locationId && entry.locationId !== locationId) continue;
      byId.set(entry.id, entry);
    }
    return [...byId.values()].sort((a, b) => a.clockedIn.localeCompare(b.clockedIn));
  }, [clockRecords, active, fromISO, toISO, locationId]);

  const paidDays = useMemo(() => {
    const set = new Set<string>();
    for (const run of payrollRuns) {
      if (run.status !== 'finalised') continue;
      for (const line of run.lines ?? []) set.add(`${line.userId}|${run.periodStart.slice(0, 10)}|${run.periodEnd.slice(0, 10)}`);
    }
    return set;
  }, [payrollRuns]);

  const isPaid = useMemo(
    () => (userId: string | null, day: string) =>
      !!userId &&
      [...paidDays].some((key) => {
        const [id, start, end] = key.split('|');
        return id === userId && day >= start && day <= end;
      }),
    [paidDays],
  );

  // ── Rows ────────────────────────────────────────────────────────────────────

  const records = useMemo<ShiftRecord[]>(() => {
    const used = new Set<string>();
    const rows: ShiftRecord[] = [];

    const build = (base: Omit<ShiftRecord, 'paidMinutes' | 'estimatedCost' | 'billState' | 'hourlyRate' | 'unpaidBreakMinutes'>) => {
      const employee = base.userId ? employeesByUser.get(base.userId) : undefined;
      const unpaidBreakMinutes = unpaidBreakFor(employee, base.plannedMinutes || base.workedMinutes);
      // Payroll pays the clocked time, capped at what was scheduled, less the break.
      const capped = base.plannedMinutes > 0 ? Math.min(base.workedMinutes, base.plannedMinutes) : base.workedMinutes;
      const paidMinutes = Math.max(0, (base.workedMinutes > 0 ? capped : base.plannedMinutes) - unpaidBreakMinutes);
      const hourlyRate = hourlyRateOf(employee);
      const estimatedCost = hourlyRate != null ? (hourlyRate * paidMinutes) / 60 : null;
      rows.push({
        ...base,
        unpaidBreakMinutes,
        paidMinutes,
        hourlyRate,
        estimatedCost,
        billState: estimatedCost == null ? 'none' : isPaid(base.userId, base.dateKey) ? 'paid' : 'pending',
      });
    };

    for (const shift of shifts) {
      const day = dayKey(shift.startsAt);
      const clocked = clockedInRange.filter(
        (entry) =>
          entry.scheduledShiftId === shift.id || (!!shift.userId && entry.userId === shift.userId && dayKey(entry.clockedIn) === day),
      );
      for (const entry of clocked) used.add(entry.id);
      const v = varianceMap.get(shift.id);
      const clockedMinutes = clocked.reduce(
        (sum, entry) =>
          sum +
          (entry.clockedOut
            ? (entry.durationMinutes ?? shiftMinutes({ startsAt: entry.clockedIn, endsAt: entry.clockedOut }))
            : Math.max(0, (now - new Date(entry.clockedIn).getTime()) / 60000)),
        0,
      );
      const profile = shift.userId ? staffById.get(shift.userId) : undefined;
      build({
        id: shift.id,
        dateKey: day,
        at: shift.startsAt,
        userId: shift.userId ?? null,
        staffName: shift.userId ? staffLabel(profile, shift.staff?.user?.name) : 'Open slot',
        staffEmail: profile?.email ?? shift.staff?.user?.email,
        locationId: shift.locationId,
        locationName: shift.location?.name ?? locationById.get(shift.locationId),
        role: shift.role,
        notes: shift.notes,
        status: shift.status,
        shift,
        clocked,
        plannedMinutes: shiftMinutes(shift),
        workedMinutes: v?.workedMinutes ?? clockedMinutes,
        startDeltaMinutes: v?.startDeltaMinutes ?? null,
        state: workStateOf(shift, v, clocked, now),
      });
    }

    // Attendance with no rota entry — grouped one row per person per day.
    const unplanned = new Map<string, Shift[]>();
    for (const entry of clockedInRange) {
      if (used.has(entry.id)) continue;
      const key = `${entry.userId}|${dayKey(entry.clockedIn)}`;
      unplanned.set(key, [...(unplanned.get(key) ?? []), entry]);
    }
    for (const [key, entries] of unplanned) {
      const [userId, day] = key.split('|');
      const profile = staffById.get(userId);
      const worked = entries.reduce(
        (sum, entry) =>
          sum +
          (entry.clockedOut
            ? (entry.durationMinutes ?? shiftMinutes({ startsAt: entry.clockedIn, endsAt: entry.clockedOut }))
            : Math.max(0, (now - new Date(entry.clockedIn).getTime()) / 60000)),
        0,
      );
      build({
        id: `unplanned-${key}`,
        dateKey: day,
        at: entries[0].clockedIn,
        userId,
        staffName: staffLabel(profile, entries[0].staff?.user?.name ?? entries[0].staff?.name),
        staffEmail: profile?.email,
        locationId: entries[0].locationId,
        locationName: entries[0].location?.name ?? locationById.get(entries[0].locationId),
        status: null,
        shift: null,
        clocked: entries,
        plannedMinutes: 0,
        workedMinutes: worked,
        startDeltaMinutes: null,
        state: entries.some((entry) => !entry.clockedOut) ? 'running' : 'completed',
      });
    }

    return rows;
  }, [shifts, clockedInRange, varianceMap, staffById, employeesByUser, locationById, isPaid, now]);

  // "Create a new record" lives in the page header, so creating is a controlled
  // prop — an open row wins over it. Re-reading the row from `records` on every
  // render is what keeps the drawer live while its clock is running.
  const drawer = useMemo<ShiftDrawerTarget | null>(() => {
    if (openRow) {
      const record = records.find((row) => row.id === openRow.id);
      // An edit whose row has gone (deleted elsewhere) has nothing left to show.
      if (!record && openRow.mode === 'edit') return null;
      return { mode: openRow.mode, record, date: openRow.date };
    }
    return creating ? { mode: 'create' } : null;
  }, [openRow, records, creating]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = records.filter((record) => {
      if (stateFilter !== 'all' && record.state !== stateFilter) return false;
      if (staffFilter !== 'all' && record.userId !== staffFilter) return false;
      if (
        q &&
        !`${record.staffName} ${record.staffEmail ?? ''} ${record.role ?? ''} ${record.locationName ?? ''}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
    const byName = (a: ShiftRecord, b: ShiftRecord) => a.staffName.localeCompare(b.staffName);
    return rows.sort((a, b) => {
      switch (sort) {
        case 'date_asc':
          return a.at.localeCompare(b.at) || byName(a, b);
        case 'staff':
          return byName(a, b) || a.at.localeCompare(b.at);
        case 'hours_desc':
          return b.workedMinutes - a.workedMinutes || byName(a, b);
        case 'cost_desc':
          return (b.estimatedCost ?? 0) - (a.estimatedCost ?? 0) || byName(a, b);
        default:
          return b.at.localeCompare(a.at) || byName(a, b);
      }
    });
  }, [records, search, sort, stateFilter, staffFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Narrowing the results can strand you past the last page — clamp rather than
  // reset, so paging forward through an unchanged list stays put.
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const draftCount = shifts.filter((s) => s.status === 'draft').length;
  const publish = useMutation({
    mutationFn: () => publishScheduledShifts({ locationId: locationId!, from: fromISO, to: toISO }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-shifts'] }),
  });

  const filtersActive = !!search || stateFilter !== 'all' || staffFilter !== 'all';
  const plannedTotal = filtered.reduce((sum, r) => sum + r.plannedMinutes, 0);
  const workedTotal = filtered.reduce((sum, r) => sum + r.workedMinutes, 0);
  const costTotal = filtered.reduce((sum, r) => sum + (r.estimatedCost ?? 0), 0);

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: DataTableColumn<ShiftRecord>[] = [
    {
      id: 'staff',
      header: 'Staff member',
      minWidth: 200,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.staffName} email={row.staffEmail} />
          <div className="min-w-0">
            <p
              className={cn(
                'truncate text-sm font-semibold',
                row.userId ? 'text-primary underline-offset-4' : 'italic text-muted-foreground',
              )}
            >
              {row.staffName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.role ?? row.staffEmail ?? '—'}
              {!row.shift && ' · unplanned'}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      width: 'fit',
      wrap: 'nowrap',
      cell: ({ row }) => (
        <div>
          <p className="text-sm text-foreground">{formatDate(row.at)}</p>
          <p className="text-xs text-muted-foreground">{new Date(row.at).toLocaleDateString('en-GB', { weekday: 'long' })}</p>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      visibility: 'xl',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.locationName ?? '—'}</span>,
    },
    {
      id: 'planned',
      header: 'Shift (time)',
      visibility: 'md',
      wrap: 'nowrap',
      cell: ({ row }) =>
        row.shift ? (
          <span className="flex items-center gap-2">
            <span className="text-sm tabular-nums text-foreground">
              {fmtTime(row.shift.startsAt)} – {fmtTime(row.shift.endsAt)}
            </span>
            <Badge variant="primary" className="tabular-nums">
              {fmtHours(row.plannedMinutes)}
            </Badge>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">Not on the rota</span>
        ),
    },
    {
      id: 'clocked',
      header: 'Clocked',
      visibility: 'lg',
      wrap: 'nowrap',
      cell: ({ row }) => {
        if (row.clocked.length === 0) return <span className="text-xs text-muted-foreground/60">—</span>;
        const first = row.clocked[0];
        const last = row.clocked.at(-1)!;
        return (
          <span className="text-sm tabular-nums text-foreground">
            {fmtTime(first.clockedIn)} –{' '}
            {last.clockedOut ? fmtTime(last.clockedOut) : <span className="font-semibold text-success">now</span>}
          </span>
        );
      },
    },
    {
      id: 'hours',
      header: 'Total hour(s)',
      width: 'fit',
      wrap: 'nowrap',
      cell: ({ row }) =>
        row.workedMinutes > 0 ? (
          <div>
            <p className="text-sm tabular-nums text-foreground">{fmtDuration(row.workedMinutes)}</p>
            {row.startDeltaMinutes != null && row.startDeltaMinutes !== 0 && (
              <p className={cn('text-xs tabular-nums', row.startDeltaMinutes > 0 ? 'text-destructive' : 'text-success')}>
                {row.startDeltaMinutes > 0 ? `${row.startDeltaMinutes} min late` : `${-row.startDeltaMinutes} min early`}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        ),
    },
    {
      id: 'state',
      header: 'Task status',
      width: 'fit',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          <Badge variant={WORK_STATE[row.state].variant}>{WORK_STATE[row.state].label}</Badge>
          {row.status === 'draft' && <Badge variant="muted">Draft</Badge>}
        </span>
      ),
    },
    ...(money
      ? ([
          {
            id: 'bill',
            header: 'Estimated bill',
            visibility: 'xl' as const,
            wrap: 'nowrap' as const,
            cell: ({ row }: { row: ShiftRecord }) =>
              row.estimatedCost == null ? (
                <span className="text-xs text-muted-foreground/60">—</span>
              ) : (
                <span className="text-sm tabular-nums text-foreground">
                  {(row.paidMinutes / 60).toFixed(1)} hrs × {fmtMoney(row.hourlyRate)}/h ={' '}
                  <span className="font-semibold">{fmtMoney(row.estimatedCost)}</span>
                </span>
              ),
          },
          {
            id: 'billState',
            header: 'Bill status',
            width: 'fit' as const,
            cell: ({ row }: { row: ShiftRecord }) =>
              row.billState === 'none' ? (
                <span className="text-xs text-muted-foreground/60">—</span>
              ) : (
                <Badge variant={row.billState === 'paid' ? 'success' : 'warning'}>{row.billState === 'paid' ? 'Paid' : 'Pending'}</Badge>
              ),
          },
        ] satisfies DataTableColumn<ShiftRecord>[])
      : []),
    {
      id: 'open',
      header: '',
      width: 'fit',
      align: 'right',
      cell: () => <ChevronRight size={15} className="text-muted-foreground/50 transition-colors group-hover:text-foreground" />,
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Range + page-level actions */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Stepper and range read as one control: arrows page by the span. */}
        <div className="flex h-9 items-stretch overflow-hidden rounded-lg border border-border bg-background">
          <button
            type="button"
            onClick={() => stepRange(-1)}
            aria-label="Previous period"
            className="grid w-9 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="grid min-w-44 place-items-center border-x border-border px-3 text-sm font-semibold tabular-nums text-foreground">
            {rangeLabel(from, to)}
          </span>
          <button
            type="button"
            onClick={() => stepRange(1)}
            aria-label="Next period"
            className="grid w-9 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <Select
          value={activePreset}
          onValueChange={applyPreset}
          options={RANGE_PRESETS}
          ariaLabel="Date range"
          icon={<CalendarRange size={14} />}
          className="w-44"
        />

        {/* Only worth showing once you've stepped away from the default view. */}
        {!isThisWeek && (
          <Button variant="ghost" size="sm" onClick={() => applyPreset('this_week')}>
            This week
          </Button>
        )}

        {customRange && (
          <div className="flex items-center gap-2">
            <DatePicker value={from} max={to} onValueChange={setFrom} aria-label="Range start" className="w-40" />
            <span className="text-sm text-muted-foreground">–</span>
            <DatePicker value={to} min={from} onValueChange={setTo} aria-label="Range end" className="w-40" />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {active.length > 0 && (
            <span className="hidden h-9 items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-2.5 text-xs font-semibold text-success sm:inline-flex">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>{' '}
              {active.length} clocked in now
            </span>
          )}
          <Button variant={showCoverage ? 'secondary' : 'outline'} onClick={() => setShowCoverage((v) => !v)} className="gap-1.5">
            <BarChart3 size={15} /> Coverage
          </Button>
          <Button
            variant="outline"
            onClick={() => publish.mutate()}
            disabled={publish.isPending || draftCount === 0 || !locationId}
            title={draftCount === 0 ? 'No draft shifts in this range' : undefined}
            className="gap-1.5"
          >
            <Send size={15} /> {publish.isPending ? 'Publishing…' : `Publish drafts${draftCount > 0 ? ` (${draftCount})` : ''}`}
          </Button>
        </div>
      </div>

      {showCoverage && locationId && <CoveragePanel />}

      {publish.data && <p className="text-xs text-success">Published {publish.data.published} draft shift(s).</p>}

      {/* Register */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="min-w-56 flex-1">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={14} />}
              placeholder="Search staff, role or location…"
              aria-label="Search shift records"
              rightAction={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                ) : undefined
              }
            />
          </div>
          <Select
            value={stateFilter}
            onValueChange={(value) => setStateFilter(value as 'all' | WorkState)}
            options={STATE_FILTERS}
            ariaLabel="Filter by status"
            className="w-40"
          />
          <Select
            value={staffFilter}
            onValueChange={setStaffFilter}
            options={[
              { value: 'all', label: 'All staff' },
              ...staff.map((member) => ({ value: member.userId, label: member.name ?? member.email ?? member.userId })),
            ]}
            ariaLabel="Filter by staff member"
            className="w-44"
          />
          <Select
            value={sort}
            onValueChange={(value) => setSort(value as SortKey)}
            options={SORTS}
            ariaLabel="Sort records"
            className="w-40"
          />
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setStateFilter('all');
                setStaffFilter('all');
              }}
              className="gap-1.5"
            >
              <X size={14} /> Clear
            </Button>
          )}
        </div>

        <DataTable
          aria-label="Shift records"
          data={visible}
          columns={columns}
          getRowKey={(row) => row.id}
          isLoading={isLoading}
          minWidth={880}
          className="rounded-none border-0"
          emptyState={
            !locationId ? (
              <EmptyState icon={MapPin} title="Select a location" description="Choose a location to view its shift records." />
            ) : (
              <EmptyState
                icon={filtersActive ? Search : CalendarClock}
                title={filtersActive ? 'No matches' : 'No shift records'}
                description={
                  filtersActive
                    ? 'Try a different search, filter or date range.'
                    : 'Create a record to rota someone on — you can repeat it weekly in one go.'
                }
              />
            )
          }
          onRowClick={({ row }) => setOpenRow({ mode: row.shift ? 'edit' : 'create', id: row.id, date: row.dateKey })}
          rowAriaLabel={({ row }) => `Open ${row.staffName}'s shift on ${row.dateKey}`}
        />

        {/* Summary + pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'record' : 'records'} · {fmtHours(plannedTotal)} planned · {fmtHours(workedTotal)}{' '}
            worked
            {money && costTotal > 0 && ` · ${fmtMoney(costTotal)} estimated`}
          </p>
          {pageCount > 1 && (
            <nav className="flex items-center gap-1" aria-label="Pagination">
              <Button variant="ghost" size="sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} className="gap-1">
                <ChevronLeft size={14} /> Previous
              </Button>
              {pageNumbers(currentPage, pageCount).map((n, i) =>
                n === null ? (
                  <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === currentPage ? 'page' : undefined}
                    className={cn(
                      'size-8 rounded-lg text-sm font-medium tabular-nums transition-colors',
                      n === currentPage
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-surface-offset hover:text-foreground',
                    )}
                  >
                    {n}
                  </button>
                ),
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === pageCount}
                className="gap-1"
              >
                Next <ChevronRight size={14} />
              </Button>
            </nav>
          )}
        </div>
      </div>

      {drawer && locationId && (
        // Keyed by the row so switching records re-seeds the form, while a
        // refetch of the same record only updates it.
        <ShiftRecordDrawer
          key={openRow?.id ?? 'new-record'}
          target={drawer}
          defaultLocationId={locationId}
          locations={locations}
          staff={staff}
          employeesByUser={employeesByUser}
          money={money}
          canClock={canClock}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}

/** 1 … 4 5 6 … 12 — `null` marks an elision. */
function pageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  let previous = 0;
  for (const n of sorted) {
    if (previous && n - previous > 1) out.push(null);
    out.push(n);
    previous = n;
  }
  return out;
}
