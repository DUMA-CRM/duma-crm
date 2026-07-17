'use client';

import { Banknote, Check, CloudUpload, CreditCard, Loader2, Mail, Printer, ReceiptText, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

export type CheckoutStep = 'method' | 'confirm' | 'receipt';

interface CheckoutFlowProps {
  step: CheckoutStep;
  /** Order total in pence, snapshotted when checkout opened (the cart is cleared on success). */
  total: number;
  isPaying: boolean;
  /** True when the order was queued offline instead of paid online. */
  queued: boolean;
  /** Attached customer's email — enables the Email receipt option. */
  customerEmail?: string;
  onSelectMethod: (method: 'cash' | 'card') => void;
  /** Called when the confirmation screen finishes — advances to the receipt step. */
  onConfirmDone: () => void;
  onReceipt: (choice: 'email' | 'print' | 'none') => void;
  onCancel: () => void;
}

/**
 * Full-screen checkout: pick payment method → payment confirmation → receipt
 * choice. Covers the whole app (including the header) so the cashier can't
 * wander off mid-payment.
 */
export function CheckoutFlow({ step, total, isPaying, queued, customerEmail, onSelectMethod, onConfirmDone, onReceipt, onCancel }: CheckoutFlowProps) {
  // Which method button was tapped — drives the spinner on that button only.
  // No reset needed: the spinner requires isPaying too, so a stale value is inert.
  const [tapped, setTapped] = useState<'cash' | 'card' | null>(null);

  // Confirmation lingers briefly, then flows into the receipt question.
  useEffect(() => {
    if (step !== 'confirm') return;
    const t = setTimeout(onConfirmDone, 1800);
    return () => clearTimeout(t);
  }, [step, onConfirmDone]);

  const amount = `£${(total / 100).toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {step === 'method' && (
        <>
          <div className="flex items-center justify-between px-6 py-4 shrink-0">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Checkout</p>
            <Button variant="ghost" size="icon" onClick={onCancel} disabled={isPaying} aria-label="Cancel checkout" className="size-11">
              <X size={20} />
            </Button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
            <p className="text-sm text-muted-foreground">Total to pay</p>
            <p className="text-5xl font-bold text-foreground tabular-nums mt-2">{amount}</p>
            <p className="text-sm font-semibold text-muted-foreground mt-10 mb-4">Select payment method</p>
            <div className="grid grid-cols-2 gap-4 w-full max-w-xl">
              <Button
                variant="outline"
                onClick={() => {
                  setTapped('cash');
                  onSelectMethod('cash');
                }}
                disabled={isPaying}
                className="h-40 rounded-2xl flex-col gap-3 text-lg font-semibold [&_svg]:size-9"
              >
                {isPaying && tapped === 'cash' ? <Loader2 className="animate-spin" /> : <Banknote />}
                Cash
              </Button>
              <Button
                onClick={() => {
                  setTapped('card');
                  onSelectMethod('card');
                }}
                disabled={isPaying}
                className="h-40 rounded-2xl flex-col gap-3 text-lg font-semibold [&_svg]:size-9"
              >
                {isPaying && tapped === 'card' ? <Loader2 className="animate-spin" /> : <CreditCard />}
                Card
              </Button>
            </div>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${queued ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>
            {queued ? <CloudUpload size={40} /> : <Check size={40} strokeWidth={3} />}
          </div>
          <p className="text-2xl font-bold text-foreground mt-5">{queued ? 'Order saved offline' : 'Payment complete'}</p>
          <p className="text-sm text-muted-foreground mt-1.5">
            {queued ? 'It will send automatically when the connection returns.' : `${amount} charged successfully.`}
          </p>
        </div>
      )}

      {step === 'receipt' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <p className="text-2xl font-bold text-foreground text-center">How would you like to receive your digital receipt?</p>
          <div className="w-full max-w-xl mt-8 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => onReceipt('email')}
                disabled={!customerEmail}
                className="h-28 rounded-2xl flex-col gap-2.5 text-base font-semibold [&_svg]:size-7"
              >
                <Mail />
                Email
                <span className="text-xs font-normal text-muted-foreground truncate max-w-full">
                  {customerEmail ?? 'No customer email'}
                </span>
              </Button>
              <Button
                variant="outline"
                onClick={() => onReceipt('print')}
                className="h-28 rounded-2xl flex-col gap-2.5 text-base font-semibold [&_svg]:size-7"
              >
                <Printer />
                Print
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => onReceipt('none')}
              className="w-full h-28 rounded-2xl flex-col gap-2.5 text-base font-semibold [&_svg]:size-7"
            >
              <ReceiptText />
              No receipt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
