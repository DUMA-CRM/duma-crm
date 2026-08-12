import type { CustomerFilters, CustomerSegment, SegmentEvaluation, SegmentRecipients } from '@/types/customers';

import { apiFetch } from './client';

/**
 * Saved customer segments — named, reusable filters.
 *
 * A segment is a *query*, not a stored list of people: its membership changes as
 * the base does, which is why counts come from evaluating it rather than from a
 * column. The list endpoint and a segment run the same filter builder on the
 * server, so previewing a segment and browsing with its filters agree.
 */

export const getSegments = () => apiFetch<{ data: CustomerSegment[] }>('/customer-segments');

/** Saved definition plus a live count and sample. */
export const getSegment = (id: string) =>
  apiFetch<{ segment: CustomerSegment } & SegmentEvaluation>(`/customer-segments/${id}`);

/** Count and sample a filter without saving it. */
export const previewSegment = (filters: CustomerFilters) =>
  apiFetch<SegmentEvaluation>('/customer-segments/preview', { method: 'POST', body: JSON.stringify({ filters }) });

export const createSegment = (data: { name: string; description?: string | null; filters: CustomerFilters }) =>
  apiFetch<CustomerSegment>('/customer-segments', { method: 'POST', body: JSON.stringify(data) });

export const updateSegment = (
  id: string,
  data: Partial<{ name: string; description: string | null; filters: CustomerFilters }>,
) => apiFetch<CustomerSegment>(`/customer-segments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

/** Removes the saved filter only — customers are untouched. */
export const deleteSegment = (id: string) =>
  apiFetch<{ ok: true }>(`/customer-segments/${id}`, { method: 'DELETE' });

/**
 * Resolve a segment to email recipients.
 *
 * Consent is applied server-side in the resolver, not here — `excludedByConsent`
 * reports how many the segment selected but could not lawfully be emailed, so the
 * shrinking audience is visible rather than mysterious.
 */
export const getSegmentRecipients = (id: string, limit = 500) =>
  apiFetch<SegmentRecipients>(`/customer-segments/${id}/recipients?limit=${limit}`);
