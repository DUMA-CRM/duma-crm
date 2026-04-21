import { apiFetch } from './client';
import type { Tier } from '@/types/customers';

export interface Customer {
  id: string;
  tenantId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dob?: string;
  notes?: string;
  tier: Tier;
  pointsBalance: number;
  totalVisits: number;
  totalSpent: number;
  lastVisitAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomersResponse {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  tier?: Tier | 'all';
  tenantId?: string;
  phoneNumber?: string;
}

export interface CustomerPayload {
  tenantId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dob?: string;
  notes?: string;
}

export const getCustomers = (params: CustomersParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  if (params.tier && params.tier !== 'all') qs.set('tier', params.tier);
  if (params.tenantId) qs.set('tenantId', params.tenantId);
  if (params.phoneNumber) qs.set('phoneNumber', params.phoneNumber);
  const q = qs.toString();
  return apiFetch<CustomersResponse>(`/customers${q ? `?${q}` : ''}`);
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
