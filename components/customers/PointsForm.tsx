'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Coins } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { adjustPoints } from '@/lib/api/customers.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import type { Customer } from '@/types/customers';

const FORM_ID = 'points-adjust-form';

/**
 * The amounts staff actually reach for. A member of staff correcting a missed
 * scan or applying a goodwill gesture is not thinking of a number; they are
 * thinking of a situation, and typing "+50" into an empty box is the slowest
 * path to one of five values.
 */
const PRESETS = [
  { delta: 50, label: '+50' },
  { delta: 100, label: '+100' },
  { delta: 250, label: '+250' },
  { delta: -50, label: '−50' },
  { delta: -100, label: '−100' },
] as const;

/**
 * Add or remove loyalty points.
 *
 * Owns its own dialog rather than being poured into one by the caller, so the
 * confirm button lives in the modal footer with every other dialog's instead of
 * scrolling away with the form.
 */
export function PointsForm({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');

  const deltaNum = Number.parseInt(delta, 10) || 0;
  const preview = Math.max(0, customer.pointsBalance + deltaNum);
  const wouldGoBelowZero = customer.pointsBalance + deltaNum < 0;
  const blocked = deltaNum === 0 || wouldGoBelowZero;

  const { mutate, isPending } = useMutation({
    mutationFn: () => adjustPoints(customer.id, deltaNum, reason || undefined),
    onSuccess: (updated) => {
      // The timeline shows this adjustment, so it has to be refetched too.
      void qc.invalidateQueries({ queryKey: ['customer-timeline', customer.id] });
      void qc.invalidateQueries({ queryKey: ['customer-ledger', customer.id] });
      onSaved(updated);
      onClose();
      toast('success', `Points ${deltaNum > 0 ? 'added' : 'removed'} — balance is now ${preview.toLocaleString()}.`);
    },
    onError: (error) => toast('error', error.message || 'The points balance wasn’t updated. Review the adjustment and try again.'),
  });

  return (
    <Modal
      title="Adjust points"
      description={`${customer.firstName} ${customer.lastName}`}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isPending || blocked} className="flex-1">
            {isPending ? 'Saving…' : deltaNum === 0 ? 'Confirm' : `Confirm ${deltaNum > 0 ? '+' : ''}${deltaNum.toLocaleString()}`}
          </Button>
        </div>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={(event) => {
          event.preventDefault();
          if (!blocked) mutate();
        }}
        className="space-y-4"
      >
        {/* Balance before and after, side by side — the whole question this
            dialog answers is "what will it be when I press confirm". */}
        <div className="grid grid-cols-2 overflow-hidden rounded-sm border border-rule">
          <div className="bg-band/55 p-3">
            <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Now</p>
            <p data-figure className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {customer.pointsBalance.toLocaleString()}
            </p>
          </div>
          <div className={cn('border-l border-rule p-3', deltaNum !== 0 && !wouldGoBelowZero ? 'bg-stock/8' : 'bg-band/25')}>
            <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">After</p>
            <p
              data-figure
              className={cn(
                'mt-1 text-xl font-semibold tabular-nums',
                deltaNum === 0 ? 'text-muted-foreground' : wouldGoBelowZero ? 'text-exception' : 'text-foreground',
              )}
            >
              {wouldGoBelowZero ? '—' : preview.toLocaleString()}
            </p>
          </div>
        </div>

        <fieldset>
          <legend className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Quick amounts</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map(({ delta: value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={deltaNum === value}
                onClick={() => setDelta(deltaNum === value ? '' : String(value))}
                className={cn(
                  'min-h-8 rounded-md border px-3 text-xs font-semibold tabular-nums',
                  'transition-[background-color,border-color,color,box-shadow] duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  // Same selected state as the timeline filters — one chip
                  // vocabulary across the record.
                  deltaNum === value
                    ? 'border-primary bg-primary/12 text-primary shadow-sm'
                    : 'border-rule bg-background text-muted-foreground hover:bg-band hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <Input
          label="Points to add or remove"
          value={delta}
          onChange={(event) => setDelta(event.target.value)}
          required
          pattern="^-?\d+"
          inputMode="numeric"
          placeholder="+100 or -50"
          hint="Use a minus sign to remove points."
          autoFocus
        />

        {/* This field used to be discarded by the API. It is now written to the
            loyalty ledger and shown against the adjustment on the timeline, which
            is worth saying — otherwise nobody fills in a box that never did
            anything. */}
        <Input
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Birthday bonus, service recovery, correction…"
          hint="Recorded permanently against this adjustment and shown on the timeline."
          maxLength={255}
        />

        {wouldGoBelowZero && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-sm border border-exception/30 bg-exception/8 px-3 py-2 text-sm text-exception"
          >
            <Coins size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            That would take the balance below zero. The most you can remove is {customer.pointsBalance.toLocaleString()}.
          </p>
        )}
      </form>
    </Modal>
  );
}
