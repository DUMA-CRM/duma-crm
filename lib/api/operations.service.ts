import { apiFetch } from './client';
import type { PaymentMethod, PaymentProvider } from './payments.service';

export interface TradingSettings {
  tenantId: string;
  currency: string;
  locale: string;
  pricesIncludeTax: boolean;
  vatRegistered: boolean;
  vatNumber?: string | null;
  defaultVatRate: string;
  legalName?: string | null;
  tradingAddress?: string | null;
  receiptFooter?: string | null;
  customVatRates: Array<{ name: string; rate: number }>;

  // ── Payroll schedule ──────────────────────────────────────────────────────
  // Finalising only. Issuing stays manual whatever this says: nothing computes
  // PAYE, so a person has to enter the real deductions first (UI-ADR-011).
  payrollAutoFinalise: boolean;
  payrollPeriod: 'weekly' | 'monthly';
  /** Day of the month to run on, clamped to the last day of shorter months. */
  payrollPayDayOfMonth: number;
  /** ISO weekday to run on: 1 = Monday … 7 = Sunday. */
  payrollPayWeekday: number;
  /**
   * The last period the job snapshotted. Read-only — the API refuses to set it,
   * because a caller who could would be able to make the job re-run a period.
   */
  payrollLastAutoPeriodEnd?: string | null;
}
export const getTradingSettings = (tenantId: string) => apiFetch<TradingSettings>(`/trading-settings?tenantId=${tenantId}`);
export const saveTradingSettings = (data: Omit<TradingSettings, 'defaultVatRate'> & { defaultVatRate: number }) =>
  apiFetch<TradingSettings>('/trading-settings', { method: 'PUT', body: JSON.stringify(data) });
export const addPaymentConnection = (data: {
  tenantId: string;
  locationId?: string | null;
  provider: Exclude<PaymentProvider, 'cash'>;
  displayName: string;
  secret?: string;
  configuration: Record<string, string>;
}) => apiFetch<PaymentMethod>('/payment-connections', { method: 'POST', body: JSON.stringify(data) });
export interface CashUp {
  id: string;
  locationId: string;
  tradingDate: string;
  status: string;
  openingFloat: string;
  expectedCash: string;
  countedCash?: string;
  cashVariance?: string;
  expectedCard: string;
  terminalCardTotal?: string;
  cardVariance?: string;
}
export const getCashUps = (locationId: string) => apiFetch<CashUp[]>(`/cash-ups?locationId=${locationId}`);
export const openCashUp = (data: { locationId: string; tradingDate: string; openingFloat: number }) =>
  apiFetch<CashUp>('/cash-ups/open', { method: 'POST', body: JSON.stringify(data) });
export const closeCashUp = (id: string, data: { countedCash: number; terminalCardTotal: number; notes?: string }) =>
  apiFetch<CashUp>(`/cash-ups/${id}/close`, { method: 'POST', body: JSON.stringify(data) });


/**
 * Every reader at a location, disabled ones included.
 *
 * The till's `getPaymentMethods` filters to active, which is right for taking
 * money and wrong for managing devices: a disabled reader has to stay visible
 * or there is no way to turn it back on.
 */
export const getPaymentConnections = (locationId: string) =>
  apiFetch<PaymentMethod[]>(`/payment-connections?locationId=${locationId}&includeInactive=true`);

export const setPaymentConnectionActive = (id: string, isActive: boolean) =>
  apiFetch<PaymentMethod>(`/payment-connections/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });

/** Only succeeds for a reader that has never taken a payment; the API explains why not. */
export const deletePaymentConnection = (id: string) =>
  apiFetch<{ success: boolean; id: string }>(`/payment-connections/${id}`, { method: 'DELETE' });
