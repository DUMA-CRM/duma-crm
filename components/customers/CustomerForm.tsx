import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { createCustomer } from '@/lib/api/customers.service';

interface CreateCustomerFormProps {
  tenantId: string;
  onClose: () => void;
}

export function CreateCustomerForm({ tenantId, onClose }: CreateCustomerFormProps) {
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Adam" />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Smith" />
        </div>
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+447911123456" />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adam@duma.com (optional)" />
        <Input label="Date of birth" type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
        <label className="flex items-start gap-2 rounded-xl border border-border bg-surface-offset/40 p-3 text-sm">
          <input type="checkbox" className="mt-0.5" checked={marketingOptIn} onChange={(event) => setMarketingOptIn(event.target.checked)} />
          <span>
            <span className="block font-medium text-foreground">Marketing email consent</span>
            <span className="block text-xs text-muted-foreground">Allow birthday and promotional email automations.</span>
          </span>
        </label>
      </div>
      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      <div className="flex gap-2">
        <Button variant="outline" size="lg" onClick={onClose} disabled={isPending} className="flex-1">
          Cancel
        </Button>
        <Button size="lg" type="submit" disabled={isPending} className="flex-1">
          {isPending ? 'Creating…' : 'Create customer'}
        </Button>
      </div>
    </form>
  );
}
