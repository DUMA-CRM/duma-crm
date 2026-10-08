'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Banknote, Clock, CreditCard, type IconComponent, Landmark, Loader2, Wallet } from '@/components/icons';
import { ChoiceCards } from '@/components/shared/FormParts';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import { type RecordedPaymentMethod, markOrderPaid } from '@/lib/modules/ordering/client';
import { RECORDED_PAYMENT_LABEL } from '@/lib/utils/manual-order';
import { toast } from '@/stores/toastStore';

import { invalidateOrder } from './StatusMenu';

const METHODS: RecordedPaymentMethod[] = ['card', 'cash', 'bank_transfer', 'custom'];
const ICON: Record<RecordedPaymentMethod, IconComponent> = { card: CreditCard, cash: Banknote, bank_transfer: Landmark, custom: Wallet };

/**
 * An order taken by hand that hasn't been paid yet: what's due, and — when the
 * money comes in — how it was paid. Nothing is charged; it records a payment
 * made outside DUMA. Once recorded the order is paid and this card is gone.
 */
export function PaymentDueCard({ orderId, amountDue }: { orderId: string; amountDue: number }) {
  const qc = useQueryClient();
  const money = useWorkspaceMoney();
  const [choosing, setChoosing] = useState(false);
  const [method, setMethod] = useState<RecordedPaymentMethod>('card');
  const mark = useMutation({
    mutationFn: () => markOrderPaid(orderId, method),
    onSuccess: () => {
      invalidateOrder(qc, orderId);
      toast('success', `Marked paid by ${RECORDED_PAYMENT_LABEL[method].toLowerCase()}.`);
    },
    onError: (error) => toast('error', error instanceof Error && error.message ? error.message : 'The payment wasn’t recorded. Try again.'),
  });

  return (
    <section aria-labelledby="payment-due" className="rounded-lg border border-measured/35 bg-control px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-measured/10 text-measured" aria-hidden="true">
          <Clock size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="payment-due" className="text-sm font-semibold text-foreground">
            Waiting for payment
          </h3>
          <p className="text-xs text-muted-foreground">
            <span data-figure className="font-semibold text-foreground">
              {money(amountDue)}
            </span>{' '}
            due — record it when the money comes in
          </p>
        </div>
        {!choosing && (
          <Button size="sm" variant="outline" onClick={() => setChoosing(true)}>
            Mark as paid
          </Button>
        )}
      </div>

      {choosing && (
        <div className="mt-3 space-y-3 border-t border-rule/60 pt-3">
          <div role="group" aria-label="How it was paid">
            <ChoiceCards
              columns={2}
              value={method}
              onChange={setMethod}
              options={METHODS.map((option) => ({ value: option, label: RECORDED_PAYMENT_LABEL[option], icon: ICON[option] }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setChoosing(false)} disabled={mark.isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => mark.mutate()} disabled={mark.isPending}>
              {mark.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Paid by {RECORDED_PAYMENT_LABEL[method].toLowerCase()}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
