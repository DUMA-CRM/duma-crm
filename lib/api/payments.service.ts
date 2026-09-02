import { apiFetch } from './client';

export type PaymentProvider = 'stripe_online' | 'stripe_terminal' | 'sumup' | 'square' | 'custom' | 'manual_terminal' | 'cash';
export interface PaymentMethod {
  id: string;
  provider: PaymentProvider;
  displayName: string;
}
export interface PaymentAttempt {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  status: string;
  amount: string;
  currency: string;
  failureMessage?: string | null;
}
export const getPaymentMethods = (locationId: string) =>
  apiFetch<PaymentMethod[]>(`/payment-connections?locationId=${encodeURIComponent(locationId)}`);
export const startPayment = (
  orderId: string,
  input: { connectionId?: string; provider?: 'cash' | 'manual_terminal' | 'custom'; idempotencyKey: string },
) => apiFetch<PaymentAttempt>(`/payments/orders/${orderId}`, { method: 'POST', body: JSON.stringify(input) });
export const confirmPayment = (id: string, outcome: 'succeeded' | 'failed' | 'cancelled', failureMessage?: string) =>
  apiFetch<PaymentAttempt>(`/payments/${id}/confirm`, { method: 'POST', body: JSON.stringify({ outcome, failureMessage }) });
