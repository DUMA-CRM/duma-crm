'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';

import {
  Banknote,
  CalendarClock,
  CalendarDays,
  Clock,
  Coffee,
  FileText,
  ListChecks,
  LogIn,
  LogOut,
  MapPin,
  Plus,
  Repeat,
  Tag,
  Timer,
  Trash2,
  UsersRound,
} from '@/components/icons';
import { Avatar, fmtMoney } from '@/components/people/shared';
import { invalidateRota } from '@/components/scheduling/rota-queries';
import {
  type ShiftRecord,
  WEEKDAYS,
  WORK_STATE,
  buildOccurrences,
  fmtDuration,
  fmtTime,
  inp,
  shiftMinutes,
  toShiftTimes,
  toTimeInput,
} from '@/components/scheduling/shared';
import { Fact } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { DrawerSection, FieldLine } from '@/components/shared/DrawerSection';
import { IconTag } from '@/components/shared/IconTag';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { StatusDot } from '@/components/shared/StatusDot';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FieldLabel } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { TimePicker } from '@/components/ui/time-picker';

import type { Position } from '@/lib/api/rota.service';
import type { StaffProfile } from '@/lib/modules/identity/client';
import type { HrEmployee } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type ScheduledShiftStatus,
  createScheduledShift,
  deleteScheduledShift,
  updateScheduledShift,
} from '@/lib/modules/workforce/client';
import { type Shift, adjustShift, createManualShift, deleteShift } from '@/lib/modules/workforce/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { workspaceDateKey, zonedToInstant } from '@/lib/utils/workspace-time';

// ── Pay helpers ───────────────────────────────────────────────────────────────

/** The employee's unpaid break for a shift of this length — nothing under their threshold. */
export function unpaidBreakFor(employee: HrEmployee | undefined, plannedMinutes: number): number {
  const unpaid = employee?.unpaidBreakMins ?? 0;
  if (unpaid <= 0) return 0;
  return plannedMinutes >= (employee?.breakThresholdMins ?? 0) ? Math.min(unpaid, plannedMinutes) : 0;
}

export function hourlyRateOf(employee: HrEmployee | undefined): number | null {
  if (employee?.payType !== 'hourly') return null;
  const rate = Number(employee.hourlyRate);
  return Number.isFinite(rate) ? rate : null;
}

// ── Layout bits ───────────────────────────────────────────────────────────────
//
// The drawer reads as the newer drawers do (Media, a customer's address):
// titled groups, each one tinted card of rows — `DrawerSection` + `FieldLine` —
// with the rule a reader can't see in one quiet line under the group.

/** One quiet line under a group: a rule, a total, a consequence. */
function Note({ tone = 'muted', children }: { tone?: 'muted' | 'warning' | 'success'; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'mt-2 px-1 text-xs leading-relaxed',
        tone === 'warning' ? 'font-medium text-measured' : tone === 'success' ? 'font-medium text-momentum' : 'text-muted-foreground',
      )}
    >
      {children}
    </p>
  );
}

/** A label and its figure on one line of a group, for read-only sums (the cost). */
function ValueLine({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-sm last:border-b-0">
      <span className={strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={cn('tabular-nums text-foreground', strong && 'text-base font-semibold')}>{value}</span>
    </div>
  );
}

/** Started – Finished, side by side, for a group's Hours line. */
function TimeRange({
  startId,
  start,
  end,
  onStart,
  onEnd,
  disabled,
  labels = ['Started', 'Finished'],
}: {
  startId: string;
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  disabled?: boolean;
  labels?: [string, string];
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-32">
        <TimePicker id={startId} value={start} onValueChange={onStart} required aria-label={labels[0]} disabled={disabled} />
      </div>
      <span className="text-muted-foreground">–</span>
      <div className="w-32">
        <TimePicker value={end} onValueChange={onEnd} required aria-label={labels[1]} disabled={disabled} />
      </div>
    </div>
  );
}

/** What the manual clock endpoints hand back: the shift plus its length once closed. */
type ClockResponse = Shift & { durationMinutes: number | null };

/** A row inside a group of clock records. */
const CLOCK_ROW = 'border-b border-border px-4 py-3 last:border-b-0';

/**
 * One clock in/out pair. A manager can correct either end in place — times are
 * edited as a time of day and anchored to the day the entry started on, so an
 * end before the start rolls into the next morning.
 */
function ClockEntryRow({
  entry,
  canEdit,
  onSaved,
  onDeleted,
}: {
  entry: Shift;
  canEdit: boolean;
  onSaved: (shift: ClockResponse) => void;
  onDeleted: (id: string) => void;
}) {
  const originalDay = workspaceDateKey(entry.clockedIn);
  const [day, setDay] = useState(originalDay);
  const [inTime, setInTime] = useState(toTimeInput(new Date(entry.clockedIn)));
  const [outTime, setOutTime] = useState(entry.clockedOut ? toTimeInput(new Date(entry.clockedOut)) : '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const original = {
    in: toTimeInput(new Date(entry.clockedIn)),
    out: entry.clockedOut ? toTimeInput(new Date(entry.clockedOut)) : '',
  };
  const dirty = day !== originalDay || inTime !== original.in || outTime !== original.out;
  const missingFinish = Boolean(entry.clockedOut) && !outTime;

  const adjust = useMutation({
    mutationFn: () => {
      if (missingFinish) throw new Error('Enter a finish time. Use “Stop shift” for a shift that is still running.');
      const times = outTime ? toShiftTimes(day, inTime, outTime) : null;
      return adjustShift(entry.id, {
        clockedIn: times ? times.startsAt : (zonedToInstant(day, inTime) ?? new Date(NaN)).toISOString(),
        clockedOut: times ? times.endsAt : null,
      });
    },
    onSuccess: (updated) => {
      toast('success', 'Clocked time updated.');
      onSaved(updated);
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteShift(entry.id),
    onSuccess: () => {
      setConfirmDelete(false);
      onDeleted(entry.id);
      toast('success', 'Worked-time record removed.');
    },
  });

  const previewTimes = outTime && inTime ? toShiftTimes(day, inTime, outTime) : null;
  const minutes = previewTimes ? shiftMinutes(previewTimes) : null;

  if (!canEdit) {
    return (
      <div className={cn(CLOCK_ROW, 'flex items-center justify-between text-sm')}>
        <span className="tabular-nums text-foreground">
          {fmtTime(entry.clockedIn)} – {entry.clockedOut ? fmtTime(entry.clockedOut) : '—:—'}
        </span>
        {minutes != null ? (
          <span className="text-xs text-muted-foreground">{fmtDuration(minutes)}</span>
        ) : (
          <StatusDot tone="primary" label="Running" pulse className="mr-1" />
        )}
      </div>
    );
  }

  return (
    <div className={CLOCK_ROW}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(10rem,1fr)_7rem_7rem] sm:items-end">
        <div className="space-y-1">
          <FieldLabel as="span" optional={false}>
            Date
          </FieldLabel>
          <DatePicker value={day} onValueChange={setDay} aria-label="Date worked" />
        </div>
        <label className="space-y-1">
          <FieldLabel as="span" optional={false}>
            Started
          </FieldLabel>
          <TimePicker value={inTime} onValueChange={setInTime} aria-label="Clocked in" />
        </label>
        <label className="space-y-1">
          <FieldLabel as="span" optional={false}>
            Finished
          </FieldLabel>
          <TimePicker value={outTime} onValueChange={setOutTime} aria-label="Clocked out" />
        </label>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {minutes != null ? (
            <span className="text-muted-foreground">{fmtDuration(minutes)} worked</span>
          ) : (
            <StatusDot tone="primary" label="Running" pulse />
          )}
          {dirty && !missingFinish && <span className="text-primary">Unsaved correction</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="sm" onClick={() => adjust.mutate()} disabled={!dirty || adjust.isPending || missingFinish}>
            {adjust.isPending ? 'Saving…' : 'Save correction'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            aria-label="Remove worked-time record"
            disabled={remove.isPending}
          >
            <Trash2 size={15} className="text-destructive" />
          </Button>
        </div>
      </div>
      {missingFinish && <p className="mt-1.5 text-xs text-destructive">A completed work period needs a finish time.</p>}
      {adjust.error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {(adjust.error as Error).message}
        </p>
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Remove this worked-time record?"
          message={
            <>
              <span className="block">
                This removes the clock-in and clock-out from attendance and payroll calculations. Any planned rota shift stays in place.
              </span>
              {remove.error && (
                <span role="alert" className="mt-2 block font-medium text-destructive">
                  {(remove.error as Error).message}
                </span>
              )}
            </>
          }
          confirmLabel="Remove worked time"
          pendingLabel="Removing…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => {
            if (!remove.isPending) setConfirmDelete(false);
          }}
        />
      )}
    </div>
  );
}

/** A missed work period, added as the last row of the clocked-time group. */
function AddWorkedPeriod({
  record,
  onSaved,
  onCancel,
}: {
  record: ShiftRecord;
  onSaved: (shift: ClockResponse) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(record.dateKey);
  const [startTime, setStartTime] = useState(record.shift ? toTimeInput(new Date(record.shift.startsAt)) : '09:00');
  const [endTime, setEndTime] = useState(record.shift ? toTimeInput(new Date(record.shift.endsAt)) : '17:00');
  const times = useMemo(() => toShiftTimes(date, startTime, endTime), [date, startTime, endTime]);

  const add = useMutation({
    mutationFn: () =>
      createManualShift({
        userId: record.userId!,
        locationId: record.locationId,
        clockedIn: times.startsAt,
        clockedOut: times.endsAt,
        ...(record.shift ? { scheduledShiftId: record.shift.id } : {}),
      }),
    onSuccess: (created) => {
      onSaved(created);
      onCancel();
      toast('success', 'Worked time added.');
    },
  });

  return (
    <div className={CLOCK_ROW}>
      <p className="mb-2.5 text-sm font-semibold text-foreground">Add a missed work period</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(8.5rem,1fr)_6.75rem_6.75rem]">
        <div className="space-y-1">
          <FieldLabel as="span" optional={false}>
            Date
          </FieldLabel>
          <DatePicker value={date} onValueChange={setDate} aria-label="Date worked" />
        </div>
        <label className="space-y-1">
          <FieldLabel as="span" optional={false}>
            Started
          </FieldLabel>
          <TimePicker value={startTime} onValueChange={setStartTime} aria-label="Started" />
        </label>
        <label className="space-y-1">
          <FieldLabel as="span" optional={false}>
            Finished
          </FieldLabel>
          <TimePicker value={endTime} onValueChange={setEndTime} aria-label="Finished" />
        </label>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{fmtDuration(shiftMinutes(times))} worked</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending || !date || !startTime || !endTime}>
            {add.isPending ? 'Adding…' : 'Add hours'}
          </Button>
        </div>
      </div>
      {add.error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {(add.error as Error).message}
        </p>
      )}
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export interface ShiftDrawerTarget {
  mode: 'create' | 'edit';
  /** New records are deliberately either a rota plan or completed work. */
  createKind?: 'planned' | 'worked';
  /** The row being edited, or the row a create is pre-filled from. */
  record?: ShiftRecord;
  date?: string;
  /** A create opened from someone's line of the grid: who the shift is for ('' is an open slot). */
  userId?: string;
}

interface ShiftDrawerProps {
  target: ShiftDrawerTarget;
  defaultLocationId: string;
  locations: { id: string; name: string }[];
  staff: StaffProfile[];
  employeesByUser: Map<string, HrEmployee>;
  /** Pay is only shown to the money roles. */
  money: boolean;
  /** store_manager+ — may run the time clock on a member's behalf. */
  canClock: boolean;
  /** May change the rota plan; independent from correcting worked time. */
  canPlan: boolean;
  /** The location's active positions — the pro rota. Without them the drawer keeps its free-text role. */
  positions?: Pick<Position, 'id' | 'name' | 'color'>[];
  /** The positions a person is trained for, for the "not trained" note. */
  positionsOf?: (userId: string) => string[];
  onClose: () => void;
}

const STATE_TONE: Record<ShiftRecord['state'], string> = {
  scheduled: 'bg-band text-muted-foreground',
  running: 'bg-primary/10 text-primary',
  completed: 'bg-momentum/10 text-momentum',
  no_show: 'bg-exception/8 text-exception',
  cancelled: 'bg-band text-muted-foreground',
};

/**
 * The shift at a glance, at the top of the drawer: where it stands, then what
 * was planned against what was worked — before the groups below, which are
 * for changing it.
 */
function ShiftSummary({ record }: { record: ShiftRecord }) {
  const delta = record.startDeltaMinutes ?? 0;
  const first = record.clocked[0];
  const last = record.clocked.at(-1);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', STATE_TONE[record.state])}>
          {WORK_STATE[record.state].label}
        </span>
        {record.status === 'draft' && (
          <span className="rounded-sm border border-dashed border-primary/45 px-1.5 py-0.5 text-micro font-semibold text-muted-foreground">
            Draft
          </span>
        )}
        {delta !== 0 && (
          <span className={cn('text-xs font-semibold', delta > 0 ? 'text-exception' : 'text-momentum')}>
            Started {Math.abs(delta)} min {delta > 0 ? 'late' : 'early'}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <Fact
          surface="card"
          icon={CalendarClock}
          label="Planned"
          value={record.plannedMinutes > 0 ? fmtDuration(record.plannedMinutes) : '—'}
          hint={record.shift ? `${fmtTime(record.shift.startsAt)}–${fmtTime(record.shift.endsAt)}` : undefined}
        />
        <Fact
          surface="card"
          icon={Timer}
          label="Worked"
          value={record.workedMinutes > 0 ? fmtDuration(record.workedMinutes) : '—'}
          hint={first ? `${fmtTime(first.clockedIn)}–${last?.clockedOut ? fmtTime(last.clockedOut) : 'now'}` : 'Not clocked'}
        />
      </dl>
    </div>
  );
}

export function ShiftRecordDrawer(props: ShiftDrawerProps) {
  if (props.target.mode === 'create' && props.target.createKind === 'worked') {
    return <ManualWorkDrawer {...props} />;
  }
  if (props.target.mode === 'edit' && props.target.record && !props.target.record.shift) {
    return <WorkedRecordDrawer {...props} record={props.target.record} />;
  }
  return <PlannedShiftDrawer {...props} />;
}

function WorkedRecordDrawer({ record, canClock, canPlan, onClose }: ShiftDrawerProps & { record: ShiftRecord }) {
  const qc = useQueryClient();
  const completedEntries = record.clocked.filter((entry) => entry.clockedOut);
  const canCreateMatchingShift =
    canClock && canPlan && Boolean(record.userId) && completedEntries.length > 0 && completedEntries.length === record.clocked.length;
  const applyClock = (next: ClockResponse) => {
    const row: Shift = { ...next, durationMinutes: next.durationMinutes ?? undefined };
    const upsert = (list: Shift[] | undefined) =>
      !list
        ? list
        : list.some((item) => item.id === row.id)
          ? list.map((item) => (item.id === row.id ? { ...item, ...row } : item))
          : [row, ...list];
    qc.setQueriesData<Shift[]>({ queryKey: moduleQueryKeys.workforce.key('shifts') }, upsert);
    qc.setQueriesData<Shift[]>({ queryKey: moduleQueryKeys.workforce.key('shifts-active') }, (list) =>
      !list ? list : row.clockedOut ? list.filter((item) => item.id !== row.id) : upsert(list),
    );
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts') });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts-active') });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('variance') });
  };
  const applyClockDeletion = (id: string) => {
    qc.setQueriesData<Shift[]>({ queryKey: moduleQueryKeys.workforce.key('shifts') }, (list) => list?.filter((item) => item.id !== id));
    qc.setQueriesData<Shift[]>({ queryKey: moduleQueryKeys.workforce.key('shifts-active') }, (list) =>
      list?.filter((item) => item.id !== id),
    );
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts') });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts-active') });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('variance') });
  };

  const createMatchingShift = useMutation({
    mutationFn: async () => {
      const startsAt = record.clocked.reduce(
        (earliest, entry) => (entry.clockedIn < earliest ? entry.clockedIn : earliest),
        record.clocked[0]!.clockedIn,
      );
      const endsAt = completedEntries.reduce(
        (latest, entry) => (entry.clockedOut! > latest ? entry.clockedOut! : latest),
        completedEntries[0]!.clockedOut!,
      );
      const created = await createScheduledShift({
        locationId: record.locationId,
        userId: record.userId!,
        startsAt,
        endsAt,
        role: record.role || undefined,
        status: 'published',
        notes: 'Created from recorded worked time.',
      });

      try {
        await Promise.all(record.clocked.map((entry) => adjustShift(entry.id, { scheduledShiftId: created.id })));
      } catch (error) {
        // Avoid leaving a duplicate rota entry if linking the attendance fails.
        await deleteScheduledShift(created.id).catch(() => undefined);
        throw error;
      }
      return created;
    },
    onSuccess: () => {
      invalidateRota(qc);
      qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts') });
      toast('success', 'Matching rota shift created and linked.');
    },
  });

  return (
    <Drawer
      leading={record.userId ? <Avatar name={record.staffName} email={record.staffEmail} size="sm" /> : undefined}
      icon={record.userId ? undefined : Clock}
      title={record.staffName}
      description={`${formatDate(record.at)} · ${record.locationName ?? 'Unknown location'}`}
      onClose={onClose}
    >
      <div className="space-y-5">
        {/* What makes this record different, and its fix, in one strip. */}
        <div className="flex flex-col gap-2.5 rounded-md bg-measured/10 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-measured">Clocked in with no rota shift.</p>
          {canClock && canPlan && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 self-start sm:self-auto"
              onClick={() => createMatchingShift.mutate()}
              disabled={!canCreateMatchingShift || createMatchingShift.isPending}
            >
              <CalendarDays size={14} aria-hidden="true" />
              {createMatchingShift.isPending ? 'Creating…' : 'Create matching rota shift'}
            </Button>
          )}
        </div>

        <div>
          <DrawerSection
            id="worked-hours"
            title="Worked hours"
            action={<span className="text-sm font-semibold text-foreground">{fmtDuration(record.workedMinutes)}</span>}
          >
            {record.clocked.map((entry) => (
              <ClockEntryRow
                key={`${entry.id}:${entry.clockedIn}:${entry.clockedOut ?? 'open'}`}
                entry={entry}
                canEdit={canClock}
                onSaved={applyClock}
                onDeleted={applyClockDeletion}
              />
            ))}
          </DrawerSection>
          {canClock && canPlan && !canCreateMatchingShift && record.clocked.some((entry) => !entry.clockedOut) && (
            <Note>Clock out first, then a matching rota shift can be created.</Note>
          )}
          {!canClock && <Note>Your access doesn’t allow attendance corrections.</Note>}
        </div>

        {createMatchingShift.error && (
          <p role="alert" className="text-sm text-destructive">
            {(createMatchingShift.error as Error).message}
          </p>
        )}
      </div>
    </Drawer>
  );
}

function ManualWorkDrawer({ defaultLocationId, locations, staff, employeesByUser, onClose }: ShiftDrawerProps) {
  const qc = useQueryClient();
  const ids = useId();
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [date, setDate] = useState(() => workspaceDateKey());
  const [userId, setUserId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const times = useMemo(() => toShiftTimes(date, startTime, endTime), [date, startTime, endTime]);
  const workedMinutes = shiftMinutes(times);
  const employee = userId ? employeesByUser.get(userId) : undefined;
  const breakMinutes = unpaidBreakFor(employee, workedMinutes);
  const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
  const hourlyRate = hourlyRateOf(employee);
  const estimatedCost = hourlyRate == null ? null : (hourlyRate * payableMinutes) / 60;

  const record = useMutation({
    mutationFn: () =>
      createManualShift({
        userId,
        locationId,
        clockedIn: times.startsAt,
        clockedOut: times.endsAt,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts') });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts-active') });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('variance') });
      toast('success', 'Worked time recorded.');
      onClose();
    },
  });

  return (
    <Drawer
      icon={Clock}
      title="Record worked time"
      guidance="Adds to attendance and payroll, not to the rota."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{fmtDuration(workedMinutes)}</span> worked
            {estimatedCost != null && ` · ${fmtMoney(estimatedCost)} estimated`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="default"
              onClick={() => record.mutate()}
              disabled={record.isPending || !userId || !locationId || !date || !startTime || !endTime}
            >
              {record.isPending ? 'Recording…' : 'Record hours'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <DrawerSection id={`${ids}-worked`} title="Worked time">
            <FieldLine icon={UsersRound} title="Staff member" htmlFor={`${ids}-staff`} required>
              <Select
                id={`${ids}-staff`}
                value={userId}
                onValueChange={setUserId}
                options={staff.map((member) => ({ value: member.userId, label: member.name ?? member.email ?? member.userId }))}
                ariaLabel="Staff member"
                placeholder="Choose a staff member"
                className="w-full"
              />
            </FieldLine>
            <FieldLine icon={MapPin} title="Location" htmlFor={`${ids}-location`} required>
              <Select
                id={`${ids}-location`}
                value={locationId}
                onValueChange={setLocationId}
                options={locations.map((location) => ({ value: location.id, label: location.name }))}
                ariaLabel="Location"
                placeholder="Choose a location"
                className="w-full"
              />
            </FieldLine>
            <FieldLine icon={CalendarDays} title="Date worked" htmlFor={`${ids}-date`} required>
              <DatePicker id={`${ids}-date`} value={date} onValueChange={setDate} required aria-label="Date worked" />
            </FieldLine>
            <FieldLine icon={Clock} title="Hours" htmlFor={`${ids}-start`} required>
              <TimeRange startId={`${ids}-start`} start={startTime} end={endTime} onStart={setStartTime} onEnd={setEndTime} />
            </FieldLine>
          </DrawerSection>
          {breakMinutes > 0 && <Note>{fmtDuration(payableMinutes)} payable after the usual unpaid break.</Note>}
        </div>

        {record.error && (
          <p role="alert" className="text-sm text-destructive">
            {(record.error as Error).message}
          </p>
        )}
      </div>
    </Drawer>
  );
}

function PlannedShiftDrawer({
  target,
  defaultLocationId,
  locations,
  staff,
  employeesByUser,
  money,
  canClock,
  canPlan,
  positions = [],
  positionsOf,
  onClose,
}: ShiftDrawerProps) {
  const qc = useQueryClient();
  const ids = useId();
  const editing = target.mode === 'edit' ? (target.record ?? null) : null;
  const prefill = target.record ?? null;
  const shift = editing?.shift ?? null;

  const initialStart = shift ? new Date(shift.startsAt) : prefill?.clocked[0] ? new Date(prefill.clocked[0].clockedIn) : null;
  const initialEnd = shift
    ? new Date(shift.endsAt)
    : prefill?.clocked.at(-1)?.clockedOut
      ? new Date(prefill.clocked.at(-1)!.clockedOut!)
      : null;

  const [locationId, setLocationId] = useState(prefill?.locationId ?? defaultLocationId);
  const [date, setDate] = useState(target.date ?? workspaceDateKey(initialStart ?? new Date()));
  const [startTime, setStartTime] = useState(initialStart ? toTimeInput(initialStart) : '09:00');
  const [endTime, setEndTime] = useState(initialEnd ? toTimeInput(initialEnd) : '17:00');
  // A shift is one person's — an empty value leaves it as an open slot.
  const [userId, setUserId] = useState<string>(prefill?.userId ?? target.userId ?? '');
  const [role, setRole] = useState(prefill?.role ?? '');
  const [status, setStatus] = useState<ScheduledShiftStatus>(shift?.status ?? 'draft');
  const [notes, setNotes] = useState(prefill?.notes ?? '');
  const [positionId, setPositionId] = useState(shift?.positionId ?? '');
  // Null until typed: the break then follows the employment record (or the saved shift).
  const [breakText, setBreakText] = useState<string | null>(null);
  // Empty = no repeat: just the one shift on the picked date.
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [weeks, setWeeks] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingWorked, setAddingWorked] = useState(false);

  function toggleDay(day: number) {
    setRepeatDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  const occurrences = useMemo(
    () =>
      editing || repeatDays.length === 0
        ? [toShiftTimes(date, startTime, endTime)]
        : buildOccurrences(date, startTime, endTime, repeatDays, weeks),
    [editing, date, startTime, endTime, repeatDays, weeks],
  );
  const first = occurrences[0];
  const plannedMinutes = first ? shiftMinutes(first) : 0;
  const shiftCount = occurrences.length;

  // Break and pay follow the assigned person's own employment record.
  const employee = userId ? employeesByUser.get(userId) : undefined;
  const recordBreak = unpaidBreakFor(employee, plannedMinutes);
  const typedBreak = breakText === null ? null : Math.round(Number(breakText));
  const breakMinutes =
    typedBreak !== null && Number.isFinite(typedBreak) ? Math.min(240, Math.max(0, typedBreak)) : (shift?.breakMinutes ?? recordBreak);
  const breakFromRecord = breakText === null && shift?.breakMinutes == null && recordBreak > 0;
  const hourlyRate = hourlyRateOf(employee);
  const payableMinutes = Math.max(0, plannedMinutes - breakMinutes);
  const estimatedCost = hourlyRate != null ? (hourlyRate * payableMinutes * occurrences.length) / 60 : 0;

  const position =
    positions.find((p) => p.id === positionId) ?? (shift?.position && shift.position.id === positionId ? shift.position : null);
  const untrained = !!userId && !!positionId && !!positionsOf && !positionsOf(userId).includes(positionId);
  // The position name doubles as the old free-text role, so older screens still read it.
  const roleToSave = position ? position.name : role || undefined;

  const invalidate = () => invalidateRota(qc);

  const save = useMutation({
    mutationFn: async () => {
      if (editing && shift) {
        const times = toShiftTimes(date, startTime, endTime);
        await updateScheduledShift(shift.id, {
          // Only sent when the assignment actually changed; null opens the slot.
          ...(userId !== (shift.userId ?? '') ? { userId: userId || null } : {}),
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          role: roleToSave,
          status,
          notes: notes || undefined,
          positionId: positionId || null,
          breakMinutes,
        });
        return 1;
      }
      // Sequential keeps the API happy and failures easy to reason about.
      for (const occ of occurrences) {
        await createScheduledShift({
          locationId,
          // Create takes a user id or the key omitted entirely — never null.
          ...(userId ? { userId } : {}),
          startsAt: occ.startsAt,
          endsAt: occ.endsAt,
          role: roleToSave,
          status,
          notes: notes || undefined,
          ...(positionId ? { positionId } : {}),
          breakMinutes,
        });
      }
      return occurrences.length;
    },
    onSuccess: (count) => {
      invalidate();
      toast('success', editing ? 'Shift updated.' : `${count} shift${count === 1 ? '' : 's'} created.`);
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteScheduledShift(shift!.id),
    onSuccess: () => {
      invalidate();
      toast('success', 'Shift deleted.');
      onClose();
    },
  });

  const error = (save.error ?? remove.error) as Error | undefined;
  const clocked = editing?.clocked ?? [];
  const running = clocked.find((entry) => !entry.clockedOut);

  // ── Running the clock on someone else's behalf (store_manager+) ─────────────

  /**
   * Fold the clock record the API just returned into the cached lists, so the
   * row and this drawer both update on the spot; the refetch that follows only
   * confirms it.
   */
  const applyClock = (next: ClockResponse) => {
    const row: Shift = { ...next, durationMinutes: next.durationMinutes ?? undefined };
    const upsert = (list: Shift[] | undefined) =>
      !list ? list : list.some((s) => s.id === row.id) ? list.map((s) => (s.id === row.id ? { ...s, ...row } : s)) : [row, ...list];

    qc.setQueriesData<Shift[]>({ queryKey: moduleQueryKeys.workforce.key('shifts') }, upsert);
    // A closed shift is no longer active.
    qc.setQueriesData<Shift[]>({ queryKey: moduleQueryKeys.workforce.key('shifts-active') }, (list) =>
      !list ? list : row.clockedOut ? list.filter((s) => s.id !== row.id) : upsert(list),
    );
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts') });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts-active') });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('variance') });
  };
  const applyClockDeletion = (id: string) => {
    qc.setQueriesData<Shift[]>({ queryKey: moduleQueryKeys.workforce.key('shifts') }, (list) => list?.filter((item) => item.id !== id));
    qc.setQueriesData<Shift[]>({ queryKey: moduleQueryKeys.workforce.key('shifts-active') }, (list) =>
      list?.filter((item) => item.id !== id),
    );
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts') });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('shifts-active') });
    qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('variance') });
  };

  const startClock = useMutation({
    mutationFn: () =>
      createManualShift({
        userId: editing!.userId!,
        locationId: editing!.locationId,
        ...(shift ? { scheduledShiftId: shift.id } : {}),
      }),
    onSuccess: (created) => {
      applyClock(created);
      toast('success', `${editing?.staffName} clocked in.`);
    },
  });

  const stopClock = useMutation({
    mutationFn: (entryId: string) => adjustShift(entryId, { clockedOut: new Date().toISOString() }),
    onSuccess: (updated) => {
      applyClock(updated);
      toast('success', `${editing?.staffName} clocked out.`);
    },
  });

  const clockBusy = startClock.isPending || stopClock.isPending;
  const clockError = (startClock.error ?? stopClock.error) as Error | undefined;

  return (
    <Drawer
      leading={editing?.userId ? <Avatar name={editing.staffName} email={editing.staffEmail} size="sm" /> : undefined}
      icon={editing?.userId ? undefined : CalendarClock}
      title={editing ? editing.staffName : 'Plan a shift'}
      description={editing ? [formatDate(editing.at), editing.locationName].filter(Boolean).join(' · ') : undefined}
      actions={
        editing && shift && canPlan ? (
          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Delete shift">
            <Trash2 size={16} className="text-destructive" />
          </Button>
        ) : undefined
      }
      onClose={onClose}
      footer={
        canPlan ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {money && estimatedCost > 0 ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground">Total bill</p>
                  <p className="flex items-center gap-2 text-lg font-semibold tabular-nums text-foreground">
                    {fmtMoney(estimatedCost)}
                    <IconTag
                      icon={Banknote}
                      label={editing?.billState === 'paid' ? 'Paid' : 'Not paid yet'}
                      tone={editing?.billState === 'paid' ? 'success' : 'warning'}
                      tile
                    />
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {shiftCount} {shiftCount === 1 ? 'shift' : 'shifts'} · {fmtDuration(plannedMinutes)} each
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="default" onClick={onClose}>
                Cancel
              </Button>
              <Button size="default" onClick={() => save.mutate()} disabled={save.isPending || occurrences.length === 0 || !locationId}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {editing && <ShiftSummary record={editing} />}

        {/* ── The plan ──────────────────────────────────────────────────── */}
        <div>
          <DrawerSection id={`${ids}-plan`} title="Shift">
            {!editing && (
              // A shift can't move between locations once it exists.
              <FieldLine icon={MapPin} title="Location" htmlFor={`${ids}-location`} required>
                <Select
                  id={`${ids}-location`}
                  value={locationId}
                  onValueChange={setLocationId}
                  options={locations.map((location) => ({ value: location.id, label: location.name }))}
                  ariaLabel="Location"
                  className="w-full"
                  disabled={!canPlan}
                />
              </FieldLine>
            )}
            <FieldLine icon={UsersRound} title="Worker" htmlFor={`${ids}-worker`}>
              <Select
                id={`${ids}-worker`}
                value={userId}
                onValueChange={setUserId}
                options={[
                  { value: '', label: 'Open slot — nobody assigned' },
                  ...staff.map((member) => ({ value: member.userId, label: member.name ?? member.email ?? member.userId })),
                ]}
                ariaLabel="Assigned worker"
                className="w-full"
                disabled={!canPlan}
              />
            </FieldLine>
            <FieldLine icon={CalendarDays} title="Date" htmlFor={`${ids}-date`} required>
              <DatePicker
                id={`${ids}-date`}
                value={date}
                onValueChange={setDate}
                required
                disabled={!canPlan}
                aria-label="Assignment date"
              />
            </FieldLine>
            <FieldLine icon={Clock} title="Hours" htmlFor={`${ids}-start`} required>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <TimeRange
                  startId={`${ids}-start`}
                  start={startTime}
                  end={endTime}
                  onStart={setStartTime}
                  onEnd={setEndTime}
                  disabled={!canPlan}
                  labels={['Shift start', 'Shift end']}
                />
                <span className="text-xs text-muted-foreground">{fmtDuration(plannedMinutes)}</span>
              </div>
            </FieldLine>
            <FieldLine icon={Coffee} title="Break" htmlFor={`${ids}-break`}>
              <span className="flex items-center gap-2">
                <input
                  id={`${ids}-break`}
                  inputMode="numeric"
                  value={breakText ?? String(breakMinutes)}
                  onChange={(e) => setBreakText(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                  className={cn(inp, 'w-20 tabular-nums')}
                  disabled={!canPlan}
                  aria-describedby={breakFromRecord ? `${ids}-break-hint` : undefined}
                />
                <span className="text-xs text-muted-foreground">min unpaid</span>
              </span>
              {breakFromRecord && (
                <p id={`${ids}-break-hint`} className="mt-1.5 text-xs text-muted-foreground">
                  From the employment record.
                </p>
              )}
            </FieldLine>
            {positions.length > 0 || shift?.position ? (
              <FieldLine icon={Tag} title="Position" htmlFor={`${ids}-position`}>
                <Select
                  id={`${ids}-position`}
                  value={positionId}
                  onValueChange={setPositionId}
                  options={[
                    { value: '', label: 'No position' },
                    ...positions.map((p) => ({ value: p.id, label: p.name })),
                    ...(shift?.position && !positions.some((p) => p.id === shift.position!.id)
                      ? [{ value: shift.position.id, label: shift.position.name }]
                      : []),
                  ]}
                  ariaLabel="Position"
                  className="w-full"
                  disabled={!canPlan}
                />
                {untrained && <p className="mt-1.5 text-xs font-medium text-warning">Not trained for this position</p>}
              </FieldLine>
            ) : (
              <FieldLine icon={Tag} title="Role" htmlFor={`${ids}-role`}>
                <input
                  id={`${ids}-role`}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Barista"
                  className={inp}
                  disabled={!canPlan}
                />
              </FieldLine>
            )}
            <FieldLine icon={ListChecks} title="Status" htmlFor={`${ids}-status`} required>
              {canPlan ? (
                <SegmentedControl
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'published', label: 'Published' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]}
                  value={status}
                  onChange={(value) => setStatus(value as ScheduledShiftStatus)}
                  ariaLabel="Shift status"
                />
              ) : (
                <span id={`${ids}-status`} className="text-sm text-foreground">
                  {status === 'draft' ? 'Draft' : status === 'published' ? 'Published' : 'Cancelled'}
                </span>
              )}
              {status !== 'published' && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {status === 'draft' ? 'Only managers see a draft until it’s published.' : 'Kept for the record, off the rota.'}
                </p>
              )}
            </FieldLine>
            <FieldLine icon={FileText} title="Notes" htmlFor={`${ids}-notes`}>
              <input
                id={`${ids}-notes`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className={inp}
                disabled={!canPlan}
              />
            </FieldLine>
          </DrawerSection>
          {editing && <Note>Changes apply to this shift only, not to its repeats.</Note>}
        </div>

        {/* ── Repeat — creating only; each occurrence becomes its own shift ── */}
        {!editing && (
          <div>
            <DrawerSection id={`${ids}-repeat`} title="Repeat weekly">
              <FieldLine icon={Repeat} title="On" htmlFor={`${ids}-repeat-mon`}>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map(({ day, label }) => {
                    const active = repeatDays.includes(day);
                    return (
                      <button
                        key={day}
                        id={day === 1 ? `${ids}-repeat-mon` : undefined}
                        type="button"
                        onClick={() => toggleDay(day)}
                        aria-pressed={active}
                        className={cn(
                          'h-9 min-w-11 rounded-md border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                          active
                            ? 'border-primary bg-primary/8 text-primary'
                            : 'border-border bg-control text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </FieldLine>
              {repeatDays.length > 0 && (
                <FieldLine icon={CalendarClock} title="For" htmlFor={`${ids}-weeks`}>
                  <Select
                    id={`${ids}-weeks`}
                    value={String(weeks)}
                    onValueChange={(value) => setWeeks(Number(value))}
                    options={[
                      { value: '1', label: 'Just this week' },
                      ...[2, 3, 4, 6, 8, 12].map((count) => ({ value: String(count), label: `For ${count} weeks` })),
                    ]}
                    ariaLabel="Repeat duration"
                    className="w-full"
                  />
                </FieldLine>
              )}
            </DrawerSection>
            {repeatDays.length > 0 && (
              <Note>
                Creates {shiftCount} {shiftCount === 1 ? 'shift' : 'shifts'}
                {shiftCount > 1 ? ' — each can be edited or deleted on its own.' : '.'}
              </Note>
            )}
          </div>
        )}

        {/* ── What was actually clocked — a manager can run the clock on the
            member's behalf and correct the times afterwards. ────────────── */}
        {editing && (
          <div>
            <DrawerSection
              id={`${ids}-clock`}
              title="Clocked time"
              action={
                canClock ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!running && editing.userId && !addingWorked && (
                      <Button variant="ghost" size="sm" onClick={() => setAddingWorked(true)} className="gap-1.5">
                        <Plus size={13} /> Add hours
                      </Button>
                    )}
                    {running ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => stopClock.mutate(running.id)}
                        disabled={clockBusy}
                        className="gap-1.5"
                      >
                        <LogOut size={13} /> {stopClock.isPending ? 'Stopping…' : 'Stop shift'}
                      </Button>
                    ) : (
                      editing.userId && (
                        <Button variant="outline" size="sm" onClick={() => startClock.mutate()} disabled={clockBusy} className="gap-1.5">
                          <LogIn size={13} /> {startClock.isPending ? 'Starting…' : 'Start shift now'}
                        </Button>
                      )
                    )}
                  </div>
                ) : undefined
              }
            >
              {clocked.map((entry) => (
                // Remount when the entry's times change so the editable
                // fields re-seed instead of holding the old value.
                <ClockEntryRow
                  key={`${entry.id}:${entry.clockedIn}:${entry.clockedOut ?? 'open'}`}
                  entry={entry}
                  canEdit={canClock}
                  onSaved={applyClock}
                  onDeleted={applyClockDeletion}
                />
              ))}
              {clocked.length === 0 && !addingWorked && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  {editing.state === 'no_show' ? 'Nobody clocked in for this shift.' : 'Not clocked in yet.'}
                </p>
              )}
              {addingWorked && <AddWorkedPeriod record={editing} onSaved={applyClock} onCancel={() => setAddingWorked(false)} />}
            </DrawerSection>
            {clocked.length > 0 && (
              <Note tone={editing.startDeltaMinutes && editing.startDeltaMinutes > 5 ? 'warning' : 'muted'}>
                {fmtDuration(editing.workedMinutes)} on the clock
                {editing.startDeltaMinutes != null && editing.startDeltaMinutes !== 0
                  ? ` · started ${Math.abs(editing.startDeltaMinutes)} min ${editing.startDeltaMinutes > 0 ? 'late' : 'early'}`
                  : ''}
                {editing.paidMinutes !== editing.workedMinutes ? ` · ${fmtDuration(editing.paidMinutes)} payable` : ''}
              </Note>
            )}
            {clockError && <p className="mt-2 px-1 text-sm text-destructive">{clockError.message}</p>}
          </div>
        )}

        {/* ── Estimated cost ────────────────────────────────────────────── */}
        {money && (
          <div>
            <DrawerSection id={`${ids}-cost`} title="Estimated cost">
              {hourlyRate == null ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  {!userId ? 'Assign someone to estimate the cost.' : 'No hourly rate on file — salaried staff are costed by payroll.'}
                </p>
              ) : (
                <>
                  <ValueLine label="Payable hours" value={`${(payableMinutes / 60).toFixed(2)} h`} />
                  <ValueLine label="Hourly rate" value={`${fmtMoney(hourlyRate)}/h`} />
                  {occurrences.length > 1 && <ValueLine label="Shifts" value={occurrences.length} />}
                  <ValueLine label="Estimated total" value={fmtMoney(estimatedCost)} strong />
                </>
              )}
            </DrawerSection>
            {hourlyRate != null && <Note>From the planned hours — payroll pays the clocked hours, capped at what was scheduled.</Note>}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error.message}</p>}
      </div>

      {confirmDelete && shift && (
        <ConfirmModal
          title="Delete this shift?"
          message="The rota entry is removed for good. Clocked time already recorded against it stays in the timesheet."
          confirmLabel="Delete shift"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Drawer>
  );
}
