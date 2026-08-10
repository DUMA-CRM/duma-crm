import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Drawer } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { createCustomer } from '@/lib/api/customers.service';

interface CreateCustomerDrawerProps {
  tenantId: string;
  onClose: () => void;
}

/** The form's own id, so the drawer's pinned footer can submit it from outside. */
const FORM_ID = 'create-customer-form';

/**
 * New-customer capture in a right-hand slide-over, alongside the list it was
 * opened from — the same shape the rota uses for a shift record. Save and cancel
 * sit in the drawer's pinned footer, so a long form scrolls under them.
 */
export function CreateCustomerDrawer({ tenantId, onClose }: CreateCustomerDrawerProps) {
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      createCustomer({
        tenantId,
        firstName,
        lastName,
        phone,
        email: email || undefined,
        dob: dob ? new Date(dob).toISOString() : undefined,
        marketingOptIn,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      onClose();
    },
  });

  return (
    <Drawer
      title="New customer"
      description="Create a loyalty profile now; optional details can be added later."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={onClose} disabled={isPending} className="flex-1">
            Cancel
          </Button>
          <Button size="lg" type="submit" form={FORM_ID} disabled={isPending} className="flex-1">
            {isPending ? 'Creating…' : 'Create customer'}
          </Button>
        </div>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={(e) => {
          e.preventDefault();
          mutate();
        }}
        className="space-y-6"
      >
        <fieldset>
          <legend className="text-sm font-semibold text-foreground">Customer details</legend>
          <p className="mt-1 text-xs text-muted-foreground">Name and phone number are required for a usable profile.</p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="First name"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="Adam"
              />
              <Input
                label="Last name"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                placeholder="Smith"
              />
            </div>
            <Input
              label="Phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+44 7911 123456"
              hint="Include the country code when possible."
            />
            <Input
              label="Email (optional)"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="adam@example.com"
            />
            <Input label="Date of birth (optional)" type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-foreground">Communication</legend>
          <label className="mt-3 flex min-h-12 items-start gap-3 rounded-md border border-rule/65 bg-band/55 p-3 text-sm transition-colors hover:bg-band">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={marketingOptIn}
              onChange={(event) => setMarketingOptIn(event.target.checked)}
            />
            <span>
              <span className="block font-medium text-foreground">Marketing email consent</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Only enable this when the customer has clearly agreed.</span>
            </span>
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="rounded-md bg-exception/8 px-3 py-2 text-sm text-destructive">
            {(error as Error).message}
          </p>
        )}
      </form>
    </Drawer>
  );
}
