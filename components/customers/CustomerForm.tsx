'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { RowTile } from '@/components/shared/rows';
import { Drawer } from '@/components/customers/CustomerDialogs';
import { Check, Mail, Plus, UserCircle2, X } from '@/components/icons';
import { Switch } from '@/components/settings/controls';
import { DrawerSection } from '@/components/shared/DrawerSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { createCustomer, updateCustomer } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { customerFormSnapshot } from '@/lib/utils/customer-form';
import { DIETARY_PREFERENCES, FSA_ALLERGENS } from '@/types/customers';
import type { AlertSeverity, Allergen, Customer, CustomerAlert, DietaryPreference } from '@/types/customers';

/**
 * One form for creating and editing a customer.
 *
 * These used to be two components — a create drawer and an edit form rendered in
 * a modal — with the same fields written twice and two different chromes for the
 * same job. Editing a record in a modal while creating one in a drawer is a
 * distinction without a reason, so both are drawers now.
 *
 * Laid out in the newer drawers' groups (Media's file drawer, a customer's
 * address): a titled white card each — Contact, then Marketing on create, or
 * Allergies, Preferences and Alerts on edit.
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

  const [addingAlert, setAddingAlert] = useState(false);
  const [newAlert, setNewAlert] = useState<{ severity: AlertSeverity; label: string; note: string }>({
    severity: 'warning',
    label: '',
    note: '',
  });

  const values = { firstName, lastName, phone, email, dob, allergies, dietary, seating, alerts };
  // Capture what was opened, so a background refetch cannot reset the dirty state.
  const [initialSnapshot] = useState(() => customerFormSnapshot(values));
  const dirty = customerFormSnapshot(values) !== initialSnapshot;
  const unfinishedAlert = Boolean(newAlert.label.trim() || newAlert.note.trim());
  const canSave = (!isEdit || dirty) && !unfinishedAlert;

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
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customers') });
      if (isEdit) void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer', customer!.id) });
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
    setAddingAlert(false);
  };

  return (
    <Drawer
      icon={UserCircle2}
      title={isEdit ? 'Edit customer' : 'New customer'}
      onClose={onClose}
      // The address drawer's footer: leaving on the left, saving on the right.
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={save.isPending || !canSave} className="min-w-32">
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create customer'}
          </Button>
        </div>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave && !save.isPending) save.mutate();
        }}
        className="space-y-6"
      >
        <DrawerSection id="customer-contact" title="Contact">
          <div className="grid gap-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="First name"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                autoFocus
              />
              <Input
                label="Last name"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
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
            />
            <Input label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input label="Date of birth" type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
          </div>
        </DrawerSection>

        {!isEdit && (
          // Consent is changed from the record's Privacy tab after creation, where
          // the change is recorded with a source and a reason.
          <DrawerSection id="customer-marketing" title="Marketing">
            <div className="flex items-center gap-3 px-4 py-3">
              <RowTile icon={Mail} tone={marketingOptIn ? 'success' : 'default'} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Can be emailed</span>
                <span className="block text-xs text-muted-foreground">Only when they’ve clearly agreed.</span>
              </span>
              <Switch label="Can be emailed" checked={marketingOptIn} onChange={setMarketingOptIn} />
            </div>
          </DrawerSection>
        )}

        {isEdit && (
          <>
            <DrawerSection id="customer-allergies" title="Allergies" count={allergies.length}>
              <div className="space-y-3 p-4">
                <ChipGroup
                  label="Allergies for this guest"
                  options={ALLERGEN_OPTIONS}
                  value={allergies}
                  onChange={(next) => setAllergies(next as Allergen[])}
                  tone="warning"
                />
              </div>
            </DrawerSection>

            <DrawerSection id="customer-preferences" title="Preferences">
              <div className="space-y-4 p-4">
                <div className="space-y-1.5">
                  <FieldLabel as="span">Dietary</FieldLabel>
                  <ChipGroup
                    label="Dietary preferences for this guest"
                    options={DIETARY_OPTIONS}
                    value={dietary}
                    onChange={(next) => setDietary(next as DietaryPreference[])}
                  />
                </div>
                <Input
                  label="Seating"
                  value={seating}
                  onChange={(event) => setSeating(event.target.value)}
                  maxLength={120}
                  placeholder="Window table, away from the door"
                />
              </div>
            </DrawerSection>

            <DrawerSection
              id="customer-alerts"
              title="Alerts"
              count={alerts.length}
              action={
                !addingAlert && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddingAlert(true)}
                    aria-controls="customer-alert-composer"
                  >
                    <Plus data-icon="inline-start" />
                    Add alert
                  </Button>
                )
              }
            >
              {alerts.length === 0 && !addingAlert && <p className="px-4 py-3 text-sm text-muted-foreground">None.</p>}
              {alerts.length > 0 && (
                <ul className={cn(addingAlert && 'border-b border-border')}>
                  {alerts.map((alert, index) => (
                    <li
                      key={`${alert.label}-${index}`}
                      className="flex items-start gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                    >
                      <span
                        className={cn(
                          'mt-0.5 shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold uppercase tracking-micro',
                          SEVERITY_CHIP[alert.severity],
                        )}
                      >
                        {SEVERITIES.find((entry) => entry.value === alert.severity)?.label ?? alert.severity}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{alert.label}</p>
                        {alert.note && <p className="mt-0.5 text-xs text-muted-foreground">{alert.note}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAlerts((current) => current.filter((_, at) => at !== index))}
                        aria-label={`Remove alert ${alert.label}`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-exception/8 hover:text-exception"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {addingAlert && (
                <div id="customer-alert-composer" className="grid gap-3 p-4">
                  <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                    <Select
                      value={newAlert.severity}
                      onValueChange={(value) => setNewAlert((current) => ({ ...current, severity: value as AlertSeverity }))}
                      options={SEVERITIES}
                      ariaLabel="Alert severity"
                      className="w-full"
                    />
                    <Input
                      value={newAlert.label}
                      onChange={(event) => setNewAlert((current) => ({ ...current, label: event.target.value }))}
                      placeholder="What should staff know?"
                      maxLength={120}
                      aria-label="Alert label"
                      autoFocus
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
                  <Input
                    value={newAlert.note}
                    onChange={(event) => setNewAlert((current) => ({ ...current, note: event.target.value }))}
                    placeholder="More detail"
                    maxLength={500}
                    aria-label="Alert detail"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addAlert();
                      }
                    }}
                  />
                  <div className="flex justify-end gap-2">
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setNewAlert({ severity: 'warning', label: '', note: '' });
                          setAddingAlert(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={addAlert} disabled={!newAlert.label.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DrawerSection>
            {unfinishedAlert && (
              <p className="text-xs text-muted-foreground" role="status">
                Add or cancel the alert before saving.
              </p>
            )}
          </>
        )}
      </form>
    </Drawer>
  );
}

/**
 * Choices as toggles, all in view — fourteen allergens are faster to tap than
 * to find in a dropdown, and what's on reads at a glance. The recipe page's
 * combination chips, so a tap looks the same everywhere.
 */
function ChipGroup({
  label,
  options,
  value,
  onChange,
  tone = 'primary',
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  tone?: 'primary' | 'warning';
}) {
  const chosen = new Set(value);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = chosen.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((entry) => entry !== option.value) : [...value, option.value])}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring',
              on
                ? tone === 'warning'
                  ? 'border-exception bg-exception text-white'
                  : 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-band/40',
            )}
          >
            {on && <Check size={12} aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Create-only entry point, kept for the customers list. */
export function CreateCustomerDrawer({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  return <CustomerFormDrawer tenantId={tenantId} onClose={onClose} />;
}
