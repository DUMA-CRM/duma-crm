'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  Plus,
  Send,
  Settings,
  TrendingUp,
  TriangleAlert,
  UserPlus,
} from '@/components/icons';
import { RecordLink, useRecordHrefs } from '@/components/shared/RecordLink';
import { Avatar, fmtMoney } from '@/components/people/shared';
import { CoveragePanel, shortHoursOf, useCoverageCheck } from '@/components/scheduling/CoveragePanel';
import { RotaDayView } from '@/components/scheduling/RotaDayView';
import { RotaJumpstart } from '@/components/scheduling/RotaJumpstart';
import { RotaRequestsDrawer } from '@/components/scheduling/RotaRequestsDrawer';
import { RotaSettingsDrawer } from '@/components/scheduling/RotaSettingsDrawer';
import { type ShiftDrawerTarget, ShiftRecordDrawer, hourlyRateOf, unpaidBreakFor } from '@/components/scheduling/ShiftRecordDrawer';
import { invalidateRota, plannerKey } from '@/components/scheduling/rota-queries';
import {
  type ShiftRecord,
  WORK_STATE,
  dayKey,
  fmtHours,
  fmtTime,
  mondayOf,
  rangeLabel,
  shiftMinutes,
  staffLabel,
  toDateInput,
  workStateOf,
} from '@/components/scheduling/shared';
import { Switch } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select } from '@/components/ui/select';
import { CARD_SURFACE } from '@/components/shared/surface';

import { type PlannerStaff, getRotaPlanner } from '@/lib/api/rota.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { getStaff } from '@/lib/modules/identity/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { getPayrollRuns } from '@/lib/modules/payroll/client';
import { getEmployees } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type ScheduledShift,
  createScheduledShift,
  getVariance,
  publishScheduledShifts,
  updateScheduledShift,
} from '@/lib/modules/workforce/client';
import { type Shift, getActiveShifts, getShifts } from '@/lib/modules/workforce/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import {
  type CellState,
  LABOUR_BAND_TONE,
  type PeriodTotals,
  addDays,
  cellState,
  contractedMinutesOf,
  costExclusions,
  groupByPosition,
  indexWarnings,
  moveShiftTo,
  personWeek,
  plannerTotals,
  positionSwatch,
  publishState,
  seenState,
  shiftDate,
} from '@/lib/utils/rota-planner';
import { type RuleWarning, checkRota, describeWarning, isSerious, rulesFor } from '@/lib/utils/rota-rules';
import { reconcileClockEntries } from '@/lib/utils/shift-reconciliation';
import { DEFAULT_TIME_ZONE, workspaceDateKey, workspaceTimeZone, zonedToInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
const WEEKDAY_SHORT = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const DRAG_TYPE = 'application/x-duma-shift';

/** A name column, the seven days, then the person's week; the grid scrolls sideways inside its card on a phone. */
const GRID = 'grid grid-cols-[12rem_repeat(7,minmax(7.25rem,1fr))_6.5rem]';
/** A day's cell: hairline-split from the one before, as on My rota. */
const DAY_CELL = 'min-w-0 border-l border-border';

/** Monday–Sunday of the week holding today at the business, as YYYY-MM-DD. */
function thisWeek(): string {
  return toDateInput(mondayOf(new Date(`${workspaceDateKey()}T00:00:00`)));
}

const longDay = (day: string) => WEEKDAY_LONG.format(new Date(`${day}T12:00:00`));
const money = (pence: number) => fmtMoney(pence / 100);

/** One line of the grid: a person, the open slots, or (grouped by position) a position. */
interface RotaLine {
  key: string;
  kind: 'person' | 'open' | 'position';
  userId: string | null;
  name: string;
  email?: string;
  member?: PlannerStaff;
  position?: { id: string; name: string; color: string } | null;
  cells: Map<string, ShiftRecord[]>;
  plannedMinutes: number;
}

/**
 * The manager's rota: one week as a grid (a line per person, or per position),
 * holding what was planned and what was clocked. The toolbar moves the week,
 * picks the location, fills the week (Jumpstart), lists rule breaches, opens
 * staff requests and settings, and publishes. A sticky footer gives each day's
 * hours, labour cost, sales and labour % against target. Shifts drag to move
 * (Alt/Option to copy); every shift opens the record drawer, and an empty cell
 * plans one there. The data is one call: `GET /rota/planner`.
 */
export function ShiftsWorkspace({
  creating = null,
  onCreatingChange,
}: {
  creating?: 'planned' | 'worked' | null;
  onCreatingChange?: (open: 'planned' | 'worked' | null) => void;
}) {
  const { tenantId, locationId, setLocationId } = useWorkspaceStore();
  const qc = useQueryClient();
  const capabilities = useAuthStore((s) => s.capabilities);
  // Hourly rates in the drawer, not "is this a senior account". The grid's
  // cost follows the planner, which only carries rates the caller may see.
  const canSeePay = hasCapability(capabilities, 'hr.sensitive:read');
  const canPlan = hasCapability(capabilities, 'scheduling:write');
  const canPublish = hasCapability(capabilities, 'scheduling:publish');
  // Running the clock for someone else is a write on another person's shift.
  const canClock = hasCapability(capabilities, 'shifts:write');

  const [openRow, setOpenRow] = useState<
    { mode: 'edit'; id: string; date: string } | { mode: 'create'; id: string; date: string; userId: string } | null
  >(null);
  const [panel, setPanel] = useState<'requests' | 'settings' | 'publish' | null>(null);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [groupBy, setGroupBy] = useState<'person' | 'position'>('person');
  const [dropCell, setDropCell] = useState<string | null>(null);

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

  // ── Week ────────────────────────────────────────────────────────────────────

  const currentWeek = useMemo(() => thisWeek(), []);
  const [weekStart, setWeekStart] = useState(currentWeek);
  const weekEnd = addDays(weekStart, 6);
  const isThisWeek = weekStart === currentWeek;
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const todayKey = workspaceDateKey(now);
  const [dayPick, setDayPick] = useState<string | null>(null);
  const selectedDay = dayPick && days.includes(dayPick) ? dayPick : days.includes(todayKey) ? todayKey : days[0];

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data: locations = [] } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });
  // The planner is per location; with only one there is nothing to choose.
  useEffect(() => {
    if (!locationId && locations.length === 1) setLocationId(locations[0].id);
  }, [locationId, locations, setLocationId]);
  const location = locations.find((l) => l.id === locationId);

  const planner = useQuery({
    queryKey: plannerKey(locationId, weekStart),
    queryFn: () => getRotaPlanner(locationId!, weekStart),
    enabled: !!locationId,
  });
  const data = planner.data;
  const shifts = useMemo(() => data?.shifts ?? [], [data]);
  const timeZone = data?.location.timeZone ?? workspaceTimeZone() ?? DEFAULT_TIME_ZONE;

  // The week, as instants at the location: Monday 00:00 to the next Monday 00:00.
  const fromISO = useMemo(
    () => (zonedToInstant(weekStart, '00:00', timeZone) ?? new Date(`${weekStart}T00:00:00`)).toISOString(),
    [weekStart, timeZone],
  );
  const toISO = useMemo(() => {
    const next = addDays(weekStart, 7);
    return (zonedToInstant(next, '00:00', timeZone) ?? new Date(`${next}T00:00:00`)).toISOString();
  }, [weekStart, timeZone]);

  // The drawer still takes staff profiles and employment records (break, pay).
  const { data: staff = [] } = useQuery({
    queryKey: moduleQueryKeys.identity.key('staff', tenantId),
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: employees = [] } = useQuery({
    queryKey: moduleQueryKeys.people.key('hr-employees', tenantId),
    queryFn: getEmployees,
    enabled: !!tenantId,
  });
  // Planned-vs-actual, joined into each row by scheduledShiftId.
  const { data: variance = [] } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('variance', locationId, fromISO, toISO),
    queryFn: () => getVariance({ locationId: locationId ?? undefined, from: fromISO, to: toISO }),
    enabled: !!locationId,
  });
  const { data: active = [] } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('shifts-active'),
    queryFn: getActiveShifts,
    refetchInterval: 60_000,
  });
  // Exact clock in/out times; a 403 just means rows fall back to the variance summary.
  const { data: clockRecords = [] } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('shifts', locationId),
    queryFn: () => getShifts({ locationId: locationId ?? undefined }),
    meta: { silentError: true },
  });
  const { data: payrollRuns = [] } = useQuery({
    queryKey: moduleQueryKeys.payroll.key('payroll-runs'),
    queryFn: getPayrollRuns,
    enabled: canSeePay,
    meta: { silentError: true },
  });

  const employeesByUser = useMemo(() => new Map(employees.map((e) => [e.userId, e])), [employees]);
  const staffById = useMemo(() => new Map(staff.map((member) => [member.userId, member])), [staff]);
  const plannerStaff = useMemo(() => data?.staff ?? [], [data]);
  const plannerById = useMemo(() => new Map(plannerStaff.map((member) => [member.userId, member])), [plannerStaff]);
  const varianceMap = useMemo(() => new Map(variance.map((v) => [v.scheduledShiftId, v])), [variance]);

  const clockedInRange = useMemo(() => {
    const byId = new Map<string, Shift>();
    for (const entry of [...clockRecords, ...active]) {
      const at = new Date(entry.clockedIn).getTime();
      if (at < new Date(fromISO).getTime() || at >= new Date(toISO).getTime()) continue;
      if (locationId && entry.locationId !== locationId) continue;
      byId.set(entry.id, entry);
    }
    return [...byId.values()].sort((a, b) => a.clockedIn.localeCompare(b.clockedIn));
  }, [clockRecords, active, fromISO, toISO, locationId]);

  const reconciledClock = useMemo(() => reconcileClockEntries(shifts, clockedInRange), [shifts, clockedInRange]);

  const paidDays = useMemo(() => {
    const list: { userId: string; start: string; end: string }[] = [];
    for (const run of payrollRuns) {
      if (run.status !== 'finalised') continue;
      for (const line of run.lines ?? [])
        list.push({ userId: line.userId, start: run.periodStart.slice(0, 10), end: run.periodEnd.slice(0, 10) });
    }
    return list;
  }, [payrollRuns]);

  // ── Rows ────────────────────────────────────────────────────────────────────

  const records = useMemo<ShiftRecord[]>(() => {
    const rows: ShiftRecord[] = [];
    const isPaid = (userId: string | null, day: string) =>
      !!userId && paidDays.some((p) => p.userId === userId && day >= p.start && day <= p.end);

    const build = (
      base: Omit<ShiftRecord, 'paidMinutes' | 'estimatedCost' | 'billState' | 'hourlyRate' | 'unpaidBreakMinutes'>,
      plannedBreak?: number,
    ) => {
      const employee = base.userId ? employeesByUser.get(base.userId) : undefined;
      const unpaidBreakMinutes = plannedBreak ?? unpaidBreakFor(employee, base.plannedMinutes || base.workedMinutes);
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
    const clockedMinutes = (entries: Shift[]) =>
      entries.reduce(
        (sum, entry) =>
          sum +
          (entry.clockedOut
            ? (entry.durationMinutes ?? shiftMinutes({ startsAt: entry.clockedIn, endsAt: entry.clockedOut }))
            : Math.max(0, (now - new Date(entry.clockedIn).getTime()) / 60000)),
        0,
      );

    for (const shift of shifts) {
      const clocked = reconciledClock.byShiftId.get(shift.id) ?? [];
      const v = varianceMap.get(shift.id);
      const member = shift.userId ? plannerById.get(shift.userId) : undefined;
      const profile = shift.userId ? staffById.get(shift.userId) : undefined;
      build(
        {
          id: shift.id,
          dateKey: shiftDate(shift, timeZone),
          at: shift.startsAt,
          userId: shift.userId ?? null,
          staffName: shift.userId ? (member?.name ?? staffLabel(profile, shift.staff?.user?.name)) : 'Open shift',
          staffEmail: member?.email ?? profile?.email ?? shift.staff?.user?.email,
          locationId: shift.locationId,
          locationName: data?.location.name,
          role: shift.position?.name ?? shift.role,
          notes: shift.notes,
          status: shift.status,
          shift,
          clocked,
          plannedMinutes: shiftMinutes(shift),
          workedMinutes: clocked.length > 0 ? clockedMinutes(clocked) : (v?.workedMinutes ?? 0),
          startDeltaMinutes:
            v?.startDeltaMinutes ??
            (clocked[0] ? Math.round((new Date(clocked[0].clockedIn).getTime() - new Date(shift.startsAt).getTime()) / 60_000) : null),
          state: workStateOf(shift, v, clocked, now),
        },
        shift.breakMinutes,
      );
    }

    // Attendance with no rota entry — one row per person per day.
    const unplanned = new Map<string, Shift[]>();
    for (const entry of reconciledClock.unplanned) {
      const key = `${entry.userId}|${dayKey(entry.clockedIn)}`;
      unplanned.set(key, [...(unplanned.get(key) ?? []), entry]);
    }
    for (const [key, entries] of unplanned) {
      const [userId, day] = key.split('|');
      const profile = staffById.get(userId);
      build({
        id: `unplanned-${key}`,
        dateKey: day,
        at: entries[0].clockedIn,
        userId,
        staffName: plannerById.get(userId)?.name ?? staffLabel(profile, entries[0].staff?.user?.name ?? entries[0].staff?.name),
        staffEmail: profile?.email,
        locationId: entries[0].locationId,
        locationName: entries[0].location?.name ?? data?.location.name,
        status: null,
        shift: null,
        clocked: entries,
        plannedMinutes: 0,
        workedMinutes: clockedMinutes(entries),
        startDeltaMinutes: null,
        state: entries.some((entry) => !entry.clockedOut) ? 'running' : 'completed',
      });
    }
    return rows;
  }, [shifts, reconciledClock, varianceMap, staffById, plannerById, employeesByUser, paidDays, now, timeZone, data]);

  const drawer = useMemo<ShiftDrawerTarget | null>(() => {
    if (openRow?.mode === 'create') return { mode: 'create', createKind: 'planned', date: openRow.date, userId: openRow.userId };
    if (openRow) {
      const record = records.find((row) => row.id === openRow.id);
      if (!record) return null;
      return { mode: 'edit', record, date: openRow.date };
    }
    return creating ? { mode: 'create', createKind: creating } : null;
  }, [openRow, records, creating]);

  // ── Rules ───────────────────────────────────────────────────────────────────

  const warnings = useMemo<RuleWarning[]>(() => {
    if (!data) return [];
    return checkRota(
      shifts
        .filter((s) => s.status !== 'cancelled')
        .map((s) => ({
          id: s.id,
          userId: s.userId ?? null,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          breakMinutes: s.breakMinutes ?? 0,
          positionId: s.positionId ?? null,
        })),
      data.staff.map((m) => ({
        userId: m.userId,
        isMinor: m.isMinor,
        positionIds: m.positionIds,
        contractedWeeklyMinutes: contractedMinutesOf(m.contractedWeeklyHours),
      })),
      rulesFor(data.targets.rules),
      {
        leave: data.leave.filter((l) => l.status === 'approved'),
        availability: data.staff.flatMap((m) => m.availability),
        timeZone,
      },
    );
  }, [data, shifts, timeZone]);
  const warningIndex = useMemo(() => indexWarnings(warnings), [warnings]);

  const cellOf = useCallback(
    (userId: string, date: string): CellState => cellState(userId, date, data?.leave ?? [], plannerById.get(userId)?.availability ?? []),
    [data, plannerById],
  );

  // ── Lines ───────────────────────────────────────────────────────────────────

  const lines = useMemo<RotaLine[]>(() => {
    const place = (line: RotaLine, record: ShiftRecord) => {
      line.cells.set(record.dateKey, [...(line.cells.get(record.dateKey) ?? []), record]);
      line.plannedMinutes += record.plannedMinutes;
    };
    const sortCells = (list: RotaLine[]) => {
      for (const line of list) for (const cell of line.cells.values()) cell.sort((a, b) => a.at.localeCompare(b.at));
      return list;
    };

    if (groupBy === 'position' && data) {
      const groups = groupByPosition(
        shifts.map((s) => ({ ...s, userId: s.userId ?? null })),
        data.positions,
      );
      const byShift = new Map(records.filter((r) => r.shift).map((r) => [r.shift!.id, r]));
      return sortCells(
        groups.map((group) => {
          const line: RotaLine = {
            key: `position:${group.key}`,
            kind: 'position',
            userId: null,
            name: group.position?.name ?? 'No position',
            position: group.position,
            cells: new Map(),
            plannedMinutes: 0,
          };
          for (const shift of group.shifts) {
            const record = byShift.get(shift.id);
            if (record) place(line, record);
          }
          return line;
        }),
      );
    }

    const byKey = new Map<string, RotaLine>();
    const ensure = (key: string, userId: string | null, name: string, email?: string) => {
      let line = byKey.get(key);
      if (!line) {
        line = {
          key,
          kind: userId ? 'person' : 'open',
          userId,
          name,
          email,
          member: userId ? plannerById.get(userId) : undefined,
          cells: new Map(),
          plannedMinutes: 0,
        };
        byKey.set(key, line);
      }
      return line;
    };
    // Everyone who can work here gets a line, so an empty week can still be planned.
    for (const member of plannerStaff) ensure(member.userId, member.userId, member.name, member.email ?? undefined);
    for (const record of records) {
      const line = record.userId
        ? ensure(record.userId, record.userId, record.staffName, record.staffEmail)
        : ensure('open', null, 'Open shifts');
      place(line, record);
    }
    // Open shifts first — they are the gaps to fill — then people by name, the same order every week.
    return sortCells([...byKey.values()].sort((a, b) => (a.userId ? 1 : 0) - (b.userId ? 1 : 0) || a.name.localeCompare(b.name)));
  }, [groupBy, data, shifts, records, plannerStaff, plannerById]);

  const totals = useMemo(
    () => (data ? plannerTotals({ weekStart, timeZone, shifts, staff: data.staff, sales: data.sales, targets: data.targets }) : null),
    [data, weekStart, timeZone, shifts],
  );

  // ── Cover ───────────────────────────────────────────────────────────────────

  const cover = useCoverageCheck(shifts, days);
  const [coverDay, setCoverDay] = useState<string | null>(null);
  const panelDay = coverDay ? (days.includes(coverDay) ? coverDay : days.includes(todayKey) ? todayKey : days[0]) : null;
  const shortDays = days.filter((day) => shortHoursOf(cover.byDay.get(day)) > 0).length;

  // ── Actions ─────────────────────────────────────────────────────────────────

  const publishInfo = publishState(shifts);
  const draftIds = shifts.filter((s) => s.status === 'draft').map((s) => s.id);
  const [notify, setNotify] = useState(true);
  const publish = useMutation({
    mutationFn: () => publishScheduledShifts({ locationId: locationId!, from: fromISO, to: toISO, notify }),
    onSuccess: (result) => {
      invalidateRota(qc);
      setPanel(null);
      toast(
        'success',
        `Published ${result.published} ${result.published === 1 ? 'shift' : 'shifts'}${notify && result.notified ? ` · ${result.notified} notified` : ''}`,
      );
    },
  });

  /** Drop a shift on another person/position and day: move it, or copy it with Alt/Option. Never optimistic. */
  const drop = useMutation({
    mutationFn: async ({ shift, line, date, copy }: { shift: ScheduledShift; line: RotaLine; date: string; copy: boolean }) => {
      const times = moveShiftTo(shift, date, timeZone);
      const position = line.kind === 'position' ? (line.position ?? null) : undefined;
      const userId = line.kind === 'person' ? line.userId : line.kind === 'open' ? null : (shift.userId ?? null);
      if (copy) {
        await createScheduledShift({
          locationId: shift.locationId,
          ...(userId ? { userId } : {}),
          ...times,
          role: position !== undefined ? (position?.name ?? undefined) : shift.role,
          status: 'draft',
          notes: shift.notes,
          positionId: position !== undefined ? (position?.id ?? null) : (shift.positionId ?? null),
          breakMinutes: shift.breakMinutes ?? 0,
        });
        return 'copied';
      }
      await updateScheduledShift(shift.id, {
        ...times,
        ...(userId !== (shift.userId ?? null) ? { userId } : {}),
        ...(position !== undefined ? { positionId: position?.id ?? null, ...(position ? { role: position.name } : {}) } : {}),
      });
      return 'moved';
    },
    onSuccess: (verb) => {
      invalidateRota(qc);
      toast('success', `Shift ${verb}.`);
    },
    onError: (error) => toast('error', (error as Error).message),
  });

  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));
  const planIn = (userId: string, date: string) => setOpenRow({ mode: 'create', id: `new:${userId}:${date}`, date, userId });
  const openShift = (row: ShiftRecord) => setOpenRow({ mode: 'edit', id: row.id, date: row.dateKey });
  const jumpTo = (shiftId: string) => {
    const element = document.getElementById(`shift-${shiftId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    element?.focus({ preventScroll: true });
  };

  const issueCount = warnings.filter(isSerious).length;
  const dragEnabled = canPlan && view === 'week';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* One toolbar: the week and place on the left, the tools on the right. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 items-stretch overflow-hidden rounded-md border border-border bg-field">
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
            className="grid w-9 place-items-center text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="grid min-w-44 place-items-center border-x border-border px-3 text-sm font-semibold text-foreground">
            {rangeLabel(weekStart, weekEnd)}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Next week"
            className="grid w-9 place-items-center text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        {!isThisWeek && (
          <Button variant="ghost" onClick={() => setWeekStart(currentWeek)}>
            This week
          </Button>
        )}
        <Select
          value={locationId ?? ''}
          onValueChange={(value) => setLocationId(value || null)}
          options={locationOptions}
          placeholder="Choose a location"
          ariaLabel="Location"
          icon={<MapPin size={14} />}
          className="w-48"
        />
        <SegmentedControl
          options={[
            { value: 'week', label: 'Week' },
            { value: 'day', label: 'Day' },
          ]}
          value={view}
          onChange={setView}
          ariaLabel="View"
        />
        {view === 'week' && (data?.positions.length ?? 0) > 0 && (
          <SegmentedControl
            options={[
              { value: 'person', label: 'People' },
              { value: 'position', label: 'Positions' },
            ]}
            value={groupBy}
            onChange={setGroupBy}
            ariaLabel="Group by"
          />
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {active.length > 0 && (
            <span className="hidden h-9 items-center gap-2 px-1 text-xs font-semibold text-primary xl:inline-flex">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-sm bg-primary opacity-40" />
                <span className="relative inline-flex size-2 rounded-sm bg-primary" />
              </span>
              {active.length} on now
            </span>
          )}
          {warnings.length > 0 && (
            <IssuesButton warnings={warnings} count={issueCount} nameOf={(id) => plannerById.get(id)?.name ?? 'Someone'} onJump={jumpTo} />
          )}
          <Button
            variant={panelDay ? 'secondary' : 'outline'}
            aria-expanded={!!panelDay}
            onClick={() => setCoverDay(panelDay ? null : days.includes(todayKey) ? todayKey : days[0])}
            disabled={!locationId}
            title="Rostered staff against what recent orders need"
            className="gap-1.5"
          >
            <TrendingUp size={15} /> Cover
            {shortDays > 0 && (
              <span className="rounded-sm bg-exception/10 px-1.5 text-micro font-semibold text-exception tabular-nums">
                {shortDays} short
              </span>
            )}
          </Button>
          {locationId && data && (
            <Button variant="outline" className="gap-1.5" onClick={() => setPanel('requests')}>
              <ClipboardList size={15} /> Requests
              {data.pendingRequests > 0 && (
                <span className="rounded-sm bg-primary px-1.5 text-micro font-semibold text-primary-foreground tabular-nums">
                  {data.pendingRequests}
                </span>
              )}
            </Button>
          )}
          {canPlan && locationId && data && <RotaJumpstart locationId={locationId} weekStart={weekStart} draftIds={draftIds} />}
          {locationId && data && (
            <Button variant="outline" size="icon" aria-label="Rota settings" title="Rota settings" onClick={() => setPanel('settings')}>
              <Settings size={16} />
            </Button>
          )}
          {canPublish && locationId && (
            <Button
              variant={publishInfo.drafts > 0 ? 'default' : 'outline'}
              onClick={() => setPanel('publish')}
              disabled={publishInfo.drafts === 0}
              title={publishInfo.drafts === 0 ? 'No draft shifts this week' : 'Make the drafts visible to the team'}
              className="gap-1.5"
            >
              <Send size={15} /> {publishInfo.drafts > 0 ? `Publish ${publishInfo.drafts}` : 'All published'}
              {publishInfo.changed > 0 && (
                <span
                  className={cn(
                    'rounded-sm px-1.5 text-micro font-semibold tabular-nums',
                    publishInfo.drafts > 0 ? 'bg-primary-foreground/20' : 'bg-warning/10 text-warning',
                  )}
                  title="Published, then changed or not yet seen by the person"
                >
                  {publishInfo.changed} changed
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {panelDay && locationId && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <CoveragePanel
              check={cover}
              days={days}
              day={panelDay}
              todayKey={todayKey}
              onDayChange={setCoverDay}
              onClose={() => setCoverDay(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!locationId ? (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <EmptyState icon={MapPin} title="Choose a location" description="A rota is planned one location at a time." />
        </div>
      ) : planner.isPending ? (
        <RotaSkeleton />
      ) : planner.isError ? (
        // An empty rota and an unreadable one must not look the same — only one means nobody is working.
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <ErrorState
            icon={CalendarClock}
            title="The rota couldn’t be loaded"
            description="No shift has been read, so this is not an empty rota."
            onRetry={() => void planner.refetch()}
          />
        </div>
      ) : lines.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <EmptyState
            icon={CalendarClock}
            title="Nobody on the rota"
            description="Nobody can work here yet. People appear here once they can."
          />
        </div>
      ) : view === 'day' ? (
        <section aria-label="Day timeline" className="space-y-3">
          <SegmentedControl
            options={days.map((day) => ({
              value: day,
              label: day === todayKey ? 'Today' : `${WEEKDAY_SHORT.format(new Date(`${day}T12:00:00`))} ${Number(day.slice(8))}`,
            }))}
            value={selectedDay}
            onChange={setDayPick}
            ariaLabel="Day"
          />
          <RotaDayView
            date={selectedDay}
            timeZone={timeZone}
            hours={location?.openingHours?.[(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const)[days.indexOf(selectedDay)]]}
            people={plannerStaff}
            shifts={shifts}
            cellOf={(userId) => cellOf(userId, selectedDay)}
            cover={cover.byDay.get(selectedDay)}
            onOpen={(shift) => {
              const record = records.find((r) => r.id === shift.id);
              if (record) openShift(record);
            }}
          />
        </section>
      ) : (
        <section aria-label="Team rota">
          <div className="max-h-[calc(100dvh-13rem)] overflow-auto rounded-lg border border-border bg-card shadow-sm">
            <div role="table" aria-label={`Rota, ${rangeLabel(weekStart, weekEnd)}`} className="min-w-[70rem]">
              {/* ── Days ───────────────────────────────────────────── */}
              <div role="row" className={cn(GRID, 'sticky top-0 z-20 border-b border-border bg-card')}>
                <div role="columnheader" className="sticky left-0 z-10 flex items-center bg-card px-3 py-2">
                  <span className="text-micro font-semibold text-muted-foreground uppercase">
                    {groupBy === 'position' ? 'Position' : 'Team'}
                  </span>
                </div>
                {days.map((day, index) => {
                  const isToday = day === todayKey;
                  const short = shortHoursOf(cover.byDay.get(day));
                  return (
                    <div
                      key={day}
                      role="columnheader"
                      aria-current={isToday ? 'date' : undefined}
                      className={cn(DAY_CELL, 'flex items-center justify-between gap-1 px-2 py-2', isToday && 'bg-primary/4')}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={cn('text-micro font-semibold uppercase', isToday ? 'text-primary' : 'text-muted-foreground')}>
                          {DAY_LABELS[index]}
                        </span>
                        <span
                          className={cn(
                            'flex size-7 items-center justify-center rounded-md text-sm font-semibold tabular-nums',
                            isToday ? 'bg-primary text-primary-foreground' : day < todayKey ? 'text-muted-foreground' : 'text-foreground',
                          )}
                        >
                          {Number(day.slice(8))}
                        </span>
                      </span>
                      {short > 0 && (
                        <button
                          type="button"
                          onClick={() => setCoverDay(panelDay === day ? null : day)}
                          aria-pressed={panelDay === day}
                          aria-label={`Short-staffed for ${short} ${short === 1 ? 'hour' : 'hours'} on ${longDay(day)} — check cover`}
                          className="rounded-sm bg-exception/8 px-1.5 py-0.5 text-micro font-semibold whitespace-nowrap text-exception transition-colors hover:bg-exception/14 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          Short {short}h
                        </button>
                      )}
                    </div>
                  );
                })}
                <div role="columnheader" className={cn(DAY_CELL, 'flex items-center px-2 py-2')}>
                  <span className="text-micro font-semibold text-muted-foreground uppercase">Week</span>
                </div>
              </div>

              {/* ── Lines ──────────────────────────────────────────── */}
              {lines.map((line) => (
                <div key={line.key} role="row" className={cn(GRID, 'border-b border-border')}>
                  <LineHeader line={line} warnings={line.userId ? (warningIndex.byUser.get(line.userId) ?? []) : []} />
                  {days.map((day) => {
                    const cell = line.cells.get(day) ?? [];
                    const state = line.kind === 'person' && line.userId ? cellOf(line.userId, day) : null;
                    const cellKey = `${line.key}|${day}`;
                    const blocked = !!state && (state.leave?.status === 'approved' || state.unavailable);
                    return (
                      <div
                        key={day}
                        role="cell"
                        onDragOver={
                          dragEnabled
                            ? (event) => {
                                if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
                                event.preventDefault();
                                event.dataTransfer.dropEffect = event.altKey ? 'copy' : 'move';
                                if (dropCell !== cellKey) setDropCell(cellKey);
                              }
                            : undefined
                        }
                        onDragLeave={dragEnabled ? () => setDropCell((current) => (current === cellKey ? null : current)) : undefined}
                        onDrop={
                          dragEnabled
                            ? (event) => {
                                event.preventDefault();
                                setDropCell(null);
                                const id = event.dataTransfer.getData(DRAG_TYPE);
                                const shift = shifts.find((s) => s.id === id);
                                if (!shift) return;
                                const copy = event.altKey;
                                const sameLine =
                                  line.kind === 'position'
                                    ? (line.position?.id ?? null) === (shift.positionId ?? null)
                                    : (line.userId ?? null) === (shift.userId ?? null);
                                if (!copy && sameLine && shiftDate(shift, timeZone) === day) return;
                                drop.mutate({ shift, line, date: day, copy });
                              }
                            : undefined
                        }
                        className={cn(
                          DAY_CELL,
                          'relative flex min-h-16 flex-col gap-1 p-1.5',
                          day === todayKey && 'bg-primary/4',
                          state?.leave && (state.leave.status === 'approved' ? 'bg-reference/8' : 'bg-reference/4'),
                          !state?.leave && state?.unavailable && 'bg-band/50',
                          dropCell === cellKey && 'ring-2 ring-primary/40 ring-inset',
                        )}
                      >
                        {state && <CellNote state={state} />}
                        {cell.map((row) => (
                          <ShiftBlock
                            key={row.id}
                            row={row}
                            showPerson={line.kind === 'position'}
                            warnings={row.shift ? (warningIndex.byShift.get(row.shift.id) ?? []) : []}
                            draggable={dragEnabled && !!row.shift && row.state === 'scheduled'}
                            onOpen={() => openShift(row)}
                          />
                        ))}
                        {cell.length === 0 && canPlan && !blocked && line.kind !== 'position' && (
                          <button
                            type="button"
                            onClick={() => planIn(line.userId ?? '', day)}
                            aria-label={`Plan a shift ${line.userId ? `for ${line.name}` : 'as an open slot'} on ${longDay(day)}`}
                            className="flex min-h-10 flex-1 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-band/60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                          >
                            <Plus size={15} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <LineWeek line={line} shifts={shifts} onCostPct={data?.targets.onCostPct ?? '0'} />
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">
            {records.length === 0
              ? canPlan
                ? 'Nothing planned this week. Select a day on someone’s line, or use Jumpstart.'
                : 'Nothing planned this week.'
              : canPlan
                ? 'Dashed shifts are drafts. Drag to move; hold Alt (Option) to copy.'
                : 'Dashed shifts are drafts: only managers see them until they’re published.'}
          </p>
          {totals && <TotalsCard totals={totals} todayKey={todayKey} target={data?.targets.targetLabourPct ?? null} />}
        </section>
      )}

      {drawer && (
        <ShiftRecordDrawer
          key={openRow?.id ?? 'new-record'}
          target={drawer}
          defaultLocationId={drawer.record?.locationId ?? locationId ?? ''}
          locations={locations}
          staff={staff}
          employeesByUser={employeesByUser}
          money={canSeePay}
          canClock={canClock}
          canPlan={canPlan}
          positions={data?.positions.filter((p) => p.isActive)}
          positionsOf={(userId) => plannerById.get(userId)?.positionIds ?? []}
          onClose={closeDrawer}
        />
      )}

      {panel === 'requests' && locationId && (
        <RotaRequestsDrawer locationId={locationId} canDecide={canPublish} onClose={() => setPanel(null)} />
      )}
      {panel === 'settings' && locationId && data && (
        <RotaSettingsDrawer
          locationId={locationId}
          locationName={data.location.name}
          targets={data.targets}
          staff={data.staff}
          canPublish={canPublish}
          canWrite={canPlan}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'publish' && (
        <Modal
          title={`Publish ${publishInfo.drafts} ${publishInfo.drafts === 1 ? 'shift' : 'shifts'}`}
          description={rangeLabel(weekStart, weekEnd)}
          onClose={() => !publish.isPending && setPanel(null)}
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPanel(null)} disabled={publish.isPending}>
                Cancel
              </Button>
              <Button onClick={() => publish.mutate()} disabled={publish.isPending} className="gap-1.5">
                <Send size={15} /> {publish.isPending ? 'Publishing…' : 'Publish'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">Notify staff</span>
              <Switch checked={notify} onChange={setNotify} label="Notify staff" />
            </label>
            {issueCount > 0 && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <TriangleAlert size={13} aria-hidden="true" /> {issueCount} working-time {issueCount === 1 ? 'issue' : 'issues'} this week
              </p>
            )}
            {publish.error && (
              <p role="alert" className="text-sm text-destructive">
                {(publish.error as Error).message}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

/** The toolbar chip: every warning this week, each jumping to its shift. */
function IssuesButton({
  warnings,
  count,
  nameOf,
  onJump,
}: {
  warnings: RuleWarning[];
  count: number;
  nameOf: (userId: string) => string;
  onJump: (shiftId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sorted = [...warnings].sort(
    (a, b) => Number(isSerious(b)) - Number(isSerious(a)) || nameOf(a.userId).localeCompare(nameOf(b.userId)),
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('gap-1.5', count > 0 && 'text-warning')}>
          <TriangleAlert size={15} /> {count > 0 ? `${count} ${count === 1 ? 'issue' : 'issues'}` : `${warnings.length} notes`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-96 w-80 overflow-y-auto p-1">
        <ul>
          {sorted.map((warning, index) => {
            const shiftId = 'shiftId' in warning ? warning.shiftId : null;
            const body = (
              <>
                <span className="block text-sm font-semibold text-foreground">{nameOf(warning.userId)}</span>
                <span className={cn('block text-xs', isSerious(warning) ? 'text-warning' : 'text-muted-foreground')}>
                  {describeWarning(warning)}
                </span>
              </>
            );
            return (
              <li key={index}>
                {shiftId ? (
                  <button
                    type="button"
                    className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-band"
                    onClick={() => {
                      setOpen(false);
                      onJump(shiftId);
                    }}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="px-2.5 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function LineHeader({ line, warnings }: { line: RotaLine; warnings: RuleWarning[] }) {
  const serious = warnings.filter(isSerious);
  const hrefs = useRecordHrefs();
  return (
    <div role="rowheader" className="sticky left-0 z-10 flex min-w-0 items-center gap-2.5 bg-card px-3 py-2">
      {line.kind === 'person' ? (
        <Avatar name={line.name} email={line.email} size="sm" />
      ) : line.kind === 'open' ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
          <UserPlus size={14} aria-hidden="true" />
        </span>
      ) : (
        <span
          className={cn(
            'size-2.5 shrink-0 rounded-full',
            line.position ? positionSwatch(line.position.color).dot : 'border border-dashed border-muted-foreground',
          )}
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">
            <RecordLink href={line.kind === 'person' ? hrefs.staff(line.userId) : null}>{line.name}</RecordLink>
          </span>
          {warnings.length > 0 && (
            <span
              className={cn(
                'shrink-0 rounded-sm px-1 text-micro font-semibold tabular-nums',
                serious.length > 0 ? 'bg-warning/12 text-warning' : 'bg-band text-muted-foreground',
              )}
              title={warnings.map(describeWarning).join('\n')}
              aria-label={`${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}: ${warnings.map(describeWarning).join('; ')}`}
            >
              {warnings.length}
            </span>
          )}
        </span>
        {line.member?.isMinor && <span className="text-micro font-semibold text-reference uppercase">Under 18</span>}
      </span>
    </div>
  );
}

/** The right-hand column: hours against contract, and cost when the rate is visible. */
function LineWeek({ line, shifts, onCostPct }: { line: RotaLine; shifts: ScheduledShift[]; onCostPct: string }) {
  if (line.kind === 'person' && line.member) {
    const week = personWeek(line.member, shifts, onCostPct);
    return (
      <div role="cell" className={cn(DAY_CELL, 'flex flex-col justify-center px-2 py-2 text-xs tabular-nums')}>
        <span className={cn('font-semibold', week.overContract ? 'text-warning' : 'text-foreground')}>
          {fmtHours(week.paidMinutes)}
          {week.contractedMinutes !== null && (
            <span className="font-normal text-muted-foreground"> / {fmtHours(week.contractedMinutes)}</span>
          )}
        </span>
        {week.costPence !== null && week.paidMinutes > 0 && <span className="text-muted-foreground">{money(week.costPence)}</span>}
      </div>
    );
  }
  return (
    <div role="cell" className={cn(DAY_CELL, 'flex items-center px-2 py-2 text-xs font-semibold tabular-nums text-foreground')}>
      {line.plannedMinutes > 0 ? fmtHours(line.plannedMinutes) : <span className="font-normal text-muted-foreground">—</span>}
    </div>
  );
}

/** Leave, can't-work and preferences, at the top of a person's day. */
function CellNote({ state }: { state: CellState }) {
  const main = state.leave
    ? state.leave.status === 'approved'
      ? (state.leave.typeName ?? 'Leave')
      : `${state.leave.typeName ?? 'Leave'}?`
    : state.unavailable
      ? 'Unavailable'
      : null;
  if (!main && state.windows.length === 0) return null;
  return (
    <span className="block min-w-0 text-micro leading-tight">
      {main && <span className={cn('block truncate font-semibold', state.leave ? 'text-reference' : 'text-muted-foreground')}>{main}</span>}
      {state.windows.map((window) => (
        <span
          key={window.label}
          className={cn('block truncate', window.kind === 'preferred' ? 'text-momentum' : 'text-muted-foreground')}
          title={window.note ?? undefined}
        >
          {window.label}
        </span>
      ))}
    </span>
  );
}

/**
 * The week's numbers in their own card under the grid, one labelled line per
 * measure so each value reads on its own. Columns line up with the days above.
 */
function TotalsCard({
  totals,
  todayKey,
  target,
}: {
  totals: NonNullable<ReturnType<typeof plannerTotals>>;
  todayKey: string;
  target: string | null;
}) {
  const { week, days } = totals;
  const exclusions = totals.costVisible ? costExclusions(totals.unratedPeople, totals.openShifts) : null;
  const anyForecast = [...days, week].some((period) => period.sales && period.sales.kind !== 'actual');
  const periods = [...days.map((day) => ({ ...day, today: day.date === todayKey })), { ...week, date: 'week', today: false }];
  const notes = [exclusions, anyForecast && 'Grey sales are a forecast from the last four weeks.'].filter(Boolean).join(' · ');

  const line = (label: ReactNode, value: (period: PeriodTotals & { date: string }) => ReactNode) => (
    <div role="row" className={GRID}>
      <div role="rowheader" className="sticky left-0 z-10 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      {periods.map((period) => (
        <div
          key={period.date}
          role="cell"
          className={cn(
            DAY_CELL,
            'px-2 py-1.5 text-sm tabular-nums',
            period.today && 'bg-primary/4',
            period.date === 'week' && 'font-semibold',
          )}
        >
          {value(period) ?? <span className="text-muted-foreground/60">—</span>}
        </div>
      ))}
    </div>
  );

  return (
    <section aria-label="Week totals" className="mt-4">
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <div role="table" className="min-w-[70rem] py-1.5">
          {line('Hours', (p) => (p.paidMinutes > 0 ? fmtHours(p.paidMinutes) : null))}
          {totals.costVisible &&
            line(week.budgetPence !== null ? `Cost · budget ${money(week.budgetPence)}` : 'Cost', (p) =>
              p.costPence ? (
                <span className={cn(p.date === 'week' && week.overBudget && 'text-exception')}>{money(p.costPence)}</span>
              ) : null,
            )}
          {line('Sales', (p) =>
            p.sales && p.sales.pence > 0 ? (
              <span className={cn(p.sales.kind !== 'actual' && 'text-muted-foreground')}>{money(p.sales.pence)}</span>
            ) : null,
          )}
          {line(target ? `Labour · target ${Number(target)}%` : 'Labour', (p) =>
            p.pct !== null && p.paidMinutes > 0 ? (
              <span className={cn('font-semibold', p.band ? LABOUR_BAND_TONE[p.band] : 'text-foreground')}>{Math.round(p.pct)}%</span>
            ) : null,
          )}
        </div>
      </div>
      {notes && <p className="mt-2 px-1 text-xs text-muted-foreground">{notes}</p>}
    </section>
  );
}

/** The grid's own shape while the week loads: the days, then a few lines of shift-sized blocks. */
function RotaSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading the rota"
      className={CARD_SURFACE}
    >
      <div aria-hidden="true">
        <div className="flex items-center gap-3 border-b border-border px-3 py-3">
          <Bone className="h-3 w-12" />
          <div className="grid flex-1 grid-cols-7 gap-3">
            {DAY_LABELS.map((day) => (
              <Bone key={day} className="h-5 w-12" />
            ))}
          </div>
        </div>
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
            <Bone className="size-8" />
            <Bone className="h-3.5 w-24" />
            <div className="grid flex-1 grid-cols-7 gap-3">
              {DAY_LABELS.map((day, cell) => (
                <Bone key={day} className={cn('h-11', (cell + index) % 3 === 0 ? 'opacity-100' : 'opacity-0')} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** What the block says, for the button's accessible name. */
function shiftRowLabel(row: ShiftRecord, warnings: RuleWarning[]): string {
  const first = row.clocked[0];
  const last = row.clocked.at(-1);
  const planned = row.shift ? `planned ${fmtTime(row.shift.startsAt)} to ${fmtTime(row.shift.endsAt)}` : 'not on the rota';
  const worked = first ? `worked ${fmtTime(first.clockedIn)} to ${last?.clockedOut ? fmtTime(last.clockedOut) : 'now'}` : 'not clocked in';
  const draft = row.status === 'draft' ? ', draft' : '';
  const seen = row.shift ? seenState(row.shift) : null;
  const ack = seen === 'seen' ? ', seen' : seen === 'unseen' ? ', not seen yet' : '';
  const issues = warnings.length ? `. ${warnings.map(describeWarning).join('; ')}` : '';
  return `${row.staffName}, ${row.dateKey}: ${planned}, ${worked}, ${WORK_STATE[row.state].label}${draft}${ack}${issues}. Open shift`;
}

/**
 * One shift in a day's cell — a tinted block: the hours, the position (its
 * colour on the left edge), and how it went once it has started. Dashed is a
 * draft; a published shift carries a tick once the person has seen it; a rule
 * breach marks the corner.
 */
function ShiftBlock({
  row,
  showPerson,
  warnings,
  draggable,
  onOpen,
}: {
  row: ShiftRecord;
  showPerson: boolean;
  warnings: RuleWarning[];
  draggable: boolean;
  onOpen: () => void;
}) {
  const first = row.clocked[0];
  const last = row.clocked.at(-1);
  const late = row.startDeltaMinutes != null && row.startDeltaMinutes > 0 ? row.startDeltaMinutes : 0;
  const clockedTimes = first ? `${fmtTime(first.clockedIn)}–${last?.clockedOut ? fmtTime(last.clockedOut) : 'now'}` : '—';
  const times = row.shift ? `${fmtTime(row.shift.startsAt)}–${fmtTime(row.shift.endsAt)}` : clockedTimes;
  const detail = [showPerson ? row.staffName : null, showPerson ? null : row.role].filter(Boolean).join(' · ');
  const draft = row.status === 'draft';
  const position = row.shift?.position;
  const seen = row.shift ? seenState(row.shift) : null;
  const serious = warnings.some(isSerious);

  const outcome: { text: string; tone: string } | null = !row.shift
    ? { text: `Unplanned · ${fmtHours(row.workedMinutes)}`, tone: 'text-momentum' }
    : row.state === 'running'
      ? { text: 'On now', tone: 'text-primary' }
      : row.state === 'completed'
        ? { text: `Worked ${fmtHours(row.workedMinutes)}`, tone: 'text-momentum' }
        : row.state === 'no_show'
          ? { text: 'No show', tone: 'text-exception' }
          : row.state === 'cancelled'
            ? { text: 'Cancelled', tone: 'text-muted-foreground' }
            : null;

  return (
    <button
      type="button"
      id={row.shift ? `shift-${row.shift.id}` : undefined}
      onClick={onOpen}
      draggable={draggable}
      onDragStart={
        draggable
          ? (event) => {
              event.dataTransfer.setData(DRAG_TYPE, row.shift!.id);
              event.dataTransfer.effectAllowed = 'copyMove';
            }
          : undefined
      }
      aria-label={shiftRowLabel(row, warnings)}
      title={warnings.length ? warnings.map(describeWarning).join('\n') : row.shift && first ? `Clocked ${clockedTimes}` : undefined}
      className={cn(
        'relative block w-full min-w-0 rounded-md px-2 py-1.5 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        draggable && 'cursor-grab active:cursor-grabbing',
        position && cn('border-l-[3px]', positionSwatch(position.color).edge),
        !row.shift
          ? 'border border-dashed border-momentum/45 bg-momentum/5 hover:bg-momentum/10'
          : row.state === 'cancelled'
            ? 'bg-band/40 opacity-60 hover:opacity-80'
            : row.state === 'no_show'
              ? 'bg-exception/6 hover:bg-exception/10'
              : row.state === 'running'
                ? 'bg-primary/10 ring-1 ring-primary/45 ring-inset hover:bg-primary/14'
                : row.state === 'completed'
                  ? 'bg-band/50 hover:bg-band'
                  : draft
                    ? 'border-y border-r border-dashed border-y-primary/45 border-r-primary/45 hover:bg-primary/6'
                    : 'bg-primary/6 hover:bg-primary/10',
        draft && !position && 'border-l border-dashed border-l-primary/45',
        warnings.length > 0 && (serious ? 'ring-1 ring-warning/60 ring-inset' : ''),
      )}
    >
      <span className="flex items-center gap-1">
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-mono text-xs font-semibold tabular-nums',
            row.state === 'completed' ? 'text-muted-foreground' : 'text-foreground',
            row.state === 'cancelled' && 'line-through',
          )}
        >
          {times}
        </span>
        {warnings.length > 0 && (
          <TriangleAlert size={12} className={serious ? 'shrink-0 text-warning' : 'shrink-0 text-muted-foreground'} aria-hidden="true" />
        )}
        {seen && (
          <Check size={12} className={cn('shrink-0', seen === 'seen' ? 'text-momentum' : 'text-muted-foreground/40')} aria-hidden="true" />
        )}
      </span>
      {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
      {(outcome || late > 0) && (
        <span className="block truncate text-micro font-semibold">
          {outcome && <span className={outcome.tone}>{outcome.text}</span>}
          {late > 0 && row.state !== 'no_show' && (
            <span className="text-exception">
              {outcome ? ' · ' : ''}
              {late} min late
            </span>
          )}
        </span>
      )}
    </button>
  );
}
