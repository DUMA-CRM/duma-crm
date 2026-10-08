'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Clock3,
  Download,
  FileText,
  HeartPulse,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UploadCloud,
} from '@/components/icons';
import { usePayrollLocale } from '@/components/payroll/usePayroll';
import { fmtDate, fmtHours, inp, lbl, leaveIcon } from '@/components/people/shared';
import { ErrorState } from '@/components/shared/ErrorState';
import { IconTag } from '@/components/shared/IconTag';
import { MiniBar } from '@/components/shared/MiniBar';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';

import { type EmployeeHours, type TimesheetShift, getWorkPattern, updateWorkPattern } from '@/lib/modules/people/client';
import {
  type LeaveEntitlement,
  addEmployeeDocument,
  createEntitlement,
  createLeaveType,
  deleteEmployeeAbsence,
  deleteEmployeeDocument,
  employeeDocumentDownloadUrl,
  getEmployeeAbsences,
  getEmployeeDocuments,
  getEmployeeEntitlements,
  getLeaveTypes,
  logEmployeeAbsence,
  updateEntitlement,
} from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { workingDaysLabel } from '@/lib/utils/employee-record';
import { formatInstant, workspaceDateKey, zonedParts } from '@/lib/utils/workspace-time';
import { toast } from '@/stores/toastStore';

import { ChoiceCards, type Employee, ModalActions, NumberStepper, RecordBlock, RecordList, RecordListRow, monthRange } from './shared';

/*
 * The Time, leave & documents tab, in the Overview's vocabulary: a heading,
 * then the audit log's rows — tinted icon tile, the thing in bold, what it is
 * underneath, a pill only when something is off.
 *
 * The UK-specific advice (the 5.6-week holiday baseline, the April 2026
 * record-keeping rule, the 48-hour week, P45s) shows only where payroll is UK
 * — or not set, which every workspace was before multi-country payroll.
 */

// ── Sickness & unplanned absence ─────────────────────────────────────────────

export function AbsenceCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [initialDate] = useState(() => workspaceDateKey());
  const [form, setForm] = useState({ date: initialDate, leaveTypeId: '', isHalfDay: false, reason: '' });
  const {
    data: absences = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: moduleQueryKeys.people.key('employee-absences', userId),
    queryFn: () => getEmployeeAbsences(userId),
  });
  const { data: leaveTypes = [] } = useQuery({
    queryKey: moduleQueryKeys.people.key('leave-types'),
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
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('employee-absences', userId) });
      setAdding(false);
      setForm({ date: initialDate, leaveTypeId: '', isHalfDay: false, reason: '' });
      toast('success', 'Absence recorded.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const remove = useMutation({
    mutationFn: deleteEmployeeAbsence,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('employee-absences', userId) });
      toast('success', 'Absence record removed.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });

  return (
    <RecordBlock
      id="record-absence"
      title="Sickness & absence"
      action={
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus data-icon="inline-start" />
          Record
        </Button>
      }
    >
      {isError ? (
        // Used to guess "unavailable for your access level". Say what happened instead.
        <ErrorState
          title="Absences couldn’t be loaded"
          description="Nothing was read, so this isn’t an empty history."
          onRetry={() => void refetch()}
        />
      ) : isPending ? (
        <ListSkeleton rows={2} label="Loading absences" />
      ) : (
        <RecordList>
          {absences.length === 0 ? (
            <RecordListRow icon={HeartPulse} tone="muted" label="Sickness and unplanned absence" placeholder="None recorded" />
          ) : (
            absences.slice(0, 12).map((absence) => (
              <RecordListRow
                key={absence.id}
                icon={absence.leaveType ? leaveIcon(absence.leaveType.name) : HeartPulse}
                tone="money"
                value={fmtDate(absence.date)}
                label={absence.reason || 'No reason recorded'}
                detail={absence.leaveType?.name}
                trailing={absence.isHalfDay ? <IconTag icon={Clock3} label="Half day" tone="warning" /> : undefined}
                actions={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="hover:text-exception"
                    title="Remove"
                    aria-label={`Remove the absence on ${fmtDate(absence.date)}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(absence.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                }
              />
            ))
          )}
        </RecordList>
      )}
      {adding && (
        <Modal
          title="Record an absence"
          description="Sickness or other unplanned time off. It shows on their attendance calendar and goes to payroll."
          onClose={() => setAdding(false)}
          footer={
            <ModalActions
              form="absence-form"
              submitLabel="Save absence"
              pending={add.isPending}
              disabled={!form.date}
              onCancel={() => setAdding(false)}
            />
          }
        >
          <form
            id="absence-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate();
            }}
          >
            <DatePicker label="Date" value={form.date} onValueChange={(date) => setForm({ ...form, date })} />
            <div>
              <label className={lbl}>How long</label>
              <ChoiceCards
                value={form.isHalfDay ? 'half' : 'full'}
                onChange={(length) => setForm({ ...form, isHalfDay: length === 'half' })}
                options={[
                  { value: 'full', label: 'Full day' },
                  { value: 'half', label: 'Half day' },
                ]}
              />
            </div>
            <div>
              <label className={lbl}>Category</label>
              <Select
                value={form.leaveTypeId}
                onValueChange={(value) => setForm({ ...form, leaveTypeId: value })}
                options={leaveTypes.map((type) => ({ value: type.id, label: type.name }))}
                placeholder="None — just an absence"
                ariaLabel="Absence category"
                className="w-full"
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label className={lbl} htmlFor="absence-reason">
                  Reason or payroll note
                </label>
                <span className="text-xs text-muted-foreground">{form.reason.length}/500</span>
              </div>
              <textarea
                id="absence-reason"
                className={cn(inp, 'h-24 resize-none py-2')}
                maxLength={500}
                placeholder="e.g. Migraine — sent home at 11:00"
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </div>
          </form>
        </Modal>
      )}
    </RecordBlock>
  );
}

// ── Contracted work pattern ──────────────────────────────────────────────────

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WorkPatternCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { uk } = usePayrollLocale();
  const { data, isPending } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('work-pattern', userId),
    queryFn: () => getWorkPattern(userId),
  });
  const [edit, setEdit] = useState(false);
  const [days, setDays] = useState<number[] | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const selectedDays = days ?? data?.workingDays ?? [1, 2, 3, 4, 5];
  const weeklyHours = hours ?? data?.contractedWeeklyHours ?? 40;
  const save = useMutation({
    mutationFn: () => updateWorkPattern(userId, { workingDays: selectedDays, contractedWeeklyHours: weeklyHours }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('work-pattern', userId) });
      setEdit(false);
      toast('success', 'Work pattern updated.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const cancel = () => {
    setDays(null);
    setHours(null);
    setEdit(false);
  };

  return (
    <RecordBlock
      id="record-pattern"
      title="Work pattern"
      action={
        !edit && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Edit work pattern"
            aria-label="Edit work pattern"
            onClick={() => setEdit(true)}
          >
            <Pencil aria-hidden="true" />
          </Button>
        )
      }
    >
      {edit ? (
        // The same frame as the list it replaces, so switching to edit doesn't
        // move the page: fields inside, a live summary, actions in a footer.
        <form
          className="overflow-hidden rounded-lg border border-rule/60 bg-card"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-4 p-4">
            <div>
              <label className={lbl}>Working days</label>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_NAMES.map((name, index) => {
                  const value = index + 1;
                  const active = selectedDays.includes(value);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDays(active ? selectedDays.filter((d) => d !== value) : [...selectedDays, value].sort())}
                      className={cn(
                        'flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-semibold transition-colors',
                        active
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-rule/60 bg-background/60 text-muted-foreground hover:bg-band/40 hover:text-foreground',
                        index >= 5 && !active && 'bg-band/30',
                      )}
                    >
                      {name}
                      <span className={cn('size-1.5 rounded-full', active ? 'bg-primary' : 'bg-transparent')} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className={lbl}>Contracted hours a week</label>
              <NumberStepper label="Hours a week" value={weeklyHours} onChange={setHours} min={0} max={168} step={0.5} unit="h" />
            </div>
            <p className="rounded-md bg-band/50 px-3 py-2 text-xs text-muted-foreground">
              {selectedDays.length === 0 ? (
                <span className="font-medium text-measured">Pick at least one working day.</span>
              ) : (
                <>
                  <span className="font-semibold text-foreground">{weeklyHours}h a week</span> across {workingDaysLabel(selectedDays)} —
                  about {fmtHours(Math.round((weeklyHours / selectedDays.length) * 10) / 10)} a day.
                </>
              )}
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-rule/45 bg-band/20 px-4 py-3">
            <Button type="button" variant="ghost" onClick={cancel} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={selectedDays.length === 0 || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save pattern
            </Button>
          </div>
        </form>
      ) : (
        <RecordList>
          <RecordListRow
            icon={CalendarDays}
            value={isPending ? '…' : `${weeklyHours}h a week`}
            label={workingDaysLabel(selectedDays) ?? 'No working days'}
            detail={`${selectedDays.length} ${selectedDays.length === 1 ? 'day' : 'days'}`}
            pill={uk && weeklyHours > 48 ? { label: 'Over 48h', tone: 'warning' } : undefined}
          />
        </RecordList>
      )}
      {uk && weeklyHours > 48 && (
        <p className="mt-2 flex gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs leading-relaxed text-measured">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Over 48 hours needs a working-time review. Keep any valid opt-out separately and protect daily and weekly rest.
        </p>
      )}
    </RecordBlock>
  );
}

// ── Leave allowance ──────────────────────────────────────────────────────────

export function LeaveAllowanceCard({ userId, employmentType }: { userId: string; employmentType: Employee['employmentType'] }) {
  const qc = useQueryClient();
  const { uk } = usePayrollLocale();
  const [currentYear] = useState(() => new Date().getFullYear());
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState<LeaveEntitlement | 'new' | null>(null);
  const { data: workPattern } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('work-pattern', userId),
    queryFn: () => getWorkPattern(userId),
  });
  const {
    data: entitlements = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: moduleQueryKeys.people.key('employee-entitlements', userId, year),
    queryFn: () => getEmployeeEntitlements(userId, year),
  });
  // The UK's statutory minimum: 5.6 weeks, capped at 28 days.
  const regularHoursBaseline = Math.min(28, Math.round((workPattern?.workingDays.length ?? 5) * 5.6 * 10) / 10);
  const annualEntitlement = entitlements.find((item) => item.leaveType.name.toLowerCase().includes('annual'));
  const belowRegularBaseline =
    uk &&
    employmentType !== 'zero_hours' &&
    employmentType !== 'contractor' &&
    !!annualEntitlement &&
    Number(annualEntitlement.totalDays) < regularHoursBaseline;

  // Only the cases where a set day balance is misleading. The general
  // statutory-minimum line was removed on request; a short allowance still
  // shows as a "Below minimum" pill on its row.
  const advice = !uk
    ? null
    : employmentType === 'zero_hours'
      ? 'Irregular-hours holiday accrues from hours worked in each pay period — a set day balance isn’t a complete statutory calculation.'
      : employmentType === 'contractor'
        ? 'Check their real employment status: calling someone a contractor doesn’t remove worker holiday rights.'
        : null;

  return (
    <RecordBlock
      id="record-leave"
      title="Leave allowance"
      action={
        <>
          <Select
            value={String(year)}
            onValueChange={(value) => setYear(Number(value))}
            options={[currentYear - 1, currentYear, currentYear + 1].map((value) => ({ value: String(value), label: String(value) }))}
            ariaLabel="Entitlement year"
            className="w-24"
          />
          <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
            <Plus data-icon="inline-start" />
            Add
          </Button>
        </>
      }
    >
      {isError ? (
        <ErrorState title="Leave couldn’t be loaded" onRetry={() => void refetch()} />
      ) : isPending ? (
        <ListSkeleton rows={2} label="Loading leave" />
      ) : (
        <RecordList>
          {entitlements.length === 0 ? (
            <RecordListRow
              icon={CalendarDays}
              label={`Add annual leave so they can request time off in ${year}`}
              missing={`No allowance for ${year}`}
            />
          ) : (
            entitlements.map((item) => {
              const total = Number(item.totalDays);
              const used = Number(item.usedDays);
              const remaining = total - used;
              const isAnnual = item.id === annualEntitlement?.id;
              return (
                <RecordListRow
                  key={item.id}
                  onSelect={() => setEditing(item)}
                  icon={leaveIcon(item.leaveType.name)}
                  tone={remaining <= 0 ? 'missing' : 'team'}
                  value={`${remaining} of ${total} days left`}
                  label={item.leaveType.name}
                  detail={`${used} used`}
                  pill={isAnnual && belowRegularBaseline ? { label: 'Below minimum', tone: 'exception' } : undefined}
                  trailing={
                    <span className="flex items-center gap-2">
                      <MiniBar value={used} max={total} label={`${used} of ${total} days used`} className="w-16" />
                      <Pencil size={13} aria-hidden="true" />
                    </span>
                  }
                />
              );
            })
          )}
        </RecordList>
      )}
      {advice && <p className="mt-2 rounded-md bg-measured/10 px-3 py-2 text-xs leading-relaxed text-measured">{advice}</p>}
      {editing && (
        <LeaveAllowanceModal
          userId={userId}
          year={year}
          entitlement={editing === 'new' ? null : editing}
          existing={entitlements}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('employee-entitlements', userId) });
          }}
        />
      )}
    </RecordBlock>
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
  const { data: leaveTypes = [] } = useQuery({ queryKey: moduleQueryKeys.people.key('leave-types'), queryFn: getLeaveTypes });
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
  const total = Number(totalDays) || 0;
  const used = Number(entitlement?.usedDays ?? 0);
  const left = total - used;
  const tooLow = !!entitlement && total < used;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  return (
    <Modal
      title={entitlement ? `Edit ${entitlement.leaveType.name.toLowerCase()}` : 'Add a leave allowance'}
      description={
        entitlement
          ? `Their ${year} allowance. Half days are fine.`
          : `How many days of this leave they get in ${year}. Half days are fine.`
      }
      onClose={onClose}
      footer={
        <ModalActions
          form="leave-allowance-form"
          submitLabel={entitlement ? 'Save allowance' : 'Add allowance'}
          pending={save.isPending}
          disabled={total <= 0 || tooLow}
          onCancel={onClose}
        />
      }
    >
      <form
        id="leave-allowance-form"
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
              className="w-full"
            />
          </div>
        )}
        <div>
          <label className={lbl}>Days a year</label>
          <NumberStepper
            label="Days a year"
            value={total}
            onChange={(next) => setTotalDays(String(next))}
            min={0}
            max={366}
            step={0.5}
            unit="days"
          />
        </div>

        {/* What the new figure means for them, before it is saved. */}
        <div className="rounded-lg border border-rule/60 bg-field px-4 py-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{entitlement ? `${used} used so far` : 'None used yet'}</span>
            <span className={cn('font-semibold', tooLow ? 'text-exception' : 'text-foreground')}>
              {tooLow ? `${Math.abs(left)} days over` : `${left} days left`}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-band" aria-hidden="true">
            <div
              className={cn('h-full rounded-full', tooLow ? 'bg-exception' : 'bg-primary')}
              style={{ width: `${tooLow ? 100 : pct}%` }}
            />
          </div>
          {tooLow && <p className="mt-2 text-xs font-medium text-exception">It can’t be lower than the {used} days already used.</p>}
        </div>
      </form>
    </Modal>
  );
}

// ── Documents ────────────────────────────────────────────────────────────────

export function EmployeeDocumentsCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { uk } = usePayrollLocale();
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [asOf] = useState(() => new Date());
  const [form, setForm] = useState({
    title: '',
    documentType: 'Right to work',
    reference: '',
    issuedAt: '',
    expiresAt: '',
    notes: '',
  });
  const {
    data: documents = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: moduleQueryKeys.people.key('employee-documents', userId),
    queryFn: () => getEmployeeDocuments(userId),
  });
  const title = form.title.trim() || form.documentType;
  const tooBig = !!file && file.size > MAX_UPLOAD;
  const add = useMutation({
    mutationFn: () => addEmployeeDocument({ userId, file: file!, ...form, title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('employee-documents', userId) });
      setAdding(false);
      setFile(null);
      setForm({ title: '', documentType: 'Right to work', reference: '', issuedAt: '', expiresAt: '', notes: '' });
      toast('success', 'Document securely uploaded.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const remove = useMutation({
    mutationFn: deleteEmployeeDocument,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('employee-documents', userId) });
      toast('success', 'Document removed.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const types = [
    'Right to work',
    'Employment contract',
    uk ? 'Starter declaration / P45' : 'Tax or starter form',
    'Pension notice',
    uk ? 'Fit note' : 'Medical certificate',
    'Food safety',
    'Policy acknowledgement',
    'Other',
  ];

  return (
    <RecordBlock
      id="record-documents"
      title="Documents"
      action={
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus data-icon="inline-start" />
          Add
        </Button>
      }
    >
      {isError ? (
        <ErrorState
          title="Documents couldn’t be loaded"
          description="Nothing was read, so this isn’t an empty file."
          onRetry={() => void refetch()}
        />
      ) : isPending ? (
        <ListSkeleton rows={2} label="Loading documents" />
      ) : (
        <RecordList>
          {documents.length === 0 ? (
            <RecordListRow icon={FileText} tone="muted" label="Right to work, contract, certificates" placeholder="No documents yet" />
          ) : (
            documents.map((document) => {
              const expiry = document.expiresAt ? new Date(document.expiresAt).getTime() : null;
              const expired = expiry !== null && expiry < asOf.getTime();
              const expiring = expiry !== null && !expired && expiry < asOf.getTime() + 60 * 86_400_000;
              const detail = [
                document.issuedAt && `checked ${fmtDate(document.issuedAt)}`,
                document.originalFileName &&
                  `${document.originalFileName}${document.sizeBytes ? ` · ${Math.ceil(document.sizeBytes / 1024)} KB` : ''}`,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <RecordListRow
                  key={document.id}
                  icon={FileText}
                  tone={expired ? 'missing' : 'reference'}
                  value={document.title}
                  label={document.documentType}
                  detail={detail || undefined}
                  pill={expired ? { label: 'Expired', tone: 'exception' } : undefined}
                  trailing={
                    document.expiresAt &&
                    (expired ? (
                      <RelativeTime iso={document.expiresAt} />
                    ) : (
                      <span className={cn(expiring && 'font-semibold text-measured')}>
                        expires <RelativeTime iso={document.expiresAt} />
                      </span>
                    ))
                  }
                  actions={
                    <>
                      {document.hasFile && (
                        <Button asChild variant="ghost" size="icon-sm" title="Download">
                          <a href={employeeDocumentDownloadUrl(document.id)} download aria-label={`Download ${document.title}`}>
                            <Download aria-hidden="true" />
                          </a>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="hover:text-exception"
                        title="Remove"
                        aria-label={`Remove ${document.title}`}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(document.id)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </>
                  }
                />
              );
            })
          )}
        </RecordList>
      )}
      {adding && (
        <Modal
          title="Add a document"
          description="Evidence, a signed contract or a certificate — with the dates that matter for it."
          size="lg"
          onClose={() => setAdding(false)}
          footer={
            <ModalActions
              form="document-form"
              submitLabel="Upload document"
              pendingLabel="Uploading…"
              pending={add.isPending}
              disabled={!file || tooBig || title.length < 2}
              onCancel={() => setAdding(false)}
            />
          }
        >
          <form
            id="document-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate();
            }}
          >
            <FileDrop file={file} onFile={setFile} tooBig={tooBig} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={lbl}>Type</label>
                <Select
                  value={form.documentType}
                  onValueChange={(value) => setForm({ ...form, documentType: value })}
                  options={types.map((value) => ({ value, label: value }))}
                  ariaLabel="Document type"
                  className="w-full"
                />
              </div>
              <div>
                <label className={lbl} htmlFor="document-title">
                  Title
                </label>
                <input
                  id="document-title"
                  className={inp}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder={form.documentType}
                />
              </div>
            </div>
            <div>
              <label className={lbl} htmlFor="document-reference">
                Check method or reference
              </label>
              <input
                id="document-reference"
                className={inp}
                value={form.reference}
                onChange={(event) => setForm({ ...form, reference: event.target.value })}
                placeholder="How it was checked, or the document’s own reference"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DatePicker label="Checked or issued" value={form.issuedAt} onValueChange={(issuedAt) => setForm({ ...form, issuedAt })} />
              <DatePicker
                label="Expires or follow up"
                value={form.expiresAt}
                onValueChange={(expiresAt) => setForm({ ...form, expiresAt })}
                min={form.issuedAt || undefined}
              />
            </div>
            <div>
              <label className={lbl} htmlFor="document-notes">
                Notes
              </label>
              <textarea
                id="document-notes"
                className={cn(inp, 'h-20 resize-none py-2')}
                value={form.notes}
                maxLength={1000}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
            {form.documentType === 'Right to work' && uk && (
              <p className="flex gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs leading-relaxed text-measured">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />A record here isn’t itself a statutory excuse.
                Keep the prescribed evidence, record the actual check date, and do follow-up checks where permission is time-limited.
              </p>
            )}
          </form>
        </Modal>
      )}
    </RecordBlock>
  );
}

const MAX_UPLOAD = 10 * 1024 * 1024;

/** A drop zone rather than the browser's file button: drag a scan in, or click to choose. */
function FileDrop({ file, onFile, tooBig }: { file: File | null; onFile: (file: File | null) => void; tooBig: boolean }) {
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor="employee-document-file"
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onFile(event.dataTransfer.files?.[0] ?? null);
      }}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 transition-colors',
        over ? 'border-primary bg-primary/5' : tooBig ? 'border-exception/50 bg-exception/4' : 'border-rule/70 bg-field hover:bg-band/40',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-md',
          file ? (tooBig ? 'bg-exception/8 text-exception' : 'bg-primary/8 text-primary') : 'bg-band text-muted-foreground',
        )}
      >
        {file ? <FileText size={18} aria-hidden="true" /> : <UploadCloud size={18} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{file ? file.name : 'Drop a file here, or choose one'}</span>
        <span className={cn('block text-xs', tooBig ? 'font-medium text-exception' : 'text-muted-foreground')}>
          {file
            ? tooBig
              ? `${(file.size / 1024 / 1024).toFixed(1)} MB — over the 10 MB limit`
              : `${Math.ceil(file.size / 1024)} KB`
            : 'PDF, JPEG, PNG or WebP, up to 10 MB'}
        </span>
      </span>
      {file && <span className="shrink-0 text-xs font-semibold text-muted-foreground">Replace</span>}
      <input
        id="employee-document-file"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

// ── Hours (one row per day, detail modal per day) ────────────────────────────

interface DayGroup {
  key: string; // YYYY-MM-DD
  date: Date;
  segments: TimesheetShift[];
  rawHours: number;
  paidHours: number;
  overtimeHours: number;
  locations: string[];
}

// Clocked time groups by its day at the business, not on this device.
const dayKey = (iso: string) => workspaceDateKey(iso);
const fmtDay = (d: Date) => `${formatInstant(d, { weekday: 'short' })} ${fmtDate(d.toISOString())}`;
const fmtTime = (iso: string | null) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });

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
  const review = t?.overtimeHours ?? 0;

  return (
    <RecordBlock
      id="record-hours"
      title="Hours"
      action={
        <SegmentedControl
          options={[0, 1, 2].map((offset) => ({ value: String(offset), label: monthRange(offset).label.split(' ')[0] }))}
          value={String(monthOffset)}
          onChange={(v) => onMonthChange(Number(v))}
          ariaLabel="Month"
        />
      }
      note={
        hours && (
          <>
            {fmtHours(t?.paidHours ?? 0)} payable · {fmtHours(t?.rawHours ?? 0)} clocked across {t?.shiftCount ?? 0}{' '}
            {t?.shiftCount === 1 ? 'shift' : 'shifts'}
            {review > 0 && <span className="text-measured"> · {fmtHours(review)} to review before payroll</span>}
          </>
        )
      }
    >
      {!hours ? (
        <ListSkeleton rows={4} label="Loading hours" />
      ) : (
        <RecordList>
          {days.length === 0 ? (
            <RecordListRow icon={Clock} tone="muted" label={monthRange(monthOffset).label} placeholder="No shifts clocked" />
          ) : (
            days.map((d) => (
              <RecordListRow
                key={d.key}
                onSelect={() => setOpenDay(d)}
                icon={Clock}
                tone={d.overtimeHours > 0 ? 'money' : 'team'}
                value={fmtDay(d.date)}
                label={
                  d.locations.length === 0 ? 'No location' : d.locations.length === 1 ? d.locations[0] : `${d.locations.length} locations`
                }
                detail={`${d.segments.length} ${d.segments.length === 1 ? 'shift' : 'shifts'} · ${fmtHours(d.rawHours)} clocked`}
                pill={d.overtimeHours > 0 ? { label: `+${fmtHours(d.overtimeHours)} review`, tone: 'warning' } : undefined}
                trailing={
                  <span className="flex items-center gap-3">
                    <DaySpan segments={d.segments} />
                    <span className="font-semibold text-foreground">{fmtHours(d.paidHours)}</span>
                  </span>
                }
              />
            ))
          )}
        </RecordList>
      )}

      {openDay && (
        <Modal
          title={fmtDay(openDay.date)}
          description={`${openDay.segments.length} ${openDay.segments.length === 1 ? 'shift' : 'shifts'}${
            openDay.locations.length ? ` at ${openDay.locations.join(' and ')}` : ''
          }`}
          size="lg"
          onClose={() => setOpenDay(null)}
        >
          <div className="space-y-4">
            <dl className="grid grid-cols-3 gap-2">
              <DayFigure label="Clocked" value={fmtHours(openDay.rawHours)} />
              <DayFigure
                label="To review"
                value={openDay.overtimeHours > 0 ? `+${fmtHours(openDay.overtimeHours)}` : '—'}
                tone={openDay.overtimeHours > 0 ? 'warning' : 'default'}
              />
              <DayFigure label="Payable" value={fmtHours(openDay.paidHours)} tone="strong" />
            </dl>
            <RecordList>
              {openDay.segments.map((s) => (
                <RecordListRow
                  key={s.id}
                  icon={Clock}
                  tone={s.overtimeHours > 0 ? 'money' : s.clockedOut ? 'team' : 'missing'}
                  value={
                    <>
                      {fmtTime(s.clockedIn)} –{' '}
                      {s.clockedOut ? fmtTime(s.clockedOut) : <span className="text-measured">still clocked in</span>}
                    </>
                  }
                  label={s.scheduled ? `Rota ${fmtTime(s.scheduled.startsAt)} – ${fmtTime(s.scheduled.endsAt)}` : 'Not on the rota'}
                  detail={[s.locationName, `${fmtHours(s.rawHours)} clocked`].filter(Boolean).join(' · ')}
                  pill={s.overtimeHours > 0 ? { label: `+${fmtHours(s.overtimeHours)} review`, tone: 'warning' } : undefined}
                  trailing={<span className="font-semibold text-foreground">{fmtHours(s.paidHours)}</span>}
                />
              ))}
            </RecordList>
            <p className="text-xs leading-relaxed text-muted-foreground">
              The rota is evidence of planned work, not a cap on pay. Confirm actual working time, breaks and corrections before payroll,
              including unscheduled work the business required or allowed.
            </p>
          </div>
        </Modal>
      )}
    </RecordBlock>
  );
}

/** The day as a 24-hour track with each clocked stretch filled in — so a
    split shift or a late close reads at a glance instead of a Clock per row. */
function DaySpan({ segments }: { segments: TimesheetShift[] }) {
  const hourOf = (iso: string) => {
    const at = zonedParts(iso);
    return at.hour + at.minute / 60;
  };
  const label = segments.map((s) => `${fmtTime(s.clockedIn)} – ${s.clockedOut ? fmtTime(s.clockedOut) : 'still clocked in'}`).join(', ');
  return (
    <span role="img" aria-label={label} title={label} className="relative hidden h-1.5 w-20 overflow-hidden rounded-full bg-band sm:block">
      {segments.map((s) => {
        const start = hourOf(s.clockedIn);
        const out = s.clockedOut ? hourOf(s.clockedOut) : null;
        // Still clocked in: a stub. Past midnight: runs off the end of the day's track.
        const end = out === null ? Math.min(start + 0.5, 24) : out < start ? 24 : out;
        return (
          <span
            key={s.id}
            className={cn(
              'absolute inset-y-0 rounded-full',
              s.overtimeHours > 0 ? 'bg-measured' : s.clockedOut ? 'bg-momentum' : 'bg-exception',
            )}
            style={{ left: `${(start / 24) * 100}%`, width: `${Math.max(((end - start) / 24) * 100, 2)}%` }}
          />
        );
      })}
    </span>
  );
}

function DayFigure({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' | 'strong' }) {
  return (
    <div className="rounded-lg border border-rule/60 bg-field px-3.5 py-2.5">
      <dt className="text-label uppercase text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 text-base font-semibold', tone === 'warning' ? 'text-measured' : 'text-foreground')}>{value}</dd>
    </div>
  );
}
