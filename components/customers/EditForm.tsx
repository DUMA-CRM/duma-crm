'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { updateCustomer } from '@/lib/api/customers.service';
import { toast } from '@/stores/toastStore';
import { Customer } from '@/types/customers';

export function EditForm({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: (c: Customer) => void }) {
  const [firstName, setFirstName] = useState(customer.firstName);
  const [lastName, setLastName] = useState(customer.lastName);
  const [phone, setPhone] = useState(customer.phone);
  const [email, setEmail] = useState(customer.email ?? '');
  const [dob, setDob] = useState(customer.dob ? customer.dob.slice(0, 10) : '');
  const [notes, setNotes] = useState(customer.notes ?? '');

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateCustomer(customer.id, {
        firstName,
        lastName,
        phone,
        email: email || undefined,
        dob: dob ? new Date(dob).toISOString() : undefined,
        notes: notes || undefined,
      }),
    onSuccess: (updated) => {
      onSaved(updated);
      onClose();
      toast('success', 'Customer updated.');
    },
    onError: (err) => toast('error', err.message || 'The customer record wasn’t saved. Review the details and try again.'),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="First name"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          autoFocus
        />
        <Input label="Last name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      </div>
      <Input label="Phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      <Input label="Email (optional)" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label="Date of birth (optional)" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      <div>
        <label htmlFor="customer-notes" className="mb-1.5 block text-xs font-semibold text-foreground">
          Internal notes (optional)
        </label>
        <textarea
          id="customer-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
          placeholder="Preferences or context the team should know"
          className="min-h-28 w-full rounded-md border border-input bg-field p-3 text-sm outline-none transition-[border-color,outline-color] focus:border-primary focus:outline-2 focus:outline-primary"
        />
      </div>
      <div className="flex gap-2 border-t border-rule/55 pt-4">
        <Button variant="outline" size="lg" onClick={onClose} disabled={isPending} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={isPending} className="flex-1">
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
