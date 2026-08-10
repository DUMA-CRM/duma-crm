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
  const wouldGoBelowZero = customer.pointsBalance + deltaNum < 0;

  const { mutate, isPending } = useMutation({
    mutationFn: () => adjustPoints(customer.id, deltaNum, reason || undefined),
    onSuccess: (updated) => {
      onSaved(updated);
      onClose();
      toast('success', 'Points balance updated.');
    },
    onError: (err) => toast('error', err.message || 'The points balance wasn’t updated. Review the adjustment and try again.'),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (deltaNum !== 0 && !wouldGoBelowZero) mutate();
      }}
      className="space-y-4"
    >
      <div className="rounded-md bg-band/55 p-4">
        <span className="text-xs font-medium text-muted-foreground">Current balance</span>
        <p data-figure className="mt-1 text-2xl font-semibold text-foreground">
          {customer.pointsBalance.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">points</span>
        </p>
      </div>
      <Input
        label="Points to add or remove"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        required
        pattern="^-?\d+"
        inputMode="numeric"
        placeholder="+100 or -50"
        hint="Use a minus sign to remove points."
        autoFocus
      />
      <Input
        label="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Birthday bonus, correction…"
      />
      {deltaNum !== 0 && (
        <div className="flex items-center justify-between rounded-md border border-stock/30 bg-stock/8 px-3 py-3">
          <span className="text-sm text-muted-foreground">New balance</span>
          <span data-figure className="text-sm font-semibold text-foreground">
            {preview.toLocaleString()} pts
          </span>
        </div>
      )}
      {wouldGoBelowZero && (
        <p role="alert" className="rounded-md bg-exception/8 px-3 py-2 text-sm text-exception">
          The balance cannot go below zero.
        </p>
      )}
      <div className="flex gap-2 border-t border-rule/55 pt-4">
        <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || deltaNum === 0 || wouldGoBelowZero} className="flex-1">
          {isPending ? 'Saving…' : 'Confirm'}
        </Button>
      </div>
    </form>
  );
}
