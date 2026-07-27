import { apiFetch } from './client';

export interface LeaveType {
  id: string;
  name: string;
  isPaid: boolean;
  requiresApproval: boolean;
  defaultAllowanceDays?: string | null;
}
export interface LeaveEntitlement {
  id: string;
  year: number;
  totalDays: string;
  usedDays: string;
  leaveType: LeaveType;
}
export interface LeaveRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled';
  notes?: string | null;
  reviewNotes?: string | null;
  leaveType: LeaveType;
  employee?: { id: string; name: string; email: string } | null;
  createdAt: string;
}
export type AttendanceStatus = 'full' | 'partial' | 'missed' | 'no_shift' | 'scheduled' | 'leave';
export interface AttendanceDay {
  date: string;
  status: AttendanceStatus;
  plannedMinutes: number;
  workedMinutes: number;
  leaveName?: string | null;
}
export type TicketCategory = 'hr' | 'payroll' | 'scheduling' | 'leave' | 'workplace' | 'it' | 'other';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'waiting_employee' | 'resolved' | 'closed';
export interface HelpdeskTicket {
  id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdBy: string;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; name: string; email: string };
  assignee?: { id: string; name: string } | null;
  messages?: { id: string; authorId: string; authorName: string; body: string; internal: boolean; createdAt: string }[];
}
export interface EmployeeDocument {
  id: string;
  title: string;
  documentType: string;
  reference?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
}
export interface AbsenceLog {
  id: string;
  userId: string;
  date: string;
  isHalfDay: boolean;
  reason?: string | null;
  leaveType?: LeaveType | null;
  createdAt?: string;
}
export interface Payslip {
  id: string;
  userId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  grossPay: string;
  netPay: string;
  taxDeducted: string;
  nationalInsurance?: string | null;
  pensionDeduction?: string | null;
  otherDeductions?: string | null;
  currency: string;
  status: 'draft' | 'finalised';
  documentUrl?: string | null;
  finalisedAt?: string | null;
  createdAt: string;
}

export const getLeaveTypes = () => apiFetch<LeaveType[]>('/hr/leave-types');
export const getMyEntitlements = (year = new Date().getFullYear()) => apiFetch<LeaveEntitlement[]>(`/hr/entitlements/me?year=${year}`);
export const getMyLeaveRequests = () => apiFetch<LeaveRequest[]>('/hr/leave-requests/my');
export const getManagedLeaveRequests = (status = 'pending') => apiFetch<LeaveRequest[]>(`/hr/leave-requests?status=${status}`);
export const getEmployeeEntitlements = (userId: string, year = new Date().getFullYear()) =>
  apiFetch<LeaveEntitlement[]>(`/hr/entitlements?userId=${encodeURIComponent(userId)}&year=${year}`);
export const createLeaveType = (data: { name: string; isPaid?: boolean; requiresApproval?: boolean; defaultAllowanceDays?: string }) =>
  apiFetch<LeaveType>('/hr/leave-types', { method: 'POST', body: JSON.stringify(data) });
export const createEntitlement = (data: { userId: string; leaveTypeId: string; year: number; totalDays: string }) =>
  apiFetch<LeaveEntitlement>('/hr/entitlements', { method: 'POST', body: JSON.stringify(data) });
export const updateEntitlement = (id: string, data: { totalDays?: string; usedDays?: string }) =>
  apiFetch<LeaveEntitlement>(`/hr/entitlements/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const submitLeaveRequest = (data: {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  partialDay?: 'none' | 'start' | 'end';
  notes?: string;
}) => apiFetch<LeaveRequest>('/hr/leave-requests', { method: 'POST', body: JSON.stringify(data) });
export const cancelLeaveRequest = (id: string) => apiFetch<LeaveRequest>(`/hr/leave-requests/${id}/cancel`, { method: 'PATCH' });
export const reviewLeaveRequest = (id: string, status: 'approved' | 'declined', reviewNotes?: string) =>
  apiFetch<LeaveRequest>(`/hr/leave-requests/${id}/review`, { method: 'PATCH', body: JSON.stringify({ status, reviewNotes }) });

export const getMyAttendance = (from: string, to: string) => apiFetch<AttendanceDay[]>(`/hr/attendance/me?from=${from}&to=${to}`);
export const getEmployeeAttendance = (userId: string, from: string, to: string) =>
  apiFetch<AttendanceDay[]>(`/hr/attendance/${userId}?from=${from}&to=${to}`);

export const getMyTickets = () => apiFetch<HelpdeskTicket[]>('/helpdesk/my');
export const getManagedTickets = (filters: { status?: string; category?: string; search?: string } = {}) => {
  const q = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && q.set(key, value));
  return apiFetch<HelpdeskTicket[]>(`/helpdesk/manage${q.size ? `?${q}` : ''}`);
};
export const getTicket = (id: string) => apiFetch<HelpdeskTicket>(`/helpdesk/${id}`);
export const createTicket = (data: { subject: string; category: TicketCategory; priority: TicketPriority; message: string }) =>
  apiFetch<{ id: string }>('/helpdesk', { method: 'POST', body: JSON.stringify(data) });
export const replyTicket = (id: string, message: string, internal = false) =>
  apiFetch<{ success: boolean }>(`/helpdesk/${id}/messages`, { method: 'POST', body: JSON.stringify({ message, internal }) });
export const updateTicket = (id: string, data: { status?: TicketStatus; priority?: TicketPriority; assignedTo?: string | null }) =>
  apiFetch<{ success: boolean }>(`/helpdesk/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const getMyDocuments = () => apiFetch<EmployeeDocument[]>('/hr/documents/me');
export const getEmployeeDocuments = (userId: string) => apiFetch<EmployeeDocument[]>(`/hr/documents/user/${userId}`);
export const addEmployeeDocument = (data: {
  userId: string;
  title: string;
  documentType: string;
  reference?: string;
  issuedAt?: string;
  expiresAt?: string;
  notes?: string;
}) => apiFetch<EmployeeDocument>('/hr/documents', { method: 'POST', body: JSON.stringify(data) });
export const deleteEmployeeDocument = (id: string) => apiFetch<{ success: boolean }>(`/hr/documents/${id}`, { method: 'DELETE' });

export const getEmployeeAbsences = (userId: string) => apiFetch<AbsenceLog[]>(`/hr/absence-logs?userId=${encodeURIComponent(userId)}`);
export const logEmployeeAbsence = (data: { userId: string; leaveTypeId?: string; date: string; isHalfDay?: boolean; reason?: string }) =>
  apiFetch<AbsenceLog>('/hr/absence-logs', { method: 'POST', body: JSON.stringify(data) });
export const deleteEmployeeAbsence = (id: string) => apiFetch<{ success: boolean }>(`/hr/absence-logs/${id}`, { method: 'DELETE' });

export const getEmployeePayslips = (userId: string) => apiFetch<Payslip[]>(`/hr/payslips?userId=${encodeURIComponent(userId)}`);
