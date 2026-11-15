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
  positionId?: string | null;
  /** Unpaid break inside the shift. */
  breakMinutes?: number;
  /** When staff were last shown this shift; null while it's a draft. */
  publishedAt?: string | null;
  /** When the assigned person confirmed they'd seen it; reset by every change after publishing. */
  acknowledgedAt?: string | null;
  createdAt: string;
  staff?: ScheduledShiftStaff;
  location?: ScheduledShiftLocation;
  position?: { id: string; name: string; color: string } | null;
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
  positionId?: string | null;
  breakMinutes?: number;
}

export interface UpdateScheduledShiftPayload {
  userId?: string | null;
  startsAt?: string;
  endsAt?: string;
  role?: string;
  status?: ScheduledShiftStatus;
  notes?: string;
  positionId?: string | null;
  breakMinutes?: number;
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
  /** Tell the staff on the published shifts. Defaults to true. */
  notify?: boolean;
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
  apiFetch<{ published: number; notified: number }>('/scheduled-shifts/publish', { method: 'POST', body: JSON.stringify(data) });

export const createScheduledShiftsBulk = (shifts: CreateScheduledShiftPayload[]) =>
  apiFetch<{ created: ScheduledShift[] }>('/scheduled-shifts/bulk', { method: 'POST', body: JSON.stringify({ shifts }) });

/** Deletes drafts only; published shifts in `ids` come back as `skipped`. */
export const deleteScheduledShiftsBulk = (ids: string[]) =>
  apiFetch<{ deleted: number; skipped: number }>('/scheduled-shifts/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) });

export const copyRotaWeek = (data: { locationId: string; fromWeekStart: string; toWeekStart: string; mode: 'skip_clashes' | 'replace' | 'open' }) =>
  apiFetch<{ created: number; skipped: number; opened: number }>('/scheduled-shifts/copy', { method: 'POST', body: JSON.stringify(data) });

export const acknowledgeScheduledShift = (id: string) =>
  apiFetch<ScheduledShift>(`/scheduled-shifts/${id}/acknowledge`, { method: 'POST' });

/** Published open shifts at my locations that I'm qualified for. */
export const getMyOpenShifts = () =>
  apiFetch<Array<ScheduledShift & { myRequestId: string | null }>>('/scheduled-shifts/open/my');
