'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import {
  Banknote,
  CalendarClock,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Search,
  Send,
  Timer,
  TrendingUp,
  UserPlus,
  X,
} from '@/components/icons';
import { Avatar, fmtMoney } from '@/components/people/shared';
import { CoveragePanel } from '@/components/scheduling/CoveragePanel';
import { type ShiftDrawerTarget, ShiftRecordDrawer, hourlyRateOf, unpaidBreakFor } from '@/components/scheduling/ShiftRecordDrawer';
import {
  type ShiftRecord,
  WORK_STATE,
  type WorkState,
  dayKey,
  fmtDayHeading,
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
import { Fact } from '@/components/settings/controls';
import { TileSkeleton } from '@/components/shared/TileSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { IconTag } from '@/components/shared/IconTag';
import { Bone } from '@/components/shared/Skeleton';
import { StatusDot } from '@/components/shared/StatusDot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { getStaff } from '@/lib/modules/identity/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { getPayrollRuns } from '@/lib/modules/payroll/client';
import { getEmployees } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getScheduledShifts, getVariance, publishScheduledShifts } from '@/lib/modules/workforce/client';
import { type Shift, getActiveShifts, getShifts } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import { shiftBarGeometry } from '@/lib/utils/shift-bar';
import { groupShiftsByDay } from '@/lib/utils/shift-days';
import { reconcileClockEntries } from '@/lib/utils/shift-reconciliation';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

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
  creating = null,
  onCreatingChange,
}: {
  creating?: 'planned' | 'worked' | null;
  onCreatingChange?: (open: 'planned' | 'worked' | null) => void;
}) {
  const { tenantId, locationId } = useWorkspaceStore();
  const qc = useQueryClient();
  const capabilities = useAuthStore((s) => s.capabilities);
  // Hourly rates and shift cost, not "is this a senior account".
  const money = hasCapability(capabilities, 'hr.sensitive:read');
  const canPlan = hasCapability(capabilities, 'scheduling:write');
  // Running the clock for someone else is a write on another person's shift —
  // distinct from clocking yourself in, which needs no capability at all.
  const canClock = hasCapability(capabilities, 'shifts:write');

  // Only the row's identity is held — the record itself is re-read from the
  // live rows below, so clocking in or out updates the open drawer in place.
  const [openRow, setOpenRow] = useState<{ mode: 'create' | 'edit'; id: string; date: string } | null>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<'all' | WorkState>('all');
  const [staffFilter, setStaffFilter] = useState('all');

  function closeDrawer() {
    setOpenRow(null);
    onCreatingChange?.(null);
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

  const [showCover, setShowCover] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: staff = [] } = useQuery({
    queryKey: moduleQueryKeys.identity.key('staff', tenantId),
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });
  const { data: employees = [] } = useQuery({
    queryKey: moduleQueryKeys.people.key('hr-employees', tenantId),
    queryFn: getEmployees,
    enabled: !!tenantId,
  });
  const {
    data: shifts = [],
    isLoading,
    isError: shiftsError,
    refetch: refetchShifts,
  } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('scheduled-shifts', locationId, fromISO, toISO),
    queryFn: () => getScheduledShifts({ locationId: locationId ?? undefined, from: fromISO, to: toISO }),
    enabled: !!tenantId,
  });
  // Planned-vs-actual, joined into each row by scheduledShiftId.
  const { data: variance = [] } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('variance', locationId, fromISO, toISO),
    queryFn: () => getVariance({ locationId: locationId ?? undefined, from: fromISO, to: toISO }),
    enabled: !!tenantId,
  });
  const { data: active = [] } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('shifts-active'),
    queryFn: getActiveShifts,
    refetchInterval: 60_000,
  });
  // Exact clock in/out times. store_manager+ on the API — a 403 (hr_manager)
  // just means rows fall back to the variance summary, so keep it quiet.
  const { data: clockRecords = [] } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('shifts', locationId),
    queryFn: () => getShifts({ locationId: locationId ?? undefined }),
    meta: { silentError: true },
  });
  // Which days are already through payroll.
  const { data: payrollRuns = [] } = useQuery({
    queryKey: moduleQueryKeys.payroll.key('payroll-runs'),
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

  const reconciledClock = useMemo(() => reconcileClockEntries(shifts, clockedInRange), [shifts, clockedInRange]);

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
      const clocked = reconciledClock.byShiftId.get(shift.id) ?? [];
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
        workedMinutes: clocked.length > 0 ? clockedMinutes : (v?.workedMinutes ?? 0),
        startDeltaMinutes:
          v?.startDeltaMinutes ??
          (clocked[0] ? Math.round((new Date(clocked[0].clockedIn).getTime() - new Date(shift.startsAt).getTime()) / 60_000) : null),
        state: workStateOf(shift, v, clocked, now),
      });
    }

    // Attendance with no rota entry — grouped one row per person per day.
    const unplanned = new Map<string, Shift[]>();
    for (const entry of reconciledClock.unplanned) {
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
  }, [shifts, reconciledClock, varianceMap, staffById, employeesByUser, locationById, isPaid, now]);

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
    return creating ? { mode: 'create', createKind: creating } : null;
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
    return rows;
  }, [records, search, stateFilter, staffFilter]);

  // Looking back over a finished period reads newest day first; anything that
  // includes today or the future reads forwards, the way a rota is worked.
  const days = useMemo(() => groupShiftsByDay(filtered, to < toDateInput(new Date(now)) ? 'desc' : 'asc'), [filtered, to, now]);
  const todayKey = toDateInput(new Date(now));
  // The days the cover check offers: the whole period when it's a week or two,
  // otherwise the week that holds today (or the period's first week).
  const checkDays = useMemo(() => {
    const all: string[] = [];
    const cursor = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    while (cursor <= end && all.length < 62) {
      all.push(toDateInput(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    if (all.length <= 7) return all;
    const todayAt = all.indexOf(todayKey);
    // Back to that week's Monday: getDay() is 0 on Sunday, so shift it to 6.
    const start = todayAt >= 0 ? Math.max(0, todayAt - ((new Date(`${todayKey}T00:00:00`).getDay() + 6) % 7)) : 0;
    return all.slice(start, start + 7);
  }, [from, to, todayKey]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const draftCount = shifts.filter((s) => s.status === 'draft').length;
  const peopleCount = new Set(filtered.map((row) => row.userId).filter(Boolean)).size;
  const publish = useMutation({
    mutationFn: () => publishScheduledShifts({ locationId: locationId!, from: fromISO, to: toISO }),
    onSuccess: () => qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('scheduled-shifts') }),
  });

  const filtersActive = !!search || stateFilter !== 'all' || staffFilter !== 'all';
  const plannedTotal = filtered.reduce((sum, r) => sum + r.plannedMinutes, 0);
  const workedTotal = filtered.reduce((sum, r) => sum + r.workedMinutes, 0);
  const costTotal = filtered.reduce((sum, r) => sum + (r.estimatedCost ?? 0), 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Period + page-level actions */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Stepper and range read as one control: arrows page by the span. */}
        <div className="flex h-9 items-stretch overflow-hidden rounded-md border border-rule/60 bg-field">
          <button
            type="button"
            onClick={() => stepRange(-1)}
            aria-label="Previous period"
            className="grid w-9 place-items-center text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="grid min-w-44 place-items-center border-x border-rule/60 px-3 text-sm font-semibold text-foreground">
            {rangeLabel(from, to)}
          </span>
          <button
            type="button"
            onClick={() => stepRange(1)}
            aria-label="Next period"
            className="grid w-9 place-items-center text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
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
            <span className="hidden h-9 items-center gap-2 rounded-md bg-primary/8 px-3 text-xs font-semibold text-primary sm:inline-flex">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              {active.length} clocked in now
            </span>
          )}
          <Button
            variant={showCover ? 'secondary' : 'outline'}
            aria-expanded={showCover}
            onClick={() => setShowCover((open) => !open)}
            disabled={!locationId}
            title={locationId ? 'Rostered staff against what recent orders need' : 'Choose a location to check its cover'}
            className="gap-1.5"
          >
            <TrendingUp size={15} /> Cover vs demand
          </Button>
          {canPlan && (
            <Button
              variant={draftCount > 0 ? 'default' : 'outline'}
              onClick={() => publish.mutate()}
              disabled={publish.isPending || draftCount === 0 || !locationId}
              title={
                !locationId
                  ? 'Choose a location to publish its drafts'
                  : draftCount === 0
                    ? 'No draft shifts in this range'
                    : 'Make the drafts visible to the team'
              }
              className="gap-1.5"
            >
              <Send size={15} />{' '}
              {publish.isPending
                ? 'Publishing…'
                : draftCount > 0
                  ? `Publish ${draftCount} ${draftCount === 1 ? 'draft' : 'drafts'}`
                  : 'All published'}
            </Button>
          )}
        </div>
      </div>

      {publish.data && (
        <p className="text-xs font-medium text-primary">Published {publish.data.published} draft shift(s) — the team can see them now.</p>
      )}

      {/* The period in four numbers. */}
      <dl className={cn('grid gap-2 sm:grid-cols-2', money ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}>
        <Fact
          surface="page"
          icon={CalendarClock}
          label="Shifts"
          value={filtered.length}
          hint={`${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`}
        />
        <Fact surface="page" icon={Clock} label="Planned" value={fmtHours(plannedTotal)} />
        <Fact
          surface="page"
          icon={Timer}
          label="Worked"
          value={fmtHours(workedTotal)}
          hint={plannedTotal > 0 ? `${Math.round((workedTotal / plannedTotal) * 100)}% of planned` : 'Nothing planned'}
        />
        {money && (
          <Fact surface="page" icon={Banknote} label="Estimated cost" value={fmtMoney(costTotal)} hint="Paid time at each person’s rate" />
        )}
      </dl>

      {/* Staffing against demand, for a day of the period — opened from the toolbar. */}
      <AnimatePresence initial={false}>
        {showCover && locationId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <CoveragePanel shifts={shifts} days={checkDays} todayKey={todayKey} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
            placeholder="Search staff, role or location…"
            aria-label="Search shifts"
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
          value={staffFilter}
          onValueChange={setStaffFilter}
          options={[
            { value: 'all', label: 'Everyone' },
            ...staff.map((member) => ({ value: member.userId, label: member.name ?? member.email ?? member.userId })),
          ]}
          ariaLabel="Filter by staff member"
          className="w-44"
        />
        <Select
          value={stateFilter}
          onValueChange={(value) => setStateFilter(value as 'all' | WorkState)}
          options={STATE_FILTERS}
          ariaLabel="Filter by status"
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

      {/* The register, a day at a time */}
      {isLoading ? (
        // The register's shape: a day heading, then that day's shift rows.
        <section role="status" aria-busy="true" aria-label="Loading shifts">
          <div className="mb-2 flex items-baseline gap-3 px-1" aria-hidden="true">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-24" />
          </div>
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <TileSkeleton
                key={index}
                index={index}
                tile="size-9"
                trailing={['hidden h-2.5 w-36 rounded-full md:block', 'hidden h-4 w-24 lg:block', 'h-3 w-20']}
                className="border-rule/60 bg-field px-4"
              />
            ))}
          </div>
        </section>
      ) : shiftsError ? (
        // An empty rota and an unreadable one must not look the same — only one means nobody is working.
        <ErrorState
          icon={CalendarClock}
          title="The rota couldn’t be loaded"
          description="No shift has been read, so this is not an empty rota."
          onRetry={() => void refetchShifts()}
        />
      ) : days.length === 0 && !locationId && !filtersActive ? (
        <EmptyState
          icon={MapPin}
          title="Nothing on the rota"
          description="No location has shifts in this period. Pick a location to plan one."
        />
      ) : days.length === 0 ? (
        <EmptyState
          icon={filtersActive ? Search : CalendarClock}
          title={filtersActive ? 'No shifts match' : 'Nothing on the rota'}
          description={
            filtersActive
              ? 'Try a different search, person or status.'
              : 'Plan a shift to rota someone on — you can repeat it weekly in one go.'
          }
          kind={filtersActive ? 'search' : 'start'}
          action={
            filtersActive
              ? {
                  label: 'Clear filters',
                  onClick: () => {
                    setSearch('');
                    setStateFilter('all');
                    setStaffFilter('all');
                  },
                }
              : canPlan && onCreatingChange
                ? { label: 'Plan shift', onClick: () => onCreatingChange('planned') }
                : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day.dateKey} aria-labelledby={`rota-day-${day.dateKey}`}>
              <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
                <h3 id={`rota-day-${day.dateKey}`} className="text-base font-semibold tracking-title text-foreground">
                  {day.dateKey === todayKey ? 'Today' : fmtDayHeading(`${day.dateKey}T12:00:00`)}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {day.records.length} {day.records.length === 1 ? 'shift' : 'shifts'} · {fmtHours(day.plannedMinutes)} planned
                  {day.workedMinutes > 0 && ` · ${fmtHours(day.workedMinutes)} worked`}
                  {money && day.cost > 0 && ` · ${fmtMoney(day.cost)}`}
                </span>
              </header>
              <ul className="space-y-2">
                {day.records.map((row) => (
                  <ShiftRow
                    key={row.id}
                    row={row}
                    money={money}
                    now={now}
                    onOpen={() => setOpenRow({ mode: 'edit', id: row.id, date: row.dateKey })}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {drawer && (
        // Keyed by the row so switching records re-seeds the form, while a
        // refetch of the same record only updates it.
        <ShiftRecordDrawer
          key={openRow?.id ?? 'new-record'}
          target={drawer}
          defaultLocationId={drawer.record?.locationId ?? locationId ?? ''}
          locations={locations}
          staff={staff}
          employeesByUser={employeesByUser}
          money={money}
          canClock={canClock}
          canPlan={canPlan}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}

/** The planned band and the worked fill on one track; red fill when they started late. */
function ShiftBar({ row, late, now }: { row: ShiftRecord; late: boolean; now: number }) {
  const first = row.clocked[0];
  const last = row.clocked.at(-1);
  const bar = shiftBarGeometry({
    plannedStart: row.shift?.startsAt,
    plannedEnd: row.shift?.endsAt,
    workedStart: first?.clockedIn,
    workedEnd: first ? (last?.clockedOut ?? null) : null,
    now,
  });
  const planned = row.shift ? `Planned ${fmtTime(row.shift.startsAt)}–${fmtTime(row.shift.endsAt)}` : 'Not on the rota';
  const worked = first ? `worked ${fmtTime(first.clockedIn)}–${last?.clockedOut ? fmtTime(last.clockedOut) : 'now'}` : 'not clocked';
  const label = `${planned}, ${worked}`;
  const times = `${row.shift ? `${fmtTime(row.shift.startsAt)}–${fmtTime(row.shift.endsAt)}` : '—'} · ${
    first ? `${fmtTime(first.clockedIn)}–${last?.clockedOut ? fmtTime(last.clockedOut) : 'now'}` : 'not in'
  }`;
  return (
    // The times stay visible under the bar: comparing rota against clock-in is
    // the reason a manager opens this list, and touch has no hover.
    <span className="hidden w-36 shrink-0 md:block" title={label}>
      <span className="relative block h-2.5 rounded-full bg-band/60" aria-hidden="true">
        {bar?.planned && (
          <span
            className="absolute inset-y-0 rounded-full border border-primary/40"
            style={{ left: `${bar.planned.left}%`, width: `${bar.planned.width}%` }}
          />
        )}
        {bar?.worked && (
          <span
            className={cn(
              'absolute inset-y-0.5 rounded-full',
              late ? 'bg-exception' : row.state === 'running' ? 'bg-primary' : 'bg-momentum',
            )}
            style={{ left: `${bar.worked.left}%`, width: `${bar.worked.width}%` }}
          />
        )}
      </span>
      <span className="mt-1 block truncate text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
        {times}
      </span>
    </span>
  );
}

/** What the row says, for the button's accessible name — its visual parts are hidden from it. */
function shiftRowLabel(row: ShiftRecord, money: boolean): string {
  const first = row.clocked[0];
  const last = row.clocked.at(-1);
  const planned = row.shift ? `planned ${fmtTime(row.shift.startsAt)} to ${fmtTime(row.shift.endsAt)}` : 'not on the rota';
  const worked = first ? `worked ${fmtTime(first.clockedIn)} to ${last?.clockedOut ? fmtTime(last.clockedOut) : 'now'}` : 'not clocked in';
  const paid = money && row.billState !== 'none' ? (row.billState === 'paid' ? ', paid' : ', not paid yet') : '';
  return `${row.staffName}, ${row.dateKey}: ${planned}, ${worked}, ${WORK_STATE[row.state].label}${paid}. Open shift`;
}

const STATE_DOT: Record<WorkState, { dot: string; text: string }> = {
  scheduled: { dot: 'bg-primary/40', text: 'text-muted-foreground' },
  running: { dot: 'bg-primary', text: 'text-primary' },
  completed: { dot: 'bg-momentum', text: 'text-momentum' },
  no_show: { dot: 'bg-exception', text: 'text-exception' },
  cancelled: { dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
};

/** One shift: who, the planned hours, what was actually worked, and how it went. */
function ShiftRow({ row, money, now, onOpen }: { row: ShiftRecord; money: boolean; now: number; onOpen: () => void }) {
  const state = STATE_DOT[row.state];
  const late = row.startDeltaMinutes != null && row.startDeltaMinutes > 0;
  const early = row.startDeltaMinutes != null && row.startDeltaMinutes < 0;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={shiftRowLabel(row, money)}
        className={cn(
          'group flex w-full items-center gap-3 rounded-lg border bg-field px-4 py-3 text-left transition-colors hover:border-rule hover:bg-band/40',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          row.state === 'no_show' ? 'border-exception/35' : row.status === 'draft' ? 'border-dashed border-rule/70' : 'border-rule/60',
          row.state === 'cancelled' && 'opacity-60',
        )}
      >
        {row.userId ? (
          <Avatar name={row.staffName} email={row.staffEmail} />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed border-rule text-muted-foreground">
            <UserPlus size={15} aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('truncate text-sm font-semibold', row.userId ? 'text-foreground' : 'text-muted-foreground')}>
              {row.staffName}
            </span>
            {row.status === 'draft' && <StatusDot tone="muted" label="Draft" dashed />}
            {!row.shift && <Badge variant="warning">Not on the rota</Badge>}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {[row.role, row.locationName].filter(Boolean).join(' · ') || row.staffEmail || '—'}
          </span>
        </span>

        {/* Planned, then worked — the two times a manager compares — as one bar:
            the outline is the rota, the fill is the clock. Times on hover. */}
        <ShiftBar row={row} late={late} now={now} />
        <span
          className={cn(
            'hidden w-20 shrink-0 text-right text-xs md:block',
            late ? 'text-exception' : early ? 'text-momentum' : 'text-muted-foreground',
          )}
        >
          {late
            ? `${row.startDeltaMinutes} min late`
            : early
              ? `${-row.startDeltaMinutes!} min early`
              : row.workedMinutes > 0
                ? fmtDuration(row.workedMinutes)
                : row.shift
                  ? `${fmtHours(row.plannedMinutes)} planned`
                  : 'Not clocked'}
        </span>

        {money && (
          <span className="hidden w-24 shrink-0 text-right lg:block">
            <span className="block text-sm text-foreground">{row.estimatedCost != null ? fmtMoney(row.estimatedCost) : '—'}</span>
            {row.billState !== 'none' && (
              <IconTag
                icon={Banknote}
                label={row.billState === 'paid' ? 'Paid' : 'Not paid yet'}
                tone={row.billState === 'paid' ? 'success' : 'muted'}
                size={13}
              />
            )}
          </span>
        )}

        <span className={cn('flex w-24 shrink-0 items-center justify-end gap-1.5 text-xs font-semibold', state.text)}>
          <span className={cn('size-2 rounded-full', state.dot, row.state === 'running' && 'animate-pulse')} aria-hidden="true" />
          {WORK_STATE[row.state].label}
        </span>
        <ChevronRight
          size={15}
          className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}
