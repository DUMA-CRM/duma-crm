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
  HeartHandshake,
  Landmark,
  MapPin,
  MessageSquarePlus,
  Monitor,
  Sun,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { AddressFields } from '@/components/people/AddressFields';
import { Drawer } from '@/components/shared/Drawer';
import { ChoiceCards, FormSection, ModalActions } from '@/components/shared/FormParts';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils/cn';
import { workspaceDateKey } from '@/lib/utils/workspace-time';
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
import { toast } from '@/stores/toastStore';

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
      <span className="block text-label uppercase text-muted-foreground">{label}</span>
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
  'w-full min-h-24 rounded-md border border-input bg-control p-3 text-sm leading-relaxed text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-offset-0 focus:outline-measured';

// ── Your details ──────────────────────────────────────────────────────────────

const DETAILS_FORM_ID = 'my-hr-details-form';

/**
 * Everything an employee may change about their own record, in one slide-over.
 *
 * All of it goes through `PATCH /hr/employees/me` — the endpoint that exists
 * for exactly this — so one save covers contact details, emergency contact and
 * pay details. The admin `/employees/{id}/bank` route this used to call is
 * manager-scoped and simply failed for staff.
 *
 * Wrong bank or NI details mean unpaid wages or emergency-rate tax, so their
 * format is checked before submit rather than discovered at payday.
 */
export function EditDetailsDrawer({ employee, onClose, onDone }: { employee: HrEmployee; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    address: employee.address ?? '',
    emergencyContactName: employee.emergencyContactName ?? '',
    emergencyContactRelation: employee.emergencyContactRelation ?? '',
    emergencyContactPhone: employee.emergencyContactPhone ?? '',
    bankAccountName: '',
    bankSortCode: '',
    bankAccountNumber: '',
    nationalInsuranceNumber: '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const blur = (key: string) => () => setTouched((t) => ({ ...t, [key]: true }));
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  // Bank details are all-or-nothing: a sort code without an account number
  // cannot be paid into, so a half-filled set blocks the save.
  const bankTouched = !!(form.bankAccountName || form.bankSortCode || form.bankAccountNumber);
  const bankComplete = !!form.bankAccountName.trim() && isValidSortCode(form.bankSortCode) && isValidAccountNumber(form.bankAccountNumber);
  const niValid = !form.nationalInsuranceNumber || isValidNiNumber(form.nationalInsuranceNumber);

  const sortCodeError =
    touched.bankSortCode && form.bankSortCode && !isValidSortCode(form.bankSortCode) ? 'Six digits, e.g. 04-00-04.' : '';
  const accountError =
    touched.bankAccountNumber && form.bankAccountNumber && !isValidAccountNumber(form.bankAccountNumber) ? 'Eight digits.' : '';
  const niError = touched.nationalInsuranceNumber && !niValid ? 'Two letters, six digits, then a letter A–D. e.g. AB 12 34 56 C.' : '';

  const mutation = useMutation({
    mutationFn: () => {
      const ni = normaliseNiNumber(form.nationalInsuranceNumber);
      const holder = form.bankAccountName.trim();
      const sortCode = normaliseSortCode(form.bankSortCode);
      const accountNumber = normaliseAccountNumber(form.bankAccountNumber);
      return updateMyEmployee({
        address: form.address,
        emergencyContactName: form.emergencyContactName,
        emergencyContactRelation: form.emergencyContactRelation,
        emergencyContactPhone: form.emergencyContactPhone,
        // Both spellings — see UpdateMyEmployeePayload for why.
        ...(bankTouched
          ? {
              bankAccountName: holder,
              bankSortCode: sortCode,
              bankAccountNumber: accountNumber,
              accountHolder: holder,
              sortCode,
              accountNumber,
            }
          : {}),
        ...(ni ? { nationalInsuranceNumber: ni, niNumber: ni } : {}),
      });
    },
    onSuccess: (updated) => {
      // The server answers 200 even for fields it ignored, so the saved record
      // is checked rather than trusted. Claiming success for a value that did
      // not land is how somebody ends up on an emergency tax code believing
      // they fixed it.
      if (form.nationalInsuranceNumber && updated?.hasNiNumber === false) {
        toast('error', 'Your other details were saved, but the server did not accept your National Insurance number. Please tell HR.');
      } else {
        toast('success', 'Your details were updated.');
      }
      onDone();
    },
    onError: (e) => toast('error', (e as Error).message),
  });

  const blocked = (bankTouched && !bankComplete) || !niValid;

  return (
    <Drawer
      title="Edit your details"
      description="Changes go straight to your HR record."
      onClose={onClose}
      footer={
        <ModalActions
          form={DETAILS_FORM_ID}
          submitLabel="Save changes"
          pending={mutation.isPending}
          pendingLabel="Saving…"
          disabled={blocked}
          onCancel={onClose}
        />
      }
    >
      <form
        id={DETAILS_FORM_ID}
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {/* The staff record's edit drawer layout: each section an icon tile,
            its title and why, then its fields on the porcelain panel. */}
        <FormSection icon={MapPin} title="Home address" note="Where HR and payroll write to you.">
          {/* The record stores one address line, so the four fields compose into
              it and parse back out — the same component the HR-side forms use,
              so both sides write the address the same way round. */}
          <AddressFields
            value={form.address}
            onChange={(address) => setForm((current) => ({ ...current, address }))}
            // Same label style as every other field in this drawer.
            labelClassName="mb-1.5 block text-label uppercase text-muted-foreground"
          />
        </FormSection>

        <FormSection icon={HeartHandshake} title="Emergency contact" note="Who we call if something happens to you at work.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Labelled label="Name">
              <Input value={form.emergencyContactName} onChange={set('emergencyContactName')} />
            </Labelled>
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
          <Labelled label="Phone">
            <Input type="tel" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} />
          </Labelled>
        </FormSection>

        <FormSection
          icon={Landmark}
          title="Pay details"
          note="Stored details are never shown back to you. Leave these blank to keep what’s on file; fill them in only to set or replace them."
        >
          <Labelled label="Account holder">
            <Input
              value={form.bankAccountName}
              onChange={set('bankAccountName')}
              placeholder="Name exactly as it appears on the account"
              autoComplete="off"
            />
          </Labelled>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labelled label="Sort code" error={sortCodeError}>
              <Input
                value={formatSortCode(form.bankSortCode)}
                onChange={(e) => setForm({ ...form, bankSortCode: normaliseSortCode(e.target.value) })}
                onBlur={blur('bankSortCode')}
                placeholder="00-00-00"
                inputMode="numeric"
                autoComplete="off"
              />
            </Labelled>
            <Labelled label="Account number" error={accountError}>
              <Input
                value={form.bankAccountNumber}
                onChange={(e) => setForm({ ...form, bankAccountNumber: normaliseAccountNumber(e.target.value) })}
                onBlur={blur('bankAccountNumber')}
                placeholder="8 digits"
                inputMode="numeric"
                autoComplete="off"
              />
            </Labelled>
          </div>
          {bankTouched && !bankComplete && (
            <p className="flex items-start gap-2 rounded-md border border-measured/30 bg-measured/6 px-3 py-2 text-xs text-foreground">
              <AlertTriangle size={13} className="mt-px shrink-0 text-measured" aria-hidden="true" />
              Fill in all three bank fields — a partial account can’t be paid into.
            </p>
          )}
          <Labelled
            label="National Insurance number"
            error={niError}
            hint={employee.hasNiNumber ? 'One is already held. Enter a new one only to correct it.' : 'On your payslip, P60 or NI card.'}
          >
            <Input
              value={formatNiNumber(form.nationalInsuranceNumber)}
              onChange={(e) => setForm({ ...form, nationalInsuranceNumber: normaliseNiNumber(e.target.value) })}
              onBlur={blur('nationalInsuranceNumber')}
              placeholder="AB 12 34 56 C"
              autoComplete="off"
            />
          </Labelled>
        </FormSection>
      </form>
    </Drawer>
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
      title="Request time off"
      description="Your manager reviews it, and you’ll see the outcome under Time off."
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
        <FormSection icon={Sun} title="Type of leave" note="What you have left is shown on each.">
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
                      on ? 'border-primary bg-primary/5' : 'border-rule/60 bg-background/60 hover:bg-band/40',
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

        <FormSection icon={CalendarDays} title="When">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="First day" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input
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

        <FormSection icon={FileText} title="Anything to add" note="Optional — your manager sees it with the request.">
          <textarea
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
      title={preset?.title ?? 'Ask HR for something'}
      description="HR replies in Requests, and you’re notified when they do."
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
        <FormSection icon={CircleHelp} title="What it’s about" note="It decides who at HR picks it up first.">
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
                    on ? 'border-primary bg-primary/5' : 'border-rule/60 bg-background/60 hover:bg-band/40',
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

        <FormSection icon={MessageSquarePlus} title="Your request" note="Include dates or amounts if they help — HR can act on it sooner.">
          <Input
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
