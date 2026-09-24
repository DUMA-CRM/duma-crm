'use client';
import { useEffect } from 'react';

import { Banknote, Check, CloudUpload, CreditCard, Loader2, Mail, Printer, ReceiptText, X, XCircle } from '@/components/icons';
import { Button } from '@/components/ui/button';

import type { PaymentMethod } from '@/lib/modules/payments/client';

export type CheckoutStep = 'method' | 'verify' | 'confirm' | 'receipt';
interface Props {
  step: CheckoutStep;
  total: number;
  currency?: string;
  isPaying: boolean;
  queued: boolean;
  methods: PaymentMethod[];
  paymentLabel?: string;
  paymentProvider?: PaymentMethod['provider'];
  customerEmail?: string;
  emailReceiptAvailable?: boolean;
  onSelectMethod: (method: PaymentMethod) => void;
  onPaymentOutcome: (outcome: 'succeeded' | 'failed' | 'cancelled') => void;
  onConfirmDone: () => void;
  onReceipt: (choice: 'email' | 'print' | 'none') => void;
  onCancel: () => void;
}
export function CheckoutFlow({
  step,
  total,
  currency = 'GBP',
  isPaying,
  queued,
  methods,
  paymentLabel,
  paymentProvider,
  customerEmail,
  emailReceiptAvailable = false,
  onSelectMethod,
  onPaymentOutcome,
  onConfirmDone,
  onReceipt,
  onCancel,
}: Props) {
  useEffect(() => {
    if (step !== 'confirm') return;
    const t = setTimeout(onConfirmDone, 1500);
    return () => clearTimeout(t);
  }, [step, onConfirmDone]);
  const amount = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(total / 100);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Checkout</p>
        <Button variant="ghost" size="icon-touch" onClick={onCancel} disabled={isPaying} aria-label="Cancel checkout">
          <X />
        </Button>
      </div>
      {step === 'method' && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
          <p className="text-sm text-muted-foreground">Total to pay</p>
          <p className="mt-2 text-5xl font-bold">{amount}</p>
          <p className="mb-4 mt-10 text-sm font-semibold text-muted-foreground">Select payment method</p>
          <div className="grid w-full max-w-2xl grid-cols-2 gap-4">
            {methods.map((m) => (
              <Button
                key={m.id}
                variant={m.provider === 'cash' ? 'outline' : 'default'}
                onClick={() => onSelectMethod(m)}
                disabled={isPaying}
                className="h-32 flex-col gap-2 rounded-sm text-base"
              >
                {isPaying ? <Loader2 className="animate-spin" /> : m.provider === 'cash' ? <Banknote /> : <CreditCard />}
                {m.displayName}
              </Button>
            ))}
          </div>
        </div>
      )}
      {step === 'verify' && (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          {paymentProvider === 'cash' ? <Banknote size={52} className="text-primary" /> : <CreditCard size={52} className="text-primary" />}
          <h2 className="mt-5 text-2xl font-bold">{paymentProvider === 'cash' ? 'Confirm cash received' : 'Confirm payment result'}</h2>
          <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
            {paymentProvider === 'cash'
              ? `Count and accept ${amount} before confirming the sale.`
              : `Check ${paymentLabel ?? 'the terminal'} shows ${amount} as approved. Never confirm a declined, cancelled, or uncertain transaction.`}
          </p>
          <div className="mt-8 flex gap-3">
            <Button
              variant="destructive"
              onClick={() => onPaymentOutcome(paymentProvider === 'cash' ? 'cancelled' : 'failed')}
              disabled={isPaying}
            >
              <XCircle />
              {paymentProvider === 'cash' ? 'Cancel' : 'Failed'}
            </Button>
            <Button onClick={() => onPaymentOutcome('succeeded')} disabled={isPaying}>
              {isPaying ? <Loader2 className="animate-spin" /> : <Check />}
              {paymentProvider === 'cash' ? 'Cash received' : 'Payment approved'}
            </Button>
          </div>
        </div>
      )}
      {step === 'confirm' && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div
            className={`flex size-20 items-center justify-center rounded-full ${queued ? 'bg-warning/6 text-measured' : 'bg-success/6 text-momentum'}`}
          >
            {queued ? <CloudUpload size={40} /> : <Check size={40} />}
          </div>
          <p className="mt-5 text-2xl font-bold">{queued ? 'Order saved offline' : 'Payment complete'}</p>
        </div>
      )}
      {step === 'receipt' && (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <p className="text-2xl font-bold">Receipt</p>
          <div className="mt-8 grid w-full max-w-xl grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => onReceipt('email')}
              disabled={!customerEmail || !emailReceiptAvailable || queued}
              className="h-24 flex-col"
            >
              <Mail />
              Email
            </Button>
            <Button variant="outline" onClick={() => onReceipt('print')} disabled={queued} className="h-24 flex-col">
              <Printer />
              Print
            </Button>
            <Button variant="outline" onClick={() => onReceipt('none')} className="col-span-2 h-20 flex-col">
              <ReceiptText />
              No receipt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
