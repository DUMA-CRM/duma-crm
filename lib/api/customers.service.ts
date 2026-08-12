import type {
  Customer,
  CustomerFilters,
  CustomerPayload,
  CustomersParams,
  CustomersResponse,
  CustomerUpdatePayload,
  DuplicatePair,
  LedgerResponse,
  TimelineKind,
  TimelineResponse,
} from '@/types/customers';

import { apiFetch } from './client';

/**
 * Serialise the filter block the way the API parses it.
 *
 * Kept as its own function because the same shape has to go into three places:
 * the list request, a saved segment's body, and the URL the page keeps its state
 * in. Building the query string ad hoc in each led to filters that worked in one
 * and silently did nothing in another.
 *
 * Empty and `all` values are omitted rather than sent — the API treats an absent
 * key as "no constraint", and sending `tier=all` would be a filter for a tier
 * called "all".
 */
export const customerFiltersToQuery = (filters: CustomerFilters, qs = new URLSearchParams()) => {
  if (filters.search) qs.set('search', filters.search);
  if (filters.tier) qs.set('tier', filters.tier);
  if (filters.lapsedDays !== undefined) qs.set('lapsedDays', String(filters.lapsedDays));
  if (filters.activeWithinDays !== undefined) qs.set('activeWithinDays', String(filters.activeWithinDays));
  if (filters.neverVisited) qs.set('neverVisited', 'true');
  if (filters.birthdayMonth !== undefined) qs.set('birthdayMonth', String(filters.birthdayMonth));
  if (filters.marketing) qs.set('marketing', filters.marketing);
  if (filters.minTotalSpent !== undefined) qs.set('minTotalSpent', String(filters.minTotalSpent));
  if (filters.maxTotalSpent !== undefined) qs.set('maxTotalSpent', String(filters.maxTotalSpent));
  if (filters.minTotalVisits !== undefined) qs.set('minTotalVisits', String(filters.minTotalVisits));
  if (filters.maxTotalVisits !== undefined) qs.set('maxTotalVisits', String(filters.maxTotalVisits));
  // Repeated values travel as CSV, which is what the API's csvOf() parses.
  if (filters.allergies?.length) qs.set('allergies', filters.allergies.join(','));
  if (filters.dietary?.length) qs.set('dietary', filters.dietary.join(','));
  if (filters.sort) qs.set('sort', filters.sort);
  if (filters.direction) qs.set('direction', filters.direction);
  if (filters.includeMerged) qs.set('includeMerged', 'true');
  return qs;
};

/** True when any filter narrows the list — drives the "clear filters" affordance. */
export const hasActiveFilters = (filters: CustomerFilters) =>
  [...customerFiltersToQuery(filters).keys()].some((key) => key !== 'sort' && key !== 'direction');

export const getCustomers = (params: CustomersParams = {}) => {
  const qs = new URLSearchParams();

  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.tenantId) qs.set('tenantId', params.tenantId);
  if (params.phoneNumber) qs.set('phoneNumber', params.phoneNumber);
  customerFiltersToQuery(params, qs);

  const queryString = qs.toString();
  const queryPart = queryString ? '?' + queryString : '';

  return apiFetch<CustomersResponse>('/customers' + queryPart);
};

export const getCustomer = (id: string) => apiFetch<Customer>(`/customers/${id}`);

export const createCustomer = (data: CustomerPayload) => apiFetch<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) });

export const updateCustomer = (id: string, data: CustomerUpdatePayload) =>
  apiFetch<Customer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const adjustPoints = (id: string, delta: number, reason?: string) =>
  apiFetch<Customer>(`/customers/${id}/points`, {
    method: 'PATCH',
    body: JSON.stringify({ delta, ...(reason ? { reason } : {}) }),
  });

export type MarketingPreferenceStatus = 'opted_in' | 'opted_out' | 'suppressed';
export interface MarketingConsentEvent {
  id: string;
  action: MarketingPreferenceStatus;
  source: string;
  reason?: string | null;
  occurredAt: string;
}
export interface MarketingPreferences {
  marketingOptIn: boolean;
  emailUnsubscribedAt?: string | null;
  suppression?: { id: string; reason: string; source: string; maskedValue: string; createdAt: string } | null;
  history: MarketingConsentEvent[];
}

export const getMarketingPreferences = (id: string) => apiFetch<MarketingPreferences>(`/customers/${id}/marketing-preferences`);
export const updateMarketingPreferences = (
  id: string,
  data: { status: MarketingPreferenceStatus; source: string; reason?: string },
) => apiFetch<Customer>(`/customers/${id}/marketing-preferences`, { method: 'PATCH', body: JSON.stringify(data) });

// ── Loyalty ledger ──────────────────────────────────────────────────────────

/** Points history. `reconciles: false` means the cached balance drifted. */
export const getCustomerLedger = (id: string, limit = 50) =>
  apiFetch<LedgerResponse>(`/customers/${id}/ledger?limit=${limit}`);

// ── Timeline ────────────────────────────────────────────────────────────────

export const getCustomerTimeline = (id: string, options: { limit?: number; kinds?: TimelineKind[] } = {}) => {
  const qs = new URLSearchParams();
  if (options.limit) qs.set('limit', String(options.limit));
  if (options.kinds?.length) qs.set('kinds', options.kinds.join(','));
  const query = qs.toString();
  return apiFetch<TimelineResponse>(`/customers/${id}/timeline${query ? `?${query}` : ''}`);
};

// ── Duplicates and merging ──────────────────────────────────────────────────

export const getDuplicateCandidates = (limit = 50) =>
  apiFetch<{ data: DuplicatePair[] }>(`/customers/duplicates?limit=${limit}`);

/** Fold `loserId` into `survivorId`. Reversible via `unmergeCustomer`. */
export const mergeCustomers = (survivorId: string, loserId: string) =>
  apiFetch<Customer>('/customers/merge', { method: 'POST', body: JSON.stringify({ survivorId, loserId }) });

/** `id` is the record that was merged away. */
export const unmergeCustomer = (id: string) =>
  apiFetch<{ ok: true }>(`/customers/${id}/unmerge`, { method: 'POST' });

// ── Erasure ─────────────────────────────────────────────────────────────────

/**
 * Fulfil a GDPR erasure request by anonymising in place. The row survives so
 * order history stays intact for reporting; the link to a person does not. Not
 * reversible.
 */
export const eraseCustomer = (id: string) =>
  apiFetch<{ ok: true; customer: Customer }>(`/customers/${id}`, { method: 'DELETE' });
