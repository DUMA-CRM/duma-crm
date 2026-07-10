import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { createCustomer } from '@/lib/api/customers.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Customer } from '@/types/customers';

export function NewCustomerForm({ defaultPhone = '', onCreated, onClose }: { defaultPhone?: string; onCreated: (c: Customer) => void; onClose: () => void }) {
  const { tenantId } = useWorkspaceStore();
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState(defaultPhone);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createCustomer({ tenantId: tenantId!, firstName, lastName, phone }),
    onSuccess: (customer) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      onCreated(customer);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (tenantId) mutate();
      }}
      className="mt-2 space-y-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus placeholder="Jane" />
        <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Smith" />
      </div>
      <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+447911123456" type="tel" />
      {error && <p className="text-xs text-destructive">Failed to create customer. Please try again.</p>}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <Button variant="outline" onClick={onClose} size="sm">
          Cancel
        </Button>
        <Button disabled={isPending || !tenantId} size="sm" type="submit">
          {isPending ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
