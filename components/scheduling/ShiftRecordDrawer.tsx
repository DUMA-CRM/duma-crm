'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  Banknote,
  CalendarDays,
  Clock,
  Coffee,
  FileText,
  type IconComponent,
  Info,
  ListChecks,
  LogIn,
  LogOut,
  MapPin,
  Plus,
  Radio,
  Repeat,
  Tag,
  Trash2,
  UsersRound,
} from '@/components/icons';
import { Avatar, fmtMoney } from '@/components/people/shared';
import {
  type ShiftRecord,
  WEEKDAYS,
  WORK_STATE,
  buildOccurrences,
  fmtDuration,
  fmtTime,
  inp,
  sel,
  shiftMinutes,
  toDateInput,
  toShiftTimes,
  toTimeInput,
} from '@/components/scheduling/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';

import type { HrEmployee } from '@/lib/api/hr.service';
import { type ScheduledShiftStatus, createScheduledShift, deleteScheduledShift, updateScheduledShift } from '@/lib/api/scheduling.service';
import { type Shift, adjustShift, createManualShift, deleteShift } from '@/lib/api/shifts.service';
import type { StaffProfile } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';

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

function Field({ icon: Icon, label, children }: { icon: IconComponent; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-4">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon size={15} aria-hidden="true" className="shrink-0" />
        {label}
      </span>
      {children}
    </div>
  );
}

function Hint({ tone, children }: { tone: 'success' | 'warning' | 'muted'; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'mt-2 rounded-sm border px-3 py-2 text-xs font-medium',
        tone === 'success' && 'border-success/20 bg-success/6 text-success',
        tone === 'warning' && 'border-warning/20 bg-warning/6 text-warning',
        tone === 'muted' && 'border-rule bg-band text-muted-foreground',
      )}
    >
      {children}
    </p>
  );
}

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-rule bg-band p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** What the manual clock endpoints hand back: the shift plus its length once closed. */
type ClockResponse = Shift & { durationMinutes: number | null };

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
  const originalDay = toDateInput(new Date(entry.clockedIn));
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
        clockedIn: times ? times.startsAt : new Date(`${day}T${inTime}`).toISOString(),
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
      <div className="flex items-center justify-between rounded-sm border border-rule bg-card px-3 py-2 text-sm">
        <span className="tabular-nums text-foreground">
          {fmtTime(entry.clockedIn)} – {entry.clockedOut ? fmtTime(entry.clockedOut) : '—:—'}
        </span>
        {minutes != null ? (
          <span className="text-xs tabular-nums text-muted-foreground">{fmtDuration(minutes)}</span>
        ) : (
          <Badge variant="primary">Running</Badge>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-rule bg-card p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(8.5rem,1fr)_6.75rem_6.75rem_auto] sm:items-end">
        <div className="space-y-1 text-xs font-medium text-muted-foreground">
          <span>Date</span>
          <DatePicker value={day} onValueChange={setDay} aria-label="Date worked" />
        </div>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          <span>Started</span>
          <input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} aria-label="Clocked in" className={inp} />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          <span>Finished</span>
          <input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} aria-label="Clocked out" className={inp} />
        </label>
        <div className="flex items-center gap-1.5">
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
      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        {minutes != null ? (
          <span className="tabular-nums text-muted-foreground">{fmtDuration(minutes)} worked</span>
        ) : (
          <Badge variant="primary">Running</Badge>
        )}
        {dirty && !missingFinish && <span className="text-primary">Unsaved correction</span>}
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

function AddWorkedPeriod({ record, onSaved }: { record: ShiftRecord; onSaved: (shift: ClockResponse) => void }) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      toast('success', 'Worked time added.');
    },
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={!record.userId} className="gap-1.5">
        <Plus size={13} /> Add worked hours
      </Button>
    );
  }

  return (
    <div className="mt-3 rounded-sm border border-primary/25 bg-card p-3">
      <p className="mb-3 text-sm font-semibold text-foreground">Add a missed work period</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(8.5rem,1fr)_6.75rem_6.75rem]">
        <div className="space-y-1 text-xs font-medium text-muted-foreground">
          <span>Date</span>
          <DatePicker value={date} onValueChange={setDate} aria-label="Date worked" />
        </div>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          <span>Started</span>
          <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={inp} />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          <span>Finished</span>
          <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={inp} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-muted-foreground">{fmtDuration(shiftMinutes(times))} worked</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
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
}

interface ShiftRecordDrawerProps {
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
  onClose: () => void;
}

export function ShiftRecordDrawer(props: ShiftRecordDrawerProps) {
  if (props.target.mode === 'create' && props.target.createKind === 'worked') {
    return <ManualWorkDrawer {...props} />;
  }
  if (props.target.mode === 'edit' && props.target.record && !props.target.record.shift) {
    return <WorkedRecordDrawer {...props} record={props.target.record} />;
  }
  return <PlannedShiftDrawer {...props} />;
}

function WorkedRecordDrawer({ record, canClock, onClose }: ShiftRecordDrawerProps & { record: ShiftRecord }) {
  const qc = useQueryClient();
  const applyClock = (next: ClockResponse) => {
    const row: Shift = { ...next, durationMinutes: next.durationMinutes ?? undefined };
    const upsert = (list: Shift[] | undefined) =>
      !list
        ? list
        : list.some((item) => item.id === row.id)
          ? list.map((item) => (item.id === row.id ? { ...item, ...row } : item))
          : [row, ...list];
    qc.setQueriesData<Shift[]>({ queryKey: ['shifts'] }, upsert);
    qc.setQueriesData<Shift[]>({ queryKey: ['shifts-active'] }, (list) =>
      !list ? list : row.clockedOut ? list.filter((item) => item.id !== row.id) : upsert(list),
    );
    qc.invalidateQueries({ queryKey: ['shifts'] });
    qc.invalidateQueries({ queryKey: ['shifts-active'] });
    qc.invalidateQueries({ queryKey: ['variance'] });
  };
  const applyClockDeletion = (id: string) => {
    qc.setQueriesData<Shift[]>({ queryKey: ['shifts'] }, (list) => list?.filter((item) => item.id !== id));
    qc.setQueriesData<Shift[]>({ queryKey: ['shifts-active'] }, (list) => list?.filter((item) => item.id !== id));
    qc.invalidateQueries({ queryKey: ['shifts'] });
    qc.invalidateQueries({ queryKey: ['shifts-active'] });
    qc.invalidateQueries({ queryKey: ['variance'] });
  };

  return (
    <Drawer title="Worked without a rota shift" description={`${record.staffName} · ${formatDate(record.at)}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-sm border border-warning/30 bg-warning/6 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Attendance recorded, no shift was planned</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Correct the worked date or times below. This does not create or change the rota.
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-3 rounded-sm border border-rule bg-band p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Staff member</dt>
            <dd className="mt-1 font-semibold text-foreground">{record.staffName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Location</dt>
            <dd className="mt-1 font-semibold text-foreground">{record.locationName ?? 'Unknown location'}</dd>
          </div>
        </dl>
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Worked hours</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Each work period is saved separately.</p>
            </div>
            <Badge variant="success">{fmtDuration(record.workedMinutes)}</Badge>
          </div>
          <div className="space-y-2">
            {record.clocked.map((entry) => (
              <ClockEntryRow
                key={`${entry.id}:${entry.clockedIn}:${entry.clockedOut ?? 'open'}`}
                entry={entry}
                canEdit={canClock}
                onSaved={applyClock}
                onDeleted={applyClockDeletion}
              />
            ))}
          </div>
        </section>
        {!canClock && <Hint tone="muted">You can review this record, but your access does not allow attendance corrections.</Hint>}
      </div>
    </Drawer>
  );
}

function ManualWorkDrawer({ defaultLocationId, locations, staff, employeesByUser, onClose }: ShiftRecordDrawerProps) {
  const qc = useQueryClient();
  const [locationId, setLocationId] = useState(defaultLocationId);
  const [date, setDate] = useState(toDateInput(new Date()));
  const [userId, setUserId] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const staffById = useMemo(() => new Map(staff.map((member) => [member.userId, member])), [staff]);
  const assigned = userId ? staffById.get(userId) : undefined;
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
      qc.invalidateQueries({ queryKey: ['shifts'] });
      qc.invalidateQueries({ queryKey: ['shifts-active'] });
      qc.invalidateQueries({ queryKey: ['variance'] });
      toast('success', 'Worked time recorded.');
      onClose();
    },
  });

  return (
    <Drawer
      title="Record worked time"
      description="Add hours that were worked without a clock record or rota shift."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{fmtDuration(workedMinutes)}</span> worked
            {estimatedCost != null && ` · ${fmtMoney(estimatedCost)} estimated`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="lg"
              onClick={() => record.mutate()}
              disabled={record.isPending || !userId || !locationId || !date || !startTime || !endTime}
            >
              {record.isPending ? 'Recording…' : 'Record hours'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-sm border border-rule bg-band px-4 py-3">
          <p className="text-sm font-semibold text-foreground">This records what actually happened</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It will appear in attendance and payroll, but it will not add a shift to the rota.
          </p>
        </div>

        <div className="space-y-4">
          <Field icon={UsersRound} label="Staff member">
            <div className="flex items-center gap-2">
              {assigned && (
                <span className="shrink-0 *:size-9 *:rounded-sm">
                  <Avatar name={assigned.name} email={assigned.email} />
                </span>
              )}
              <Select
                value={userId}
                onValueChange={setUserId}
                options={staff.map((member) => ({ value: member.userId, label: member.name ?? member.email ?? member.userId }))}
                ariaLabel="Staff member"
                placeholder="Choose a staff member"
                className="w-full"
              />
            </div>
          </Field>
          <Field icon={MapPin} label="Location">
            <Select
              value={locationId}
              onValueChange={setLocationId}
              options={locations.map((location) => ({ value: location.id, label: location.name }))}
              ariaLabel="Location"
              placeholder="Choose a location"
              className="w-full"
            />
          </Field>
          <Field icon={CalendarDays} label="Date worked">
            <DatePicker value={date} onValueChange={setDate} required aria-label="Date worked" />
          </Field>
        </div>

        <Card title="Worked hours">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm text-muted-foreground">
              <span>Started</span>
              <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required className={inp} />
            </label>
            <label className="space-y-1.5 text-sm text-muted-foreground">
              <span>Finished</span>
              <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required className={inp} />
            </label>
          </div>
          <Hint tone="success">
            {fmtDuration(workedMinutes)} worked{breakMinutes > 0 ? ` · ${fmtDuration(payableMinutes)} payable after the usual break` : ''}
          </Hint>
        </Card>

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
  onClose,
}: ShiftRecordDrawerProps) {
  const qc = useQueryClient();
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
  const [date, setDate] = useState(target.date ?? (initialStart ? toDateInput(initialStart) : toDateInput(new Date())));
  const [startTime, setStartTime] = useState(initialStart ? toTimeInput(initialStart) : '09:00');
  const [endTime, setEndTime] = useState(initialEnd ? toTimeInput(initialEnd) : '17:00');
  // A shift is one person's — an empty value leaves it as an open slot.
  const [userId, setUserId] = useState<string>(prefill?.userId ?? '');
  const [role, setRole] = useState(prefill?.role ?? '');
  const [status, setStatus] = useState<ScheduledShiftStatus>(shift?.status ?? 'draft');
  const [notes, setNotes] = useState(prefill?.notes ?? '');
  // Empty = no repeat: just the one shift on the picked date.
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [weeks, setWeeks] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const staffById = useMemo(() => new Map(staff.map((member) => [member.userId, member])), [staff]);

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
  const breakMinutes = unpaidBreakFor(employee, plannedMinutes);
  const hourlyRate = hourlyRateOf(employee);
  const payableMinutes = Math.max(0, plannedMinutes - breakMinutes);
  const estimatedCost = hourlyRate != null ? (hourlyRate * payableMinutes * occurrences.length) / 60 : 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['scheduled-shifts'] });
    qc.invalidateQueries({ queryKey: ['variance'] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editing && shift) {
        const times = toShiftTimes(date, startTime, endTime);
        await updateScheduledShift(shift.id, {
          // Only sent when the assignment actually changed; null opens the slot.
          ...(userId !== (shift.userId ?? '') ? { userId: userId || null } : {}),
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          role: role || undefined,
          status,
          notes: notes || undefined,
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
          role: role || undefined,
          status,
          notes: notes || undefined,
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

  const assigned = userId ? staffById.get(userId) : undefined;
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

    qc.setQueriesData<Shift[]>({ queryKey: ['shifts'] }, upsert);
    // A closed shift is no longer active.
    qc.setQueriesData<Shift[]>({ queryKey: ['shifts-active'] }, (list) =>
      !list ? list : row.clockedOut ? list.filter((s) => s.id !== row.id) : upsert(list),
    );
    qc.invalidateQueries({ queryKey: ['shifts'] });
    qc.invalidateQueries({ queryKey: ['shifts-active'] });
    qc.invalidateQueries({ queryKey: ['variance'] });
  };
  const applyClockDeletion = (id: string) => {
    qc.setQueriesData<Shift[]>({ queryKey: ['shifts'] }, (list) => list?.filter((item) => item.id !== id));
    qc.setQueriesData<Shift[]>({ queryKey: ['shifts-active'] }, (list) => list?.filter((item) => item.id !== id));
    qc.invalidateQueries({ queryKey: ['shifts'] });
    qc.invalidateQueries({ queryKey: ['shifts-active'] });
    qc.invalidateQueries({ queryKey: ['variance'] });
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
      title={editing ? 'Review shift' : 'Plan a shift'}
      description={
        editing ? `${editing.staffName} · ${formatDate(editing.at)}` : 'Plan the shift, assign who works it, and see what it will cost.'
      }
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
                    <Badge variant={editing?.billState === 'paid' ? 'success' : 'warning'} className="capitalize">
                      {editing?.billState === 'paid' ? 'Paid' : 'Pending'}
                    </Badge>
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {shiftCount} {shiftCount === 1 ? 'shift' : 'shifts'} · {fmtDuration(plannedMinutes)} each
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="lg" onClick={onClose}>
                Cancel
              </Button>
              <Button size="lg" onClick={() => save.mutate()} disabled={save.isPending || occurrences.length === 0 || !locationId}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {/* Identity */}
        <div className="space-y-3.5">
          <Field icon={MapPin} label="Location">
            <Select
              value={locationId}
              onValueChange={setLocationId}
              options={locations.map((location) => ({ value: location.id, label: location.name }))}
              ariaLabel="Location"
              className="w-full"
              disabled={!!editing || !canPlan}
            />
          </Field>

          <Field icon={CalendarDays} label="Assignment date">
            <DatePicker value={date} onValueChange={setDate} required disabled={!canPlan} aria-label="Assignment date" />
          </Field>

          <Field icon={UsersRound} label="Assigned worker">
            <div className="flex items-center gap-2">
              {assigned && (
                <span className="shrink-0 *:size-9 *:rounded-sm">
                  <Avatar name={assigned.name} email={assigned.email} />
                </span>
              )}
              <Select
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
            </div>
          </Field>

          <Field icon={Tag} label="Role">
            <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Barista" className={inp} disabled={!canPlan} />
          </Field>

          <Field icon={ListChecks} label="Shift status">
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as ScheduledShiftStatus)}
              options={[
                { value: 'draft', label: 'Draft — not visible to staff' },
                { value: 'published', label: 'Published' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              ariaLabel="Shift status"
              className="w-full"
              disabled={!canPlan}
            />
          </Field>

          <Field icon={FileText} label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inp} disabled={!canPlan} />
          </Field>
        </div>

        {/* Planned times */}
        <Card title="Planned hours">
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex min-w-36 items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock size={15} className="text-success" aria-hidden="true" />
                  Shift <span className="font-normal text-muted-foreground">(From – To)</span>
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    aria-label="Shift start"
                    className={cn(inp, 'w-32')}
                    disabled={!canPlan}
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    aria-label="Shift end"
                    className={cn(inp, 'w-32')}
                    disabled={!canPlan}
                  />
                </div>
              </div>
              <Hint tone="success">{fmtDuration(plannedMinutes)} will be planned on the rota.</Hint>
            </div>

            {breakMinutes > 0 && (
              <div>
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Coffee size={15} className="text-warning" aria-hidden="true" />
                  Unpaid break
                </span>
                <Hint tone="warning">
                  {breakMinutes} minutes will be deducted as break time — set on the employment record, not this shift.
                </Hint>
              </div>
            )}

            {/* What was actually clocked — a manager can run the clock on the
                member's behalf and correct the times afterwards. */}
            {editing && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Radio size={15} className="text-primary" aria-hidden="true" />
                    Clocked time
                  </span>
                  {canClock && (
                    <div className="flex flex-wrap items-center gap-2">
                      {!running && editing.userId && <AddWorkedPeriod record={editing} onSaved={applyClock} />}
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
                  )}
                </div>
                {clocked.length === 0 ? (
                  <Hint tone="muted">
                    {editing.state === 'no_show' ? 'Nobody clocked in for this shift.' : 'Not clocked in yet.'}
                    {canClock && editing.userId && ' Start the clock for them if they forgot.'}
                  </Hint>
                ) : (
                  <div className="mt-2 space-y-1.5">
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
                    <Hint tone={editing.startDeltaMinutes && editing.startDeltaMinutes > 5 ? 'warning' : 'success'}>
                      {fmtDuration(editing.workedMinutes)} on the clock
                      {editing.startDeltaMinutes != null && editing.startDeltaMinutes !== 0
                        ? ` · started ${Math.abs(editing.startDeltaMinutes)} min ${editing.startDeltaMinutes > 0 ? 'late' : 'early'}`
                        : ''}
                      {editing.paidMinutes !== editing.workedMinutes ? ` · ${fmtDuration(editing.paidMinutes)} payable` : ''}
                    </Hint>
                  </div>
                )}
                {clockError && <p className="mt-2 text-sm text-destructive">{clockError.message}</p>}
              </div>
            )}
          </div>
        </Card>

        {/* Repeat — creating only; each occurrence becomes its own editable shift. */}
        {!editing && (
          <Card
            title={
              <span className="inline-flex items-center gap-1.5">
                <Repeat size={14} /> Repeat weekly
              </span>
            }
          >
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map(({ day, label }) => {
                  const active = repeatDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      aria-pressed={active}
                      className={cn(
                        'h-8 rounded-sm border px-2.5 text-xs font-semibold transition-colors',
                        active
                          ? 'border-primary bg-band text-primary'
                          : 'border-rule bg-background text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {repeatDays.length > 0 && (
                <Select
                  value={String(weeks)}
                  onValueChange={(value) => setWeeks(Number(value))}
                  options={[
                    { value: '1', label: 'Just this week' },
                    ...[2, 3, 4, 6, 8, 12].map((count) => ({ value: String(count), label: `For ${count} weeks` })),
                  ]}
                  ariaLabel="Repeat duration"
                  className={sel}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {repeatDays.length === 0
                  ? 'No days picked — one shift on the assignment date. Pick weekdays to repeat it.'
                  : `Creates ${shiftCount} ${shiftCount === 1 ? 'shift' : 'shifts'}${shiftCount > 1 ? ' — each one can still be edited or deleted individually.' : ''}`}
              </p>
            </div>
          </Card>
        )}

        {/* Estimated bill */}
        {money && (
          <Card
            title={
              <span className="inline-flex items-center gap-1.5">
                <Banknote size={14} /> Estimated bill
              </span>
            }
          >
            {hourlyRate == null ? (
              <p className="text-sm text-muted-foreground">
                {!userId
                  ? 'Assign someone to estimate the cost of this shift.'
                  : 'No hourly rate on file for this worker — salaried staff are costed by payroll instead.'}
              </p>
            ) : (
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Payable hours</dt>
                  <dd className="tabular-nums text-foreground">{(payableMinutes / 60).toFixed(2)} h</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Hourly rate</dt>
                  <dd className="tabular-nums text-foreground">{fmtMoney(hourlyRate)}/h</dd>
                </div>
                {occurrences.length > 1 && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Occurrences</dt>
                    <dd className="tabular-nums text-foreground">{occurrences.length}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 border-t border-rule pt-2">
                  <dt className="font-semibold text-foreground">Estimated total</dt>
                  <dd className="text-base font-semibold tabular-nums text-foreground">{fmtMoney(estimatedCost)}</dd>
                </div>
                <p className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
                  <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  An estimate from the planned hours — payroll pays the clocked hours, capped at what was scheduled.
                </p>
              </dl>
            )}
          </Card>
        )}

        {editing && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={WORK_STATE[editing.state].variant}>{WORK_STATE[editing.state].label}</Badge>
            Changes apply to this shift only — other repeats of the same schedule are separate shifts.
          </p>
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
