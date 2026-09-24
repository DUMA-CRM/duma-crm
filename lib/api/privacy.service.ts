import { API_PREFIX, apiFetch } from './client';

export type PrivacyRequestType = 'access' | 'erasure' | 'rectification' | 'restriction' | 'portability' | 'objection';
export type PrivacyRequestStatus = 'received' | 'in_progress' | 'awaiting_identity' | 'completed' | 'declined';

export interface PrivacyRequest {
  id: string;
  tenantId: string;
  customerId?: string | null;
  subjectType: 'customer' | 'employee';
  employeeUserId?: string | null;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  requestChannel: string;
  details?: string | null;
  resolutionNotes?: string | null;
  receivedAt: string;
  dueAt: string;
  assignedTo?: string | null;
  completedAt?: string | null;
  customerSnapshot?: { name: string; email?: string | null; phone?: string | null } | null;
  employeeSnapshot?: { name: string; email?: string | null } | null;
  customer?: { id: string; firstName: string; lastName: string; email?: string | null; phone: string } | null;
}

const query = (params: Record<string, string | undefined>) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value && qs.set(key, value));
  return qs.toString();
};

export const getPrivacyRequests = (params: { tenantId?: string; customerId?: string; employeeUserId?: string; status?: string } = {}) =>
  apiFetch<PrivacyRequest[]>(`/privacy-requests?${query(params)}`);
type CustomerPrivacySubject = { subjectType: 'customer'; customerId: string; employeeUserId?: never };
type EmployeePrivacySubject = { subjectType: 'employee'; employeeUserId: string; customerId?: never };
export const createPrivacyRequest = (
  data: (CustomerPrivacySubject | EmployeePrivacySubject) & {
    tenantId?: string;
    type: PrivacyRequestType;
    requestChannel: string;
    details?: string;
  },
) => apiFetch<PrivacyRequest>('/privacy-requests', { method: 'POST', body: JSON.stringify(data) });
export const updatePrivacyRequest = (id: string, data: { status?: Exclude<PrivacyRequestStatus, 'completed'>; resolutionNotes?: string }) =>
  apiFetch<PrivacyRequest>(`/privacy-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const completePrivacyRequest = (id: string, resolutionNotes: string) =>
  apiFetch<PrivacyRequest>(`/privacy-requests/${id}/complete`, { method: 'POST', body: JSON.stringify({ resolutionNotes }) });
export const privacyExportUrl = (id: string) => `${API_PREFIX}/v1/privacy-requests/${id}/export`;
