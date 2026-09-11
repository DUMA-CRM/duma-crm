'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  Loader2,
} from '@/components/icons';
import {
  fmtDate,
  fmtHours,
  inp,
  lbl,
} from '@/components/people/shared';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { StatCard } from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';

import {
  type EmployeeHours,
  type TimesheetShift,
  getWorkPattern,
  updateWorkPattern,
} from '@/lib/api/hr.service';
import {
  type LeaveEntitlement,
  addEmployeeDocument,
  createEntitlement,
  createLeaveType,
  deleteEmployeeAbsence,
  deleteEmployeeDocument,
  getEmployeeAbsences,
  getEmployeeDocuments,
  getEmployeeEntitlements,
  getLeaveTypes,
  logEmployeeAbsence,
  updateEntitlement,
} from '@/lib/api/people-ops.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';

import { type Employee, monthRange, CARD, CARD_PADDED } from './shared';


export function AbsenceCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [initialDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({ date: initialDate, leaveTypeId: '', isHalfDay: false, reason: '' });
  const {
    data: absences = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['employee-absences', userId],
    queryFn: () => getEmployeeAbsences(userId),
  });
  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: getLeaveTypes,
    enabled: adding,
  });
  const add = useMutation({
    mutationFn: () =>
      logEmployeeAbsence({
        userId,
        date: form.date,
        leaveTypeId: form.leaveTypeId || undefined,
        isHalfDay: form.isHalfDay,
        reason: form.reason.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-absences', userId] });
      setAdding(false);
      setForm({ date: initialDate, leaveTypeId: '', isHalfDay: false, reason: '' });
      toast('success', 'Absence recorded.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const remove = useMutation({
    mutationFn: deleteEmployeeAbsence,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-absences', userId] });
      toast('success', 'Absence record removed.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });

  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-rule flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HeartPulse size={16} className="text-primary" aria-hidden="true" />
            <h2 className="font-semibold">Sickness & unplanned absence</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Keep the absence history needed for payroll and return-to-work follow-up.</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          Record absence
        </Button>
      </div>
      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="p-6 text-sm text-muted-foreground">Absence records are unavailable for your current access level.</p>
      ) : absences.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">No unplanned absences recorded.</p>
      ) : (
        <div className="divide-y divide-border">
          {absences.slice(0, 12).map((absence) => (
            <div key={absence.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{fmtDate(absence.date)}</p>
                  {absence.isHalfDay && <Badge variant="muted">Half day</Badge>}
                  {absence.leaveType && <Badge variant="primary">{absence.leaveType.name}</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{absence.reason || 'No reason recorded'}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(absence.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <Modal title="Record unplanned absence" onClose={() => setAdding(false)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate();
            }}
          >
            <DatePicker label="Date" value={form.date} onValueChange={(date) => setForm({ ...form, date })} />
            <div>
              <label className={lbl}>Leave category</label>
              <Select
                value={form.leaveTypeId}
                onValueChange={(value) => setForm({ ...form, leaveTypeId: value })}
                options={leaveTypes.map((type) => ({ value: type.id, label: type.name }))}
                placeholder="Optional category"
                ariaLabel="Absence category"
              />
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, isHalfDay: !form.isHalfDay })}
              className={cn(
                'w-full rounded-sm border p-3 text-left flex gap-3',
                form.isHalfDay ? 'border-primary/40 bg-band' : 'border-rule',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 size-5 rounded-sm border flex items-center justify-center',
                  form.isHalfDay ? 'bg-primary border-primary text-primary-foreground' : 'border-rule',
                )}
              >
                {form.isHalfDay && <CheckCircle2 size={13} />}
              </span>
              <span>
                <span className="block text-sm font-medium">Half-day absence</span>
                <span className="block text-xs text-muted-foreground">Leave unticked for a full scheduled day.</span>
              </span>
            </button>
            <div>
              <label className={lbl}>Reason or payroll note</label>
              <textarea
                className={cn(inp, 'h-24 py-2 resize-none')}
                maxLength={500}
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!form.date || add.isPending}>
              {add.isPending && <Loader2 className="animate-spin" />}Save absence
            </Button>
          </form>
        </Modal>
      )}
    </section>
  );
}


// ── Contracted work pattern ───────────────────────────────────────────────────

export function WorkPatternCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['work-pattern', userId], queryFn: () => getWorkPattern(userId) });
  const [edit, setEdit] = useState(false);
  const [days, setDays] = useState<number[] | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const selectedDays = days ?? data?.workingDays ?? [1, 2, 3, 4, 5];
  const weeklyHours = hours ?? data?.contractedWeeklyHours ?? 40;
  const save = useMutation({
    mutationFn: () => updateWorkPattern(userId, { workingDays: selectedDays, contractedWeeklyHours: weeklyHours }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-pattern', userId] });
      setEdit(false);
      toast('success', 'Work pattern updated.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className={CARD_PADDED}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Contracted pattern</p>
          <p className="text-xs text-muted-foreground mt-1">Used for leave planning; actual time remains the payroll record.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEdit(!edit)}>
          {edit ? 'Cancel' : 'Edit'}
        </Button>
      </div>
      <div className="flex gap-1.5">
        {names.map((name, index) => {
          const value = index + 1;
          const active = selectedDays.includes(value);
          return (
            <button
              key={name}
              disabled={!edit}
              onClick={() => setDays(active ? selectedDays.filter((d) => d !== value) : [...selectedDays, value].sort())}
              className={cn(
                'flex-1 h-9 rounded-sm border text-xs font-semibold',
                active ? 'bg-band border-primary/30 text-primary' : 'bg-muted border-rule text-muted-foreground',
                edit && 'hover:border-primary',
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div className="flex items-end justify-between gap-4 mt-4">
        <div>
          <p className="text-xs text-muted-foreground">Contracted weekly hours</p>
          {edit ? (
            <input
              type="number"
              min="0"
              max="168"
              step="0.5"
              value={weeklyHours}
              onChange={(e) => setHours(Number(e.target.value))}
              className={cn(inp, 'mt-1 w-28')}
            />
          ) : (
            <p className="text-xl font-semibold mt-1">{weeklyHours}h</p>
          )}
        </div>
        {edit && (
          <Button onClick={() => save.mutate()} disabled={selectedDays.length === 0 || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save pattern'}
          </Button>
        )}
      </div>
      {weeklyHours > 48 && (
        <p className="mt-3 rounded-sm border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          More than 48 contracted hours requires a working-time review. Keep any valid opt-out separately and continue to protect daily and
          weekly rest.
        </p>
      )}
    </div>
  );
}

export function LeaveAllowanceCard({ userId, employmentType }: { userId: string; employmentType: Employee['employmentType'] }) {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState<LeaveEntitlement | 'new' | null>(null);
  const { data: workPattern } = useQuery({
    queryKey: ['work-pattern', userId],
    queryFn: () => getWorkPattern(userId),
  });
  const { data: entitlements = [], isLoading } = useQuery({
    queryKey: ['employee-entitlements', userId, year],
    queryFn: () => getEmployeeEntitlements(userId, year),
  });
  const regularHoursBaseline = Math.min(28, Math.round((workPattern?.workingDays.length ?? 5) * 5.6 * 10) / 10);
  const annualEntitlement = entitlements.find((item) => item.leaveType.name.toLowerCase().includes('annual'));
  const belowRegularBaseline =
    employmentType !== 'zero_hours' &&
    employmentType !== 'contractor' &&
    !!annualEntitlement &&
    Number(annualEntitlement.totalDays) < regularHoursBaseline;
  return (
    <div className={CARD_PADDED}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Annual leave allowance</p>
          <p className="text-xs text-muted-foreground mt-1">Assigned days, usage, and remaining balance.</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={String(year)}
            onValueChange={(value) => setYear(Number(value))}
            options={[currentYear - 1, currentYear, currentYear + 1].map((value) => ({ value: String(value), label: String(value) }))}
            ariaLabel="Entitlement year"
            className="w-24"
          />
          <Button size="sm" onClick={() => setEditing('new')}>
            Add leave
          </Button>
        </div>
      </div>
      {employmentType === 'zero_hours' ? (
        <div className="mb-4 rounded-sm border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          Irregular-hours holiday must accrue from hours worked in each pay period. A manually assigned day balance is not a complete
          statutory calculation.
        </div>
      ) : employmentType === 'contractor' ? (
        <div className="mb-4 rounded-sm border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          Confirm the person&apos;s real employment status. Labelling someone a contractor does not remove worker holiday rights if the
          working relationship says otherwise.
        </div>
      ) : (
        <div
          className={cn(
            'mb-4 rounded-sm border p-3 text-xs text-muted-foreground',
            belowRegularBaseline ? 'border-destructive/30 bg-destructive/5' : 'border-rule bg-muted/30',
          )}
        >
          Regular-hours baseline from the current {workPattern?.workingDays.length ?? 5}-day pattern:{' '}
          <strong className="text-foreground">{regularHoursBaseline} days</strong> for a full leave year, subject to proration and
          contractual enhancements.
          {belowRegularBaseline && (
            <span className="block mt-1 text-destructive">The recorded annual allowance is below this baseline.</span>
          )}
        </div>
      )}
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : entitlements.length === 0 ? (
        <div className="py-7 rounded-sm border border-dashed border-rule text-center">
          <p className="text-sm font-medium">No allowance for {year}</p>
          <p className="text-xs text-muted-foreground mt-1">Add annual leave so the employee can submit requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entitlements.map((item) => {
            const total = Number(item.totalDays);
            const used = Number(item.usedDays);
            const remaining = total - used;
            return (
              <StatCard
                key={item.id}
                size="sm"
                label={item.leaveType.name}
                value={total}
                unit="days"
                caption={`${used} used · ${remaining} remaining`}
                visual={{ type: 'progress', pct: total > 0 ? (used / total) * 100 : 0 }}
                onSelect={() => setEditing(item)}
              />
            );
          })}
        </div>
      )}
      {editing && (
        <LeaveAllowanceModal
          userId={userId}
          year={year}
          entitlement={editing === 'new' ? null : editing}
          existing={entitlements}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['employee-entitlements', userId] });
          }}
        />
      )}
      <p className="mt-4 text-label text-muted-foreground">
        Keep the entitlement, leave taken and holiday-pay calculation history. From 6 April 2026, detailed annual-leave and holiday-pay
        records must be retained for at least six years.
      </p>
    </div>
  );
}

function LeaveAllowanceModal({
  userId,
  year,
  entitlement,
  existing,
  onClose,
  onDone,
}: {
  userId: string;
  year: number;
  entitlement: LeaveEntitlement | null;
  existing: LeaveEntitlement[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: leaveTypes = [] } = useQuery({ queryKey: ['leave-types'], queryFn: getLeaveTypes });
  const annualType = leaveTypes.find((type) => type.name.toLowerCase().includes('annual'));
  const [leaveTypeId, setLeaveTypeId] = useState(entitlement?.leaveType.id ?? annualType?.id ?? 'annual-default');
  const [totalDays, setTotalDays] = useState(entitlement?.totalDays ?? annualType?.defaultAllowanceDays ?? '28');
  const save = useMutation({
    mutationFn: async () => {
      if (entitlement) return updateEntitlement(entitlement.id, { totalDays: Number(totalDays).toFixed(1) });
      let targetTypeId = leaveTypeId;
      if (targetTypeId === 'annual-default') {
        if (annualType) {
          targetTypeId = annualType.id;
        } else {
          const created = await createLeaveType({
            name: 'Annual Leave',
            isPaid: true,
            requiresApproval: true,
            defaultAllowanceDays: Number(totalDays).toFixed(1),
          });
          targetTypeId = created.id;
        }
      }
      const duplicate = existing.find((item) => item.leaveType.id === targetTypeId);
      if (duplicate) return updateEntitlement(duplicate.id, { totalDays: Number(totalDays).toFixed(1) });
      return createEntitlement({ userId, leaveTypeId: targetTypeId, year, totalDays: Number(totalDays).toFixed(1) });
    },
    onSuccess: () => {
      toast('success', entitlement ? 'Leave allowance updated.' : 'Leave allowance added.');
      onDone();
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const options = [
    { value: 'annual-default', label: annualType?.name ?? 'Annual Leave' },
    ...leaveTypes.filter((type) => type.id !== annualType?.id).map((type) => ({ value: type.id, label: type.name })),
  ];
  return (
    <Modal title={entitlement ? 'Edit leave allowance' : `Add leave allowance · ${year}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        {!entitlement && (
          <div>
            <label className={lbl}>Leave type</label>
            <Select
              value={leaveTypeId}
              onValueChange={(value) => {
                setLeaveTypeId(value);
                const type = leaveTypes.find((item) => item.id === value);
                if (type?.defaultAllowanceDays) setTotalDays(type.defaultAllowanceDays);
              }}
              options={options}
              ariaLabel="Leave type"
            />
          </div>
        )}
        <div>
          <label className={lbl}>Total allowance (days)</label>
          <input
            type="number"
            min={entitlement ? Number(entitlement.usedDays) : 0.5}
            max="366"
            step="0.5"
            className={inp}
            value={totalDays}
            onChange={(event) => setTotalDays(event.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Half days are supported. An allowance cannot be lower than days already used.
          </p>
        </div>
        {entitlement && (
          <div className="rounded-sm bg-muted p-3 text-sm">
            <span className="text-muted-foreground">Already used:</span> <strong>{entitlement.usedDays} days</strong>
          </div>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={
            !totalDays ||
            Number(totalDays) <= 0 ||
            (entitlement ? Number(totalDays) < Number(entitlement.usedDays) : false) ||
            save.isPending
          }
        >
          {save.isPending && <Loader2 className="animate-spin" />}
          {entitlement ? 'Save allowance' : 'Add allowance'}
        </Button>
      </form>
    </Modal>
  );
}

export function EmployeeDocumentsCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [asOf] = useState(() => new Date());
  const [form, setForm] = useState({
    title: '',
    documentType: 'Right to work',
    reference: '',
    issuedAt: '',
    expiresAt: '',
    notes: '',
  });
  const { data: documents = [] } = useQuery({ queryKey: ['employee-documents', userId], queryFn: () => getEmployeeDocuments(userId) });
  const add = useMutation({
    mutationFn: () => addEmployeeDocument({ userId, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-documents', userId] });
      setAdding(false);
      setForm({ title: '', documentType: 'Right to work', reference: '', issuedAt: '', expiresAt: '', notes: '' });
      toast('success', 'Document record added.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const remove = useMutation({
    mutationFn: deleteEmployeeDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employee-documents', userId] }),
  });
  return (
    <div className={CARD_PADDED}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Documents & certificates</p>
          <p className="text-xs text-muted-foreground mt-1">Record evidence, check dates and renewal deadlines.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          Add
        </Button>
      </div>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No document records yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {documents.map((document) => {
            const expiry = document.expiresAt ? new Date(document.expiresAt).getTime() : null;
            const expired = expiry !== null && expiry < asOf.getTime();
            const expiring = expiry !== null && !expired && expiry < asOf.getTime() + 60 * 86_400_000;
            return (
              <div key={document.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{document.title}</p>
                    {expired && <Badge variant="destructive">Expired</Badge>}
                    {expiring && <Badge variant="warning">Due soon</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {document.documentType}
                    {document.issuedAt ? ` · checked ${fmtDate(document.issuedAt)}` : ''}
                    {document.expiresAt ? ` · expires ${fmtDate(document.expiresAt)}` : ''}
                  </p>
                  {document.reference && <p className="text-xs text-muted-foreground mt-0.5 truncate">{document.reference}</p>}
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove.mutate(document.id)}>
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {adding && (
        <Modal title="Add compliance record" onClose={() => setAdding(false)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate();
            }}
          >
            <div>
              <label className={lbl}>Title</label>
              <input
                className={inp}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="e.g. Online right-to-work check"
              />
            </div>
            <div>
              <label className={lbl}>Type</label>
              <Select
                value={form.documentType}
                onValueChange={(value) => setForm({ ...form, documentType: value })}
                options={[
                  'Right to work',
                  'Employment contract',
                  'Starter declaration / P45',
                  'Pension notice',
                  'Fit note',
                  'Food safety',
                  'Policy acknowledgement',
                  'Other',
                ].map((value) => ({ value, label: value }))}
                ariaLabel="Document type"
              />
            </div>
            <div>
              <label className={lbl}>Check method or reference</label>
              <input
                className={inp}
                value={form.reference}
                onChange={(event) => setForm({ ...form, reference: event.target.value })}
                placeholder="Online service, IDVT, manual or document reference"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DatePicker label="Checked / issued" value={form.issuedAt} onValueChange={(issuedAt) => setForm({ ...form, issuedAt })} />
              <DatePicker
                label="Follow-up / expiry"
                value={form.expiresAt}
                onValueChange={(expiresAt) => setForm({ ...form, expiresAt })}
                min={form.issuedAt || undefined}
              />
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <textarea
                className={cn(inp, 'h-20 py-2 resize-none')}
                value={form.notes}
                maxLength={1000}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
            {form.documentType === 'Right to work' && (
              <p className="rounded-sm border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                A record here does not itself establish a statutory excuse. Retain the prescribed evidence, record the actual check date,
                and complete follow-up checks where permission is time-limited.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={form.title.length < 2 || add.isPending}>
              {add.isPending ? 'Adding…' : 'Add record'}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}


// ── Hours & Timesheet (one row per day, detail modal per day) ─────────────────

interface DayGroup {
  key: string; // YYYY-MM-DD
  date: Date;
  segments: TimesheetShift[];
  rawHours: number;
  paidHours: number;
  overtimeHours: number;
  locations: string[];
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const fmtDay = (d: Date) => `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${fmtDate(d.toISOString())}`;
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—');

function groupByDay(shifts: TimesheetShift[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const s of shifts) {
    const key = dayKey(s.clockedIn);
    const g =
      map.get(key) ??
      ({ key, date: new Date(s.clockedIn), segments: [], rawHours: 0, paidHours: 0, overtimeHours: 0, locations: [] } as DayGroup);
    g.segments.push(s);
    g.rawHours += s.rawHours;
    g.paidHours += s.paidHours;
    g.overtimeHours += s.overtimeHours;
    if (s.locationName && !g.locations.includes(s.locationName)) g.locations.push(s.locationName);
    map.set(key, g);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...map.values()]
    .map((g) => ({ ...g, rawHours: round(g.rawHours), paidHours: round(g.paidHours), overtimeHours: round(g.overtimeHours) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

const TH = 'px-3 md:px-5 py-3.5 text-micro font-semibold text-muted-foreground uppercase tracking-micro';
const TD = 'px-3 md:px-5 py-3.5';

export function TimesheetCard({
  hours,
  monthOffset,
  onMonthChange,
}: {
  hours: EmployeeHours | undefined;
  monthOffset: number;
  onMonthChange: (v: number) => void;
}) {
  const [openDay, setOpenDay] = useState<DayGroup | null>(null);
  const days = groupByDay(hours?.shifts ?? []);
  const t = hours?.totals;

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-rule flex-wrap">
        <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Hours &amp; Timesheet</p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground tabular-nums">
            {fmtHours(t?.paidHours ?? 0)} marked payable
            {(t?.overtimeHours ?? 0) > 0 && <span className="text-warning"> · {fmtHours(t!.overtimeHours)} to review</span>} ·{' '}
            {fmtHours(t?.rawHours ?? 0)} clocked
          </span>
          <SegmentedControl
            options={[
              { value: '0', label: monthRange(0).label },
              { value: '1', label: monthRange(1).label },
              { value: '2', label: monthRange(2).label },
            ]}
            value={String(monthOffset)}
            onChange={(v) => onMonthChange(Number(v))}
          />
        </div>
      </div>

      {(t?.overtimeHours ?? 0) > 0 && (
        <div className="px-5 py-3 border-b border-warning/30 bg-warning/5 flex gap-2 text-xs text-muted-foreground">
          <AlertTriangle size={15} className="text-warning shrink-0" aria-hidden="true" />
          <p>
            Clocked time exceeds the current payable-hours calculation. Review every exception before payroll; unscheduled or additional
            work is not automatically unpaid.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <DataTable className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-rule bg-muted">
              <th className={cn(TH, 'text-left')}>Date</th>
              <th className={cn(TH, 'text-left')}>Location</th>
              <th className={cn(TH, 'text-left hidden sm:table-cell')}>Shifts</th>
              <th className={cn(TH, 'text-right')}>Clocked</th>
              <th className={cn(TH, 'text-right')}>Exception</th>
              <th className={cn(TH, 'text-right')}>Payable</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  No shifts in this period.
                </td>
              </tr>
            ) : (
              days.map((d) => (
                <tr
                  key={d.key}
                  onClick={() => setOpenDay(d)}
                  className="border-b border-rule last:border-0 hover:bg-band transition-colors cursor-pointer"
                >
                  <td className={cn(TD, 'font-medium text-foreground whitespace-nowrap')}>{fmtDay(d.date)}</td>
                  <td className={cn(TD, 'text-muted-foreground')}>
                    {d.locations.length === 0 ? '—' : d.locations.length === 1 ? d.locations[0] : `${d.locations.length} locations`}
                  </td>
                  <td className={cn(TD, 'text-muted-foreground tabular-nums hidden sm:table-cell')}>{d.segments.length}</td>
                  <td className={cn(TD, 'text-right tabular-nums text-muted-foreground')}>{fmtHours(d.rawHours)}</td>
                  <td className={cn(TD, 'text-right tabular-nums')}>
                    {d.overtimeHours > 0 ? (
                      <Badge variant="warning">+{fmtHours(d.overtimeHours)}</Badge>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className={cn(TD, 'text-right tabular-nums font-semibold text-foreground')}>{fmtHours(d.paidHours)}</td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </div>

      {openDay && (
        <Modal title={fmtDay(openDay.date)} onClose={() => setOpenDay(null)} className="max-w-xl">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="muted">{fmtHours(openDay.rawHours)} clocked</Badge>
              {openDay.overtimeHours > 0 && <Badge variant="warning">{fmtHours(openDay.overtimeHours)} needs review</Badge>}
              <Badge variant="success">{fmtHours(openDay.paidHours)} marked payable</Badge>
            </div>
            <div className="border border-rule rounded-sm overflow-hidden">
              <DataTable className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-micro font-semibold text-muted-foreground uppercase tracking-micro">
                    <th className="px-3 py-2 text-left">Clocked</th>
                    <th className="px-3 py-2 text-left">Scheduled</th>
                    <th className="px-3 py-2 text-right">Clocked</th>
                    <th className="px-3 py-2 text-right">Review</th>
                    <th className="px-3 py-2 text-right">Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {openDay.segments.map((s) => (
                    <tr key={s.id} className="border-t border-rule">
                      <td className="px-3 py-2 text-foreground tabular-nums whitespace-nowrap">
                        {fmtTime(s.clockedIn)} – {s.clockedOut ? fmtTime(s.clockedOut) : <span className="text-warning">open</span>}
                        {s.locationName && <span className="block text-label text-muted-foreground">{s.locationName}</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums whitespace-nowrap">
                        {s.scheduled ? `${fmtTime(s.scheduled.startsAt)} – ${fmtTime(s.scheduled.endsAt)}` : 'Unscheduled'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtHours(s.rawHours)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.overtimeHours > 0 ? <span className="text-warning">+{fmtHours(s.overtimeHours)}</span> : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">{fmtHours(s.paidHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
            <p className="text-label text-muted-foreground">
              The rota is evidence of planned work, not a legal cap on pay. Confirm actual working time, breaks and authorised corrections
              before payroll, including unscheduled work the business required or permitted.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

