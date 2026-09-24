'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { CalendarDays, FileText, HeartHandshake, Landmark, Loader2, MapPin } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { AddressFields } from '@/components/people/AddressFields';
import { Drawer } from '@/components/shared/Drawer';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type HrEmployee, updateMyEmployee } from '@/lib/modules/people/client';
import { type TicketCategory, type TicketPriority, createTicket, getLeaveTypes, submitLeaveRequest } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
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
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className={cn('mt-1', grow && 'min-h-0 flex-1')}>{children}</div>
      {error ? (
        <span className="mt-1 block text-xs text-destructive">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      )}
    </Tag>
  );
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  hr: 'HR — contract, records, policy',
  payroll: 'Payroll — pay, payslips, tax',
  scheduling: 'Scheduling — rota, hours, attendance',
  leave: 'Leave — holiday and absence',
  workplace: 'Workplace — equipment, safety, site',
  it: 'IT — accounts and devices',
  other: 'Something else',
};

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

function FieldsetHeading({ icon: Icon, title, description }: { icon?: IconComponent; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-2">
      {/* A bare glyph, not a tinted chip: it marks where a section starts
          without competing with the field labels underneath it. */}
      {Icon && <Icon size={14} className="mt-px shrink-0 text-muted-foreground" aria-hidden="true" />}
      <div className="min-w-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

const textarea = 'w-full min-h-24 rounded-sm border border-input bg-field p-3 text-sm';

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
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={DETAILS_FORM_ID} disabled={blocked || mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}Save changes
          </Button>
        </div>
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
        <section className="space-y-3">
          <FieldsetHeading icon={MapPin} title="Home address" />
          {/* The record stores one address line, so the four fields compose into
              it and parse back out — the same component the HR-side forms use,
              so both sides write the address the same way round. */}
          <AddressFields
            value={form.address}
            onChange={(address) => setForm((current) => ({ ...current, address }))}
            // Same label style as every other field in this drawer.
            labelClassName="mb-1 block text-xs font-semibold text-muted-foreground"
          />
        </section>

        <section className="space-y-3 border-t border-rule pt-5">
          <FieldsetHeading icon={HeartHandshake} title="Emergency contact" />
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
        </section>

        <section className="space-y-3 border-t border-rule pt-5">
          <FieldsetHeading icon={Landmark} title="Pay details" />
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
            <p className="text-xs text-warning">Fill in all three bank fields — a partial account cannot be paid into.</p>
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
        </section>
      </form>
    </Drawer>
  );
}

// ── Leave ─────────────────────────────────────────────────────────────────────

const LEAVE_FORM_ID = 'my-hr-leave-form';

export function LeaveRequestDrawer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: types = [] } = useQuery({ queryKey: moduleQueryKeys.people.key('leave-types'), queryFn: getLeaveTypes });
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
  const backdated = !!form.startDate && form.startDate < new Date().toISOString().slice(0, 10);
  const inverted = !!form.startDate && !!form.endDate && form.endDate < form.startDate;

  const incomplete = !leaveTypeId || !form.startDate || !form.endDate || inverted;

  return (
    <Drawer
      title="Request time off"
      description="Your manager reviews it, and you will see the outcome under Time off."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={LEAVE_FORM_ID} disabled={incomplete || mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}Submit request
          </Button>
        </div>
      }
    >
      <form
        id={LEAVE_FORM_ID}
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <section className="space-y-3">
          <FieldsetHeading icon={CalendarDays} title="What and when" />
          <Labelled label="Type of leave">
            <Select
              value={leaveTypeId}
              onValueChange={(v) => setForm({ ...form, leaveTypeId: v })}
              options={types.map((t) => ({ value: t.id, label: t.isPaid ? t.name : `${t.name} (unpaid)` }))}
              placeholder="Choose leave type"
              ariaLabel="Leave type"
              className="w-full"
            />
          </Labelled>
          <div className="grid gap-3 sm:grid-cols-2">
            <Labelled label="First day">
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Labelled>
            <Labelled label="Last day" error={inverted ? 'Ends before it starts.' : ''}>
              <Input
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Labelled>
          </div>
          {backdated && <p className="text-xs text-warning">These dates are in the past. Check them before submitting.</p>}
          <Labelled label="Day length">
            <Select
              value={form.partialDay ?? 'none'}
              onValueChange={(v) =>
                setForm({ ...form, partialDay: v as NonNullable<Parameters<typeof submitLeaveRequest>[0]['partialDay']> })
              }
              options={[
                { value: 'none', label: 'Full days' },
                { value: 'start', label: 'Half day on first day' },
                { value: 'end', label: 'Half day on last day' },
              ]}
              ariaLabel="Day length"
              className="w-full"
            />
          </Labelled>
        </section>

        <section className="space-y-3 border-t border-rule pt-5">
          <FieldsetHeading icon={FileText} title="Anything to add" />
          <textarea
            className={`${textarea} min-h-32`}
            placeholder="e.g. covering childcare during half term"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </section>
      </form>
    </Drawer>
  );
}

// ── Helpdesk / data requests ──────────────────────────────────────────────────

const CATEGORIES: TicketCategory[] = ['hr', 'payroll', 'scheduling', 'leave', 'workplace', 'it', 'other'];

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
      description="HR will reply in Requests, and you will be notified."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={TICKET_FORM_ID} disabled={incomplete || mutation.isPending}>
            {mutation.isPending && <Loader2 className="animate-spin" />}Send to HR
          </Button>
        </div>
      }
    >
      {/* Fills the drawer so the message field grows with the panel instead of
          leaving dead space under a fixed-height box. */}
      <form
        id={TICKET_FORM_ID}
        className="flex h-full flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Labelled label="Subject">
          <Input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="e.g. Wrong hours on my payslip"
          />
        </Labelled>

        <Labelled label="What is it about?">
          <Select
            value={form.category}
            onValueChange={(v) => setForm({ ...form, category: v as TicketCategory })}
            options={CATEGORIES.map((v) => ({ value: v, label: CATEGORY_LABELS[v] }))}
            ariaLabel="Category"
            className="w-full"
          />
        </Labelled>

        {/* Four fixed choices read better as one row than as a dropdown that
            hides three of them behind a click. */}
        <Labelled label="How urgent is it?" plain>
          <SegmentedControl
            options={PRIORITIES}
            value={form.priority}
            onChange={(v) => setForm({ ...form, priority: v })}
            ariaLabel="Priority"
            className="w-full"
          />
        </Labelled>

        <Labelled label="Details" grow>
          <textarea
            className={`${textarea} h-full min-h-40 resize-none`}
            placeholder="Describe what you need. Include dates or amounts if they help."
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </Labelled>
      </form>
    </Drawer>
  );
}
