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

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createCustomer({ tenantId, firstName, lastName, phone, email: email || undefined }),
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
