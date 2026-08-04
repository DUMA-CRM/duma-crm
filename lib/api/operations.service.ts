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
