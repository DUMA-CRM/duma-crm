import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { adjustPoints } from '@/lib/api/customers.service';
import { toast } from '@/stores/toastStore';
import { Customer } from '@/types/customers';

export function PointsForm({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: (c: Customer) => void }) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const deltaNum = Number.parseInt(delta, 10) || 0;
  const preview = Math.max(0, customer.pointsBalance + deltaNum);

  const { mutate, isPending } = useMutation({
    mutationFn: () => adjustPoints(customer.id, deltaNum, reason || undefined),
    onSuccess: (updated) => {
      onSaved(updated);
      onClose();
      toast('success', 'Points balance updated.');
    },
    onError: (err) => toast('error', err.message || 'Failed to adjust points.'),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (deltaNum !== 0) mutate();
      }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
        <span className="text-sm text-muted-foreground">Current balance</span>
        <span className="text-sm font-semibold text-foreground">{customer.pointsBalance.toLocaleString()} pts</span>
      </div>
      <Input
        label="Adjustment (+ or -)"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        required
        pattern="^-?\d+"
        placeholder="+100 or -50"
        autoFocus
      />
      <Input
        label="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Birthday bonus, correction…"
      />
      {deltaNum !== 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm text-muted-foreground">New balance</span>
          <span className="text-sm font-semibold text-foreground">{preview.toLocaleString()} pts</span>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || deltaNum === 0} className="flex-1">
          {isPending ? 'Saving…' : 'Confirm'}
        </Button>
      </div>
    </form>
  );
}
