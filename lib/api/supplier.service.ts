import { apiFetch } from './client';

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SupplierPayload {
  tenantId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export const getSuppliers = () => apiFetch<Supplier[]>('/supplier-management');

export const getSupplier = (id: string) => apiFetch<Supplier>(`/supplier-management/${id}`);

export const createSupplier = (data: SupplierPayload) =>
  apiFetch<Supplier>('/supplier-management', { method: 'POST', body: JSON.stringify(data) });

export const updateSupplier = (id: string, data: Partial<Omit<SupplierPayload, 'tenantId'>>) =>
  apiFetch<Supplier>(`/supplier-management/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteSupplier = (id: string) => apiFetch<void>(`/supplier-management/${id}`, { method: 'DELETE' });
