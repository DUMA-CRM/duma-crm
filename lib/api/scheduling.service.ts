import { apiFetch } from './client';

// ── Enums ───────────────────────────────────────────────────────────────────

export type ScheduledShiftStatus = 'draft' | 'published' | 'cancelled';

// ── Embedded shapes ───────────────────────────────────────────────────────────

export interface ScheduledShiftStaff {
  userId: string;
  user?: { id: string; name: string; email: string };
}

export interface ScheduledShiftLocation {
  id: string;
  name: string;
}

export interface ScheduledShift {
  id: string;
  locationId: string;
  userId?: string | null;
  startsAt: string;
  endsAt: string;
  role?: string;
  status: ScheduledShiftStatus;
  notes?: string;
  createdAt: string;
  staff?: ScheduledShiftStaff;
  location?: ScheduledShiftLocation;
}

// ── Payloads ────────────────────────────────────────────────────────────────

export interface CreateScheduledShiftPayload {
  locationId: string;
  userId?: string | null;
  startsAt: string;
  endsAt: string;
  role?: string;
  status?: ScheduledShiftStatus;
  notes?: string;
}

export interface UpdateScheduledShiftPayload {
  userId?: string | null;
  startsAt?: string;
  endsAt?: string;
  role?: string;
  status?: ScheduledShiftStatus;
  notes?: string;
}

export interface ScheduledShiftFilters {
  locationId?: string;
  userId?: string;
  status?: ScheduledShiftStatus;
  from?: string;
  to?: string;
}

// ── Suggestions ───────────────────────────────────────────────────────────────

export interface StaffSuggestion {
  userId: string;
  name: string;
  scheduledHoursThisWeek: number;
  reason: string;
}

// ── Coverage ────────────────────────────────────────────────────────────────

export interface CoverageParams {
  locationId?: string;
  lookbackDays?: number;
  ordersPerStaff?: number;
  minStaff?: number;
  byWeekday?: boolean;
}

export interface CoverageHourRow {
  hour: number;
  avgOrders: number;
  recommendedStaff: number;
}

export interface CoverageWeekdayRow extends CoverageHourRow {
  weekday: number;
  weekdayName: string;
}

export type CoverageRow = CoverageHourRow | CoverageWeekdayRow;

export interface CoverageResponse {
  params: CoverageParams;
  coverage: CoverageRow[];
}

export function isWeekdayRow(row: CoverageRow): row is CoverageWeekdayRow {
  return 'weekdayName' in row;
}

// ── Variance (planned vs actual) ──────────────────────────────────────────────

export type VarianceStatus = 'no_show' | 'in_progress' | 'worked';

export interface VarianceRow {
  scheduledShiftId: string;
  staff: { id: string; name: string; email: string } | null;
  startsAt: string;
  endsAt: string;
  plannedMinutes: number;
  status: VarianceStatus;
  startDeltaMinutes: number | null;
  workedMinutes: number;
}

export interface VarianceFilters {
  locationId?: string;
  from?: string;
  to?: string;
}

// ── Publish ─────────────────────────────────────────────────────────────────

export interface PublishPayload {
  locationId: string;
  from?: string;
  to?: string;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const getScheduledShifts = (filters: ScheduledShiftFilters = {}) => {
  const qs = new URLSearchParams();
  if (filters.locationId) qs.set('locationId', filters.locationId);
  if (filters.userId) qs.set('userId', filters.userId);
  if (filters.status) qs.set('status', filters.status);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  const q = qs.toString();
  return apiFetch<ScheduledShift[]>(`/scheduled-shifts${q ? `?${q}` : ''}`);
};

export const getMyScheduledShifts = (params: { from?: string; to?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const q = qs.toString();
  return apiFetch<ScheduledShift[]>(`/scheduled-shifts/my${q ? `?${q}` : ''}`);
};

export const getScheduledShift = (id: string) => apiFetch<ScheduledShift>(`/scheduled-shifts/${id}`);

export const createScheduledShift = (data: CreateScheduledShiftPayload) =>
  apiFetch<ScheduledShift>('/scheduled-shifts', { method: 'POST', body: JSON.stringify(data) });

export const updateScheduledShift = (id: string, data: UpdateScheduledShiftPayload) =>
  apiFetch<ScheduledShift>(`/scheduled-shifts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteScheduledShift = (id: string) =>
  apiFetch<{ success: boolean; id: string }>(`/scheduled-shifts/${id}`, { method: 'DELETE' });

export const getStaffSuggestions = (params: { locationId: string; startsAt: string; endsAt: string }) => {
  const qs = new URLSearchParams();
  qs.set('locationId', params.locationId);
  qs.set('startsAt', params.startsAt);
  qs.set('endsAt', params.endsAt);
  return apiFetch<StaffSuggestion[]>(`/scheduled-shifts/suggestions?${qs.toString()}`);
};

export const getCoverage = (params: CoverageParams = {}) => {
  const qs = new URLSearchParams();
  if (params.locationId) qs.set('locationId', params.locationId);
  if (params.lookbackDays != null) qs.set('lookbackDays', String(params.lookbackDays));
  if (params.ordersPerStaff != null) qs.set('ordersPerStaff', String(params.ordersPerStaff));
  if (params.minStaff != null) qs.set('minStaff', String(params.minStaff));
  if (params.byWeekday) qs.set('byWeekday', 'true');
  const q = qs.toString();
  return apiFetch<CoverageResponse>(`/scheduled-shifts/coverage${q ? `?${q}` : ''}`);
};

export const getVariance = (filters: VarianceFilters = {}) => {
  const qs = new URLSearchParams();
  if (filters.locationId) qs.set('locationId', filters.locationId);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  const q = qs.toString();
  return apiFetch<VarianceRow[]>(`/scheduled-shifts/variance${q ? `?${q}` : ''}`);
};

export const publishScheduledShifts = (data: PublishPayload) =>
  apiFetch<{ published: number }>('/scheduled-shifts/publish', { method: 'POST', body: JSON.stringify(data) });
