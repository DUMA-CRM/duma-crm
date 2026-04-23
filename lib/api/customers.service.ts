import type { Customer, CustomerPayload, CustomersParams, CustomersResponse } from '@/types/customers';

import { apiFetch } from './client';

export const getCustomers = (params: CustomersParams = {}) => {
  const qs = new URLSearchParams();

  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  if (params.tier && params.tier !== 'all') qs.set('tier', params.tier);
  if (params.tenantId) qs.set('tenantId', params.tenantId);
  if (params.phoneNumber) qs.set('phoneNumber', params.phoneNumber);

  const queryString = qs.toString();
  const queryPart = queryString ? '?' + queryString : '';

  return apiFetch<CustomersResponse>('/customers' + queryPart);
};

export const getCustomer = (id: string) => apiFetch<Customer>(`/customers/${id}`);

export const createCustomer = (data: CustomerPayload) => apiFetch<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) });

export const updateCustomer = (id: string, data: Partial<Omit<CustomerPayload, 'tenantId'>>) =>
  apiFetch<Customer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const adjustPoints = (id: string, delta: number, reason?: string) =>
  apiFetch<Customer>(`/customers/${id}/points`, {
    method: 'PATCH',
    body: JSON.stringify({ delta, ...(reason ? { reason } : {}) }),
  });
