'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarClock,
  CalendarDays,
  CircleHelp,
  FileText,
  Loader2,
  Monitor,
  Sun,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { AddressFields } from '@/components/people/AddressFields';
import { Drawer } from '@/components/shared/Drawer';
import { ChoiceCards, FormSection, ModalActions } from '@/components/shared/FormParts';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { type HrEmployee, updateMyEmployee } from '@/lib/modules/people/client';
import {
  type TicketCategory,
  type TicketPriority,
  createTicket,
  getLeaveTypes,
  getMyEntitlements,
  submitLeaveRequest,
} from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import {
  formatNiNumber,
  formatSortCode,
  isValidAccountNumber,
  isValidNiNumber,
  isValidSortCode,
  normaliseAccountNumber,
  normaliseNiNumber,
  normaliseSortCode,
} from '@/lib/utils/my-hr';
import { workspaceDateKey } from '@/lib/utils/workspace-time';

// ── Shared form furniture ─────────────────────────────────────────────────────

function Labelled({
  label,
  hint,
  error,
  grow = false,
  plain = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** Fills the remaining height — for the one field that should take the slack. */
  grow?: boolean;
  /** Renders a div rather than a label, for controls that are a group of buttons. */
  plain?: boolean;
  children: React.ReactNode;
}) {
  const Tag = plain ? 'div' : 'label';
  return (
    <Tag className={cn('block', grow && 'flex min-h-0 flex-1 flex-col')}>
      {/* The `Input` label exactly, so a labelled control and an `Input` with its own label line up. */}
      <FieldLabel as="span" required={['Details', 'Day length', 'How urgent is it?'].includes(label)}>
        {label}
      </FieldLabel>
      <div className={cn('mt-1.5', grow && 'min-h-0 flex-1')}>{children}</div>
      {error ? (
        <span className="mt-1 block text-xs text-exception">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      )}
    </Tag>
  );
}

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

/**
 * Broad enough that nobody has to pick "Other" for an ordinary situation —
 * which is the failure mode of a short list, and the reason this is not free
 * text: HR reads these in an emergency and needs them consistent.
 */
const RELATIONSHIPS = [
  'Spouse',
  'Partner',
  'Parent',
  'Child',
  'Sibling',
  'Grandparent',
  'Other family member',
  'Friend',
  'Neighbour',
  'Carer',
  'Other',
];

const textarea =
  'w-full min-h-24 rounded-md border border-input bg-control p-3 text-sm leading-relaxed text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring/30';

// ── Your details ──────────────────────────────────────────────────────────────

/**
 * What an employee may change about their own record, one form per row of the
 * Overview — each opens under its `ChangeRow` and saves itself.
 *
 * All of them go through `PATCH /hr/employees/me` — the endpoint that exists
 * for exactly this. The admin `/employees/{id}/bank` route this used to call is
 * manager-scoped and simply failed for staff.
 *
 * Wrong bank or NI details mean unpaid wages or emergency-rate tax, so their
 * format is checked before submit rather than discovered at payday.
 */
interface DetailsFormProps {
  employee: HrEmployee;
  /** The save landed: close the row and refetch the record. */
  onDone: () => void;
}

function SaveButton({ pending, disabled, children = 'Save' }: { pending: boolean; disabled: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <Button type="submit" disabled={disabled || pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {children}
      </Button>
    </div>
  );
}

export function AddressForm({ employee, onDone }: DetailsFormProps) {
  const initial = employee.address ?? '';
  const [address, setAddress] = useState(initial);
  const mutation = useMutation({
    mutationFn: () => updateMyEmployee({ address }),
    onSuccess: () => {
      toast('success', 'Your details were updated.');
      onDone();
    },
    onError: (e) => toast('error', (e as Error).message),
  });
  const dirty = address !== initial;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) mutation.mutate();
      }}
    >
      {/* The record stores one address line, so the four fields compose into
          it and parse back out — the same component the HR-side forms use,
          so both sides write the address the same way round. */}
      <AddressFields value={address} onChange={setAddress} labelClassName="mb-1.5" />
      <SaveButton pending={mutation.isPending} disabled={!dirty} />
    </form>
  );
}

export function EmergencyContactForm({ employee, onDone }: DetailsFormProps) {
  const [form, setForm] = useState({
    emergencyContactName: employee.emergencyContactName ?? '',
    emergencyContactRelation: employee.emergencyContactRelation ?? '',
    emergencyContactPhone: employee.emergencyContactPhone ?? '',
  });
  const [initialForm] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== initialForm;
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  const mutation = useMutation({
    mutationFn: () => updateMyEmployee(form),
    onSuccess: () => {
      toast('success', 'Your details were updated.');
      onDone();
    },
    onError: (e) => toast('error', (e as Error).message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) mutation.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Name" autoFocus value={form.emergencyContactName} onChange={set('emergencyContactName')} />
        <Labelled label="Relationship">
          <Select
            value={form.emergencyContactRelation}
            onValueChange={(emergencyContactRelation) => setForm((current) => ({ ...current, emergencyContactRelation }))}
            // Anything already on the record stays selectable, so a value HR
            // typed by hand is never silently replaced on the next save.
            options={[
              ...(form.emergencyContactRelation && !RELATIONSHIPS.includes(form.emergencyContactRelation)
                ? [{ value: form.emergencyContactRelation, label: form.emergencyContactRelation }]
                : []),
              ...RELATIONSHIPS.map((relationship) => ({ value: relationship, label: relationship })),
            ]}
            placeholder="Choose one"
            ariaLabel="Relationship to you"
            className="w-full"
          />
        </Labelled>
      </div>
      <Input label="Phone" type="tel" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} />
      <SaveButton pending={mutation.isPending} disabled={!dirty} />
    </form>
  );
}

export function BankDetailsForm({ onDone }: Pick<DetailsFormProps, 'onDone'>) {
  const [form, setForm] = useState({ bankAccountName: '', bankSortCode: '', bankAccountNumber: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const blur = (key: string) => () => setTouched((t) => ({ ...t, [key]: true }));

  // Bank details are all-or-nothing: a sort code without an account number
  // cannot be paid into, so a half-filled set blocks the save.
  const bankTouched = !!(form.bankAccountName || form.bankSortCode || form.bankAccountNumber);
  const bankComplete = !!form.bankAccountName.trim() && isValidSortCode(form.bankSortCode) && isValidAccountNumber(form.bankAccountNumber);
  const sortCodeError =
    touched.bankSortCode && form.bankSortCode && !isValidSortCode(form.bankSortCode) ? 'Six digits, e.g. 04-00-04.' : undefined;
  const accountError =
    touched.bankAccountNumber && form.bankAccountNumber && !isValidAccountNumber(form.bankAccountNumber) ? 'Eight digits.' : undefined;

  const mutation = useMutation({
    mutationFn: () => {
      const holder = form.bankAccountName.trim();
      const sortCode = normaliseSortCode(form.bankSortCode);
      const accountNumber = normaliseAccountNumber(form.bankAccountNumber);
      // Both spellings — see UpdateMyEmployeePayload for why.
      return updateMyEmployee({
        bankAccountName: holder,
        bankSortCode: sortCode,
        bankAccountNumber: accountNumber,
        accountHolder: holder,
        sortCode,
        accountNumber,
      });
    },
    onSuccess: () => {
      toast('success', 'Your details were updated.');
      onDone();
    },
    onError: (e) => toast('error', (e as Error).message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (bankComplete) mutation.mutate();
      }}
    >
      <Input
        label="Account holder"
        autoFocus
        value={form.bankAccountName}
        onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
        placeholder="Name exactly as it appears on the account"
        autoComplete="off"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Sort code"
          value={formatSortCode(form.bankSortCode)}
          onChange={(e) => setForm({ ...form, bankSortCode: normaliseSortCode(e.target.value) })}
          onBlur={blur('bankSortCode')}
          placeholder="00-00-00"
          inputMode="numeric"
          autoComplete="off"
          error={sortCodeError}
        />
        <Input
          label="Account number"
          value={form.bankAccountNumber}
          onChange={(e) => setForm({ ...form, bankAccountNumber: normaliseAccountNumber(e.target.value) })}
          onBlur={blur('bankAccountNumber')}
          placeholder="8 digits"
          inputMode="numeric"
          autoComplete="off"
          error={accountError}
        />
      </div>
      {bankTouched && !bankComplete && (
        <p className="flex items-start gap-2 rounded-md border border-measured/30 bg-measured/6 px-3 py-2 text-xs text-foreground">
          <AlertTriangle size={13} className="mt-px shrink-0 text-measured" aria-hidden="true" />
          Fill in all three bank fields — a partial account can’t be paid into.
        </p>
      )}
      <SaveButton pending={mutation.isPending} disabled={!bankComplete} />
    </form>
  );
}

export function NiNumberForm({ employee, onDone }: DetailsFormProps) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const niValid = !value || isValidNiNumber(value);
  const niError = touched && !niValid ? 'Two letters, six digits, then a letter A–D. e.g. AB 12 34 56 C.' : undefined;

  const mutation = useMutation({
    mutationFn: () => {
      const ni = normaliseNiNumber(value);
      // Both spellings — see UpdateMyEmployeePayload for why.
      return updateMyEmployee({ nationalInsuranceNumber: ni, niNumber: ni });
    },
    onSuccess: (updated) => {
      // The server answers 200 even for fields it ignored, so the saved record
      // is checked rather than trusted. Claiming success for a value that did
      // not land is how somebody ends up on an emergency tax code believing
      // they fixed it.
      if (updated?.hasNiNumber === false) {
        toast('error', 'The server did not accept your National Insurance number. Please tell HR.');
      } else {
        toast('success', 'Your details were updated.');
      }
      onDone();
    },
    onError: (e) => toast('error', (e as Error).message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value && niValid) mutation.mutate();
      }}
    >
      <Input
        label="National Insurance number"
        autoFocus
        value={formatNiNumber(value)}
        onChange={(e) => setValue(normaliseNiNumber(e.target.value))}
        onBlur={() => setTouched(true)}
        placeholder="AB 12 34 56 C"
        autoComplete="off"
        error={niError}
        hint={employee.hasNiNumber ? 'One is already held. Enter a new one only to correct it.' : 'On your payslip, P60 or NI card.'}
      />
      <SaveButton pending={mutation.isPending} disabled={!value || !niValid} />
    </form>
  );
}

// ── Leave ─────────────────────────────────────────────────────────────────────

const LEAVE_FORM_ID = 'my-hr-leave-form';

export function LeaveRequestDrawer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: types = [] } = useQuery({ queryKey: moduleQueryKeys.people.key('leave-types'), queryFn: getLeaveTypes });
  // My HR's own key, so the balances on the tiles are the ones already on screen.
  const { data: entitlements = [] } = useQuery({
    queryKey: moduleQueryKeys.people.key('leave-entitlements-me'),
    queryFn: () => getMyEntitlements(),
  });
  const [form, setForm] = useState<Parameters<typeof submitLeaveRequest>[0]>({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    partialDay: 'none',
    notes: '',
  });
  // With one type configured there is no choice to make, so it starts selected.
  // Derived rather than written into state by an effect: the value is correct on
  // the first render the types arrive, with nothing to keep in sync.
  const leaveTypeId = form.leaveTypeId || (types.length === 1 ? types[0].id : '');

  const mutation = useMutation({
    mutationFn: () => submitLeaveRequest({ ...form, leaveTypeId }),
    onSuccess: () => {
      toast('success', 'Leave request submitted.');
      onDone();
    },
    onError: (e) => toast('error', (e as Error).message),
  });
  // Booking time off that has already passed is almost always a slip, and the
  // approver cannot act on it either way.
  const backdated = !!form.startDate && form.startDate < workspaceDateKey();
  const inverted = !!form.startDate && !!form.endDate && form.endDate < form.startDate;

  const incomplete = !leaveTypeId || !form.startDate || !form.endDate || inverted;

  return (
    <Drawer
      icon={CalendarDays}
      title="Request time off"
      guidance="Your manager reviews it, and you’ll see the outcome under Time off."
      onClose={onClose}
      footer={
        <ModalActions
          form={LEAVE_FORM_ID}
          submitLabel="Submit request"
          pending={mutation.isPending}
          pendingLabel="Submitting…"
          disabled={incomplete}
          onCancel={onClose}
        />
      }
    >
      <form
        id={LEAVE_FORM_ID}
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {/* The type as tiles with what you have left — the figure people check
            before they ask, so it sits on the choice itself. */}
        <FormSection framed={false} title="Type of leave" note="What you have left is shown on each.">
          {types.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leave types are set up yet. Ask HR to add one.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Type of leave">
              {types.map((type) => {
                const on = leaveTypeId === type.id;
                const balance = entitlements.find((item) => item.leaveType.id === type.id);
                const left = balance ? Math.round((Number(balance.totalDays) - Number(balance.usedDays)) * 100) / 100 : null;
                return (
                  <button
                    key={type.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setForm({ ...form, leaveTypeId: type.id })}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                      on ? 'border-primary bg-primary/5' : 'border-border bg-background/60 hover:bg-band/40',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{type.name}</span>
                      <span className="block text-xs text-muted-foreground">{type.isPaid ? 'Paid' : 'Unpaid'}</span>
                    </span>
                    {left !== null && (
                      <span
                        className={cn('shrink-0 text-right text-xs tabular-nums', left <= 0 ? 'text-exception' : 'text-muted-foreground')}
                      >
                        <span className={cn('block text-base font-semibold', left <= 0 ? 'text-exception' : 'text-foreground')}>
                          {left}
                        </span>
                        days left
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </FormSection>

        <FormSection framed={false} title="When">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              required
              label="First day"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <Input
              required
              label="Last day"
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              error={inverted ? 'Ends before it starts.' : undefined}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
          {backdated && (
            <p className="flex items-start gap-2 rounded-md border border-measured/30 bg-measured/6 px-3 py-2 text-xs text-foreground">
              <AlertTriangle size={13} className="mt-px shrink-0 text-measured" aria-hidden="true" />
              These dates are in the past. Check them before submitting.
            </p>
          )}
          <Labelled label="Day length" plain>
            <ChoiceCards
              value={form.partialDay ?? 'none'}
              onChange={(partialDay) => setForm({ ...form, partialDay })}
              columns={3}
              options={[
                { value: 'none', label: 'Full days' },
                { value: 'start', label: 'Half on first day' },
                { value: 'end', label: 'Half on last day' },
              ]}
            />
          </Labelled>
        </FormSection>

        <FormSection icon={FileText} title="Anything to add" collapsible note="Optional — your manager sees it with the request.">
          <FieldLabel htmlFor="leave-request-note">Note for your manager</FieldLabel>
          <textarea
            id="leave-request-note"
            className={`${textarea} min-h-28`}
            aria-label="Note for your manager"
            placeholder="e.g. covering childcare during half term"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </FormSection>
      </form>
    </Drawer>
  );
}

// ── Helpdesk / data requests ──────────────────────────────────────────────────

const CATEGORIES: TicketCategory[] = ['hr', 'payroll', 'scheduling', 'leave', 'workplace', 'it', 'other'];

/** Each topic as a tile: what it's called and what it covers, so nobody has to guess which one fits. */
const TOPIC: Record<TicketCategory, { label: string; hint: string; icon: IconComponent }> = {
  hr: { label: 'HR', hint: 'Contract, records, policy', icon: FileText },
  payroll: { label: 'Payroll', hint: 'Pay, payslips, tax', icon: Banknote },
  scheduling: { label: 'Scheduling', hint: 'Rota, hours, attendance', icon: CalendarClock },
  leave: { label: 'Leave', hint: 'Holiday and absence', icon: Sun },
  workplace: { label: 'Workplace', hint: 'Equipment, safety, site', icon: Building2 },
  it: { label: 'IT', hint: 'Accounts and devices', icon: Monitor },
  other: { label: 'Something else', hint: 'Anything not listed', icon: CircleHelp },
};

/** Pre-fills used by the callers that raise a ticket on the employee's behalf. */
export interface TicketPreset {
  subject?: string;
  category?: TicketCategory;
  message?: string;
  /** Shown instead of the generic dialog title. */
  title?: string;
}

const TICKET_FORM_ID = 'my-hr-ticket-form';

/**
 * Raising a request is a slide-over rather than a modal: the message field is
 * the point of the form and wants room, several callers arrive with it
 * pre-filled from a day or a document the employee is looking at, and the
 * drawer keeps that context on screen behind it.
 */
export function NewTicketDrawer({
  preset,
  onClose,
  onDone,
}: {
  preset?: TicketPreset;
  onClose: () => void;
  onDone: (createdId?: string) => void;
}) {
  const [form, setForm] = useState<{ subject: string; category: TicketCategory; priority: TicketPriority; message: string }>({
    subject: preset?.subject ?? '',
    category: preset?.category ?? 'hr',
    priority: 'normal',
    message: preset?.message ?? '',
  });
  const mutation = useMutation({
    mutationFn: () => createTicket(form),
    onSuccess: (created) => {
      toast('success', 'Request raised.');
      onDone(created?.id);
    },
    onError: (e) => toast('error', (e as Error).message),
  });

  const incomplete = form.subject.trim().length < 3 || !form.message.trim();

  return (
    <Drawer
      icon={CircleHelp}
      title={preset?.title ?? 'Ask HR for something'}
      guidance="HR replies in Requests, and you’re notified when they do."
      onClose={onClose}
      footer={
        <ModalActions
          form={TICKET_FORM_ID}
          submitLabel="Send to HR"
          pending={mutation.isPending}
          pendingLabel="Sending…"
          disabled={incomplete}
          onCancel={onClose}
        />
      }
    >
      <form
        id={TICKET_FORM_ID}
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {/* The topic as tiles rather than a dropdown of long labels: seven
            choices read at a glance, and the hint says what each covers. */}
        <FormSection framed={false} title="What it’s about" note="It decides who at HR picks it up first.">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Topic">
            {CATEGORIES.map((category) => {
              const topic = TOPIC[category];
              const on = form.category === category;
              return (
                <button
                  key={category}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setForm({ ...form, category })}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    on ? 'border-primary bg-primary/5' : 'border-border bg-background/60 hover:bg-band/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-md',
                      on ? 'bg-primary/10 text-primary' : 'bg-band text-muted-foreground',
                    )}
                  >
                    <topic.icon size={15} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{topic.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{topic.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </FormSection>

        <FormSection framed={false} title="Your request" note="Include dates or amounts if they help — HR can act on it sooner.">
          <Input
            required
            label="Subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="e.g. Wrong hours on my payslip"
          />

          {/* Four fixed choices read better as one row than as a dropdown that
              hides three of them behind a click. */}
          <Labelled
            label="How urgent is it?"
            plain
            hint={
              form.priority === 'urgent'
                ? 'For things that can’t wait — HR is alerted straight away.'
                : form.priority === 'high'
                  ? 'Looked at before routine requests.'
                  : undefined
            }
          >
            <SegmentedControl
              options={PRIORITIES}
              value={form.priority}
              onChange={(v) => setForm({ ...form, priority: v })}
              ariaLabel="Priority"
              className="w-full [&>button]:flex-1"
            />
          </Labelled>

          <Labelled label="Details">
            <textarea
              className={`${textarea} min-h-40 resize-y`}
              placeholder="Describe what you need."
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </Labelled>
        </FormSection>
      </form>
    </Drawer>
  );
}
