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
    onError: (err) => toast('error', err.message || 'Failed to save the customer.'),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus />
        <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      </div>
      <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
      <Input label="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      {/* TODO: Replace with a proper rich text editor or Textarea */}
      <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes…" />
      <div className="flex gap-2">
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
