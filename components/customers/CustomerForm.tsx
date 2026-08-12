'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AlertTriangle, Plus, ShieldAlert, X } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select } from '@/components/ui/select';

import { createCustomer, updateCustomer } from '@/lib/api/customers.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { DIETARY_PREFERENCES, FSA_ALLERGENS } from '@/types/customers';
import type { Allergen, AlertSeverity, Customer, CustomerAlert, DietaryPreference } from '@/types/customers';

/**
 * One form for creating and editing a customer.
 *
 * These used to be two components — a create drawer and an edit form rendered in
 * a modal — with the same fields written twice and two different chromes for the
 * same job. Editing a record in a modal while creating one in a drawer is a
 * distinction without a reason, so both are drawers now.
 *
 * Editing also covers the guest service fields (allergies, dietary needs,
 * seating, alerts); creating deliberately does not. A new record is usually
 * captured at speed with a guest waiting, and burying "name and phone" under
 * fourteen allergen checkboxes is how you end up with neither.
 *
 * Internal notes are *not* here. They live on the record itself, in a box that
 * saves on its own — nobody should open a five-section form and save an entire
 * customer to write one sentence, and two editors for one field is a conflict
 * waiting to happen. Omitting the key leaves the stored note untouched.
 */

const FORM_ID = 'customer-form';

const labelFor = (slug: string) => {
  const words = slug.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const ALLERGEN_OPTIONS = FSA_ALLERGENS.map((allergen) => ({ value: allergen, label: labelFor(allergen) }));
const DIETARY_OPTIONS = DIETARY_PREFERENCES.map((preference) => ({ value: preference, label: labelFor(preference) }));

const SEVERITIES: { value: AlertSeverity; label: string }[] = [
  { value: 'info', label: 'Note' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

const SEVERITY_CHIP: Record<AlertSeverity, string> = {
  critical: 'bg-exception/12 text-exception',
  warning: 'bg-warning/12 text-warning',
  info: 'bg-band text-muted-foreground',
};

interface Props {
  /** Provided when creating; ignored when editing. */
  tenantId?: string;
  /** Provided when editing. */
  customer?: Customer;
  onClose: () => void;
  onSaved?: (customer: Customer) => void;
}

export function CustomerFormDrawer({ tenantId, customer, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const isEdit = !!customer;

  const [firstName, setFirstName] = useState(customer?.firstName ?? '');
  const [lastName, setLastName] = useState(customer?.lastName ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [dob, setDob] = useState(customer?.dob ? customer.dob.slice(0, 10) : '');
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const [allergies, setAllergies] = useState<Allergen[]>(customer?.allergies ?? []);
  const [dietary, setDietary] = useState<DietaryPreference[]>(customer?.dietary ?? []);
  const [seating, setSeating] = useState(customer?.seatingPreference ?? '');
  const [alerts, setAlerts] = useState<CustomerAlert[]>(customer?.alerts ?? []);

  const [newAlert, setNewAlert] = useState<{ severity: AlertSeverity; label: string; note: string }>({
    severity: 'warning',
    label: '',
    note: '',
  });

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return updateCustomer(customer!.id, {
          firstName,
          lastName,
          phone,
          email: email || undefined,
          dob: dob ? new Date(dob).toISOString() : undefined,
          // Sent even when empty: an empty array is a meaningful edit ("no
          // allergies after all"), which omitting the key could not express.
          allergies,
          dietary,
          seatingPreference: seating || null,
          alerts,
        });
      }
      return createCustomer({
        tenantId: tenantId!,
        firstName,
        lastName,
        phone,
        email: email || undefined,
        dob: dob ? new Date(dob).toISOString() : undefined,
        marketingOptIn,
      });
    },
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: ['customers'] });
      if (isEdit) void qc.invalidateQueries({ queryKey: ['customer', customer!.id] });
      onSaved?.(saved);
      toast('success', isEdit ? 'Customer updated.' : 'Customer created.');
      onClose();
    },
    onError: (error) => toast('error', error.message || 'That didn’t save. Check the details and try again.'),
  });

  const addAlert = () => {
    const trimmed = newAlert.label.trim();
    if (!trimmed) return;
    setAlerts((current) => [
      ...current,
      { severity: newAlert.severity, label: trimmed, ...(newAlert.note.trim() ? { note: newAlert.note.trim() } : {}) },
    ]);
    setNewAlert({ severity: 'warning', label: '', note: '' });
  };

  return (
    <Drawer
      title={isEdit ? 'Edit customer' : 'New customer'}
      description={
        isEdit
          ? 'Contact details, plus what the team needs to know before serving this guest.'
          : 'Create a loyalty profile now; allergies and preferences can be added once the guest is served.'
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={onClose} disabled={save.isPending} className="flex-1">
            Cancel
          </Button>
          <Button size="lg" type="submit" form={FORM_ID} disabled={save.isPending} className="flex-1">
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create customer'}
          </Button>
        </div>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        className="space-y-6"
      >
        <Section title="Customer details">
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="First name"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                autoFocus
                placeholder="Adam"
              />
              <Input
                label="Last name"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                placeholder="Smith"
              />
            </div>
            <Input
              label="Phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              placeholder="+44 7911 123456"
              hint="Include the country code when possible."
            />
            <Input
              label="Email (optional)"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="adam@example.com"
            />
            <Input label="Date of birth (optional)" type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
          </div>
        </Section>

        {isEdit ? (
          <>
            <Section
              title="Before you serve"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Allergies">
                  <MultiSelect
                    value={allergies}
                    onChange={(next) => setAllergies(next as Allergen[])}
                    options={ALLERGEN_OPTIONS}
                    placeholder="None recorded"
                    ariaLabel="Allergies for this guest"
                    className="w-full"
                  />
                </Field>
                <Field label="Dietary">
                  <MultiSelect
                    value={dietary}
                    onChange={(next) => setDietary(next as DietaryPreference[])}
                    options={DIETARY_OPTIONS}
                    placeholder="None recorded"
                    ariaLabel="Dietary preferences for this guest"
                    className="w-full"
                  />
                </Field>
              </div>

              {allergies.length > 0 && (
                <p className="mt-3 flex items-start gap-2 rounded-sm border border-exception/30 bg-exception/8 px-3 py-2 text-xs text-exception">
                  <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold uppercase">{allergies.map(labelFor).join(' · ')}</strong> will show at the top of
                    this record and beside the guest’s name in every list.
                  </span>
                </p>
              )}

              <Input
                label="Seating preference (optional)"
                value={seating}
                onChange={(event) => setSeating(event.target.value)}
                maxLength={120}
                placeholder="Window table, away from the door"
                className="mt-3"
              />
            </Section>

            <Section
              title="Alerts"
              hint={
                <>
                  Pinned to the top of the record. Use <strong className="font-semibold text-foreground">Critical</strong> only for things
                  that must stop service going wrong.
                </>
              }
            >
              {alerts.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {alerts.map((alert, index) => (
                    <li
                      key={`${alert.label}-${index}`}
                      className="flex items-start gap-2.5 rounded-sm border border-rule bg-background px-3 py-2"
                    >
                      <span
                        className={cn(
                          'mt-0.5 shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold uppercase tracking-micro',
                          SEVERITY_CHIP[alert.severity],
                        )}
                      >
                        {alert.severity}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{alert.label}</p>
                        {alert.note && <p className="mt-0.5 text-xs text-muted-foreground">{alert.note}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAlerts((current) => current.filter((_, at) => at !== index))}
                        aria-label={`Remove alert ${alert.label}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-exception/8 hover:text-exception"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid gap-2 rounded-sm border border-dashed border-rule p-3">
                <p className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                  <ShieldAlert size={12} aria-hidden="true" />
                  Add an alert
                </p>
                <div className="flex gap-2">
                  <Select
                    value={newAlert.severity}
                    onValueChange={(value) => setNewAlert((current) => ({ ...current, severity: value as AlertSeverity }))}
                    options={SEVERITIES}
                    ariaLabel="Alert severity"
                    className="w-32 shrink-0"
                  />
                  <Input
                    value={newAlert.label}
                    onChange={(event) => setNewAlert((current) => ({ ...current, label: event.target.value }))}
                    placeholder="What should staff know?"
                    maxLength={120}
                    aria-label="Alert label"
                    // Enter would otherwise submit the whole form rather than
                    // adding the alert being typed.
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addAlert();
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newAlert.note}
                    onChange={(event) => setNewAlert((current) => ({ ...current, note: event.target.value }))}
                    placeholder="More detail (optional)"
                    maxLength={500}
                    aria-label="Alert detail"
                  />
                  <Button type="button" variant="outline" onClick={addAlert} disabled={!newAlert.label.trim()} className="shrink-0">
                    <Plus data-icon="inline-start" />
                    Add
                  </Button>
                </div>
              </div>
            </Section>
          </>
        ) : (
          <Section title="Communication">
            <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-sm border border-rule bg-band/55 p-3 text-sm transition-colors hover:bg-band">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={marketingOptIn}
                onChange={(event) => setMarketingOptIn(event.target.checked)}
              />
              <span>
                <span className="block font-medium text-foreground">Marketing email consent</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Only enable this when the customer has clearly agreed.</span>
              </span>
            </label>
            {/* Consent is changed from the Compliance tab after creation, where the
                change is recorded with a source and a reason. */}
          </Section>
        )}
      </form>
    </Drawer>
  );
}

function Section({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-foreground">{title}</legend>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <span className="block text-label uppercase text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Create-only entry point, kept for the customers list. */
export function CreateCustomerDrawer({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  return <CustomerFormDrawer tenantId={tenantId} onClose={onClose} />;
}
