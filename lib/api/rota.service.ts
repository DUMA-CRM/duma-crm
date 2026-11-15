import { apiFetch } from './client';
import type { ScheduledShift } from './scheduling.service';

// ---------------------------------------------------------------------------
// The pro rota: the week planner bundle, positions, availability, templates,
// labour targets and staff shift requests (claims, swaps, drops). Mounted at
// `/rota` in duma-api. Weekdays here are 0 = Monday … 6 = Sunday; minutes are
// minutes from local midnight.
// ---------------------------------------------------------------------------

export type AvailabilityKind = 'unavailable' | 'preferred';

export interface Availability {
  id: string;
  userId: string;
  weekday: number;
  /** Both null = the whole day. */
  startMinute: number | null;
  endMinute: number | null;
  kind: AvailabilityKind;
  note: string | null;
}

export type AvailabilityRule = Omit<Availability, 'id' | 'userId'>;

export interface Position {
  id: string;
  /** Null = every location. */
  locationId: string | null;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface PositionWithStaff extends Position {
  staffIds: string[];
}

/** The working-time limits shifts are checked against. Null switches a rule off. */
export interface WorkingTimeRules {
  breakAfterMinutes: number | null;
  minBreakMinutes: number;
  restMinutes: number | null;
  weeklyMinutes: number | null;
  minorDailyMinutes: number | null;
  minorWeeklyMinutes: number | null;
  minorRestMinutes: number | null;
  minorBreakAfterMinutes: number | null;
  minorMinBreakMinutes: number;
}

export interface LabourTargets {
  locationId: string;
  targetLabourPct: string | null;
  weeklyBudget: string | null;
  /** Employer NI and pension on top of wages, as a percentage. */
  onCostPct: string;
  rules: Partial<WorkingTimeRules>;
}

export interface PlannerStaff {
  userId: string;
  name: string;
  email: string | null;
  contractedWeeklyHours: string | null;
  /** Null unless the caller can see pay. */
  hourlyRate: string | null;
  isMinor: boolean;
  positionIds: string[];
  availability: Availability[];
}

export interface PlannerLeave {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved';
  typeName: string | null;
}

export interface PlannerSales {
  date: string;
  actual: string | null;
  forecast: string;
}

export interface RotaPlanner {
  location: { id: string; name: string; timeZone: string };
  weekStart: string;
  staff: PlannerStaff[];
  positions: Position[];
  shifts: ScheduledShift[];
  leave: PlannerLeave[];
  sales: PlannerSales[];
  targets: LabourTargets;
  pendingRequests: number;
}

export type FillMode = 'skip_clashes' | 'replace' | 'open';

export interface FillResult {
  created: number;
  skipped: number;
  opened: number;
}

export interface RotaTemplate {
  id: string;
  locationId: string;
  name: string;
  weeks: number;
  createdAt: string;
  updatedAt: string;
}

export interface RotaTemplateShift {
  id: string;
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  userId: string | null;
  positionId: string | null;
  role: string | null;
  breakMinutes: number;
  notes: string | null;
}

export type ShiftRequestKind = 'claim' | 'swap' | 'drop';
export type ShiftRequestStatus = 'pending' | 'accepted' | 'approved' | 'declined' | 'cancelled';

export interface ShiftRequestShift {
  id: string;
  startsAt: string;
  endsAt: string;
  positionId: string | null;
  userId: string | null;
}

export interface ShiftRequest {
  id: string;
  locationId: string;
  kind: ShiftRequestKind;
  status: ShiftRequestStatus;
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
  shift: ShiftRequestShift;
  targetShift: ShiftRequestShift | null;
  requester: { userId: string; name: string };
  targetUser: { userId: string; name: string } | null;
}

export interface CreateShiftRequestPayload {
  kind: ShiftRequestKind;
  scheduledShiftId: string;
  targetUserId?: string;
  targetShiftId?: string;
  note?: string;
}

const query = (params: Record<string, string | undefined>) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) qs.set(key, value);
  const q = qs.toString();
  return q ? `?${q}` : '';
};

const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

// ── Planner ─────────────────────────────────────────────────────────────────

export const getRotaPlanner = (locationId: string, weekStart: string) =>
  apiFetch<RotaPlanner>(`/rota/planner${query({ locationId, weekStart })}`);

// ── Positions ───────────────────────────────────────────────────────────────

export const getPositions = (locationId?: string) => apiFetch<PositionWithStaff[]>(`/rota/positions${query({ locationId })}`);

export const createPosition = (data: { name: string; locationId?: string | null; color?: string }) =>
  post<Position>('/rota/positions', data);

export const updatePosition = (id: string, data: Partial<Pick<Position, 'name' | 'color' | 'sortOrder' | 'isActive'>>) =>
  apiFetch<Position>(`/rota/positions/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deletePosition = (id: string) => apiFetch<{ success: true }>(`/rota/positions/${id}`, { method: 'DELETE' });

export const setPositionStaff = (id: string, userIds: string[]) =>
  apiFetch<{ staffIds: string[] }>(`/rota/positions/${id}/staff`, { method: 'PUT', body: JSON.stringify({ userIds }) });

// ── Availability ────────────────────────────────────────────────────────────

export const getAvailability = (userId: string) => apiFetch<Availability[]>(`/rota/availability${query({ userId })}`);

export const setAvailability = (userId: string, rules: AvailabilityRule[]) =>
  apiFetch<Availability[]>(`/rota/availability/${encodeURIComponent(userId)}`, { method: 'PUT', body: JSON.stringify({ rules }) });

export const getMyAvailability = () => apiFetch<Availability[]>('/rota/availability/me');

export const setMyAvailability = (rules: AvailabilityRule[]) =>
  apiFetch<Availability[]>('/rota/availability/me', { method: 'PUT', body: JSON.stringify({ rules }) });

// ── Templates ───────────────────────────────────────────────────────────────

export const getRotaTemplates = (locationId: string) =>
  apiFetch<Array<RotaTemplate & { shiftCount: number }>>(`/rota/templates${query({ locationId })}`);

export const getRotaTemplate = (id: string) => apiFetch<RotaTemplate & { shifts: RotaTemplateShift[] }>(`/rota/templates/${id}`);

export const createTemplateFromWeek = (data: { locationId: string; weekStart: string; weeks: number; name: string }) =>
  post<RotaTemplate>('/rota/templates/from-week', data);

export const renameRotaTemplate = (id: string, name: string) =>
  apiFetch<RotaTemplate>(`/rota/templates/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });

export const deleteRotaTemplate = (id: string) => apiFetch<{ success: true }>(`/rota/templates/${id}`, { method: 'DELETE' });

export const applyRotaTemplate = (id: string, data: { weekStart: string; mode: FillMode }) =>
  post<FillResult>(`/rota/templates/${id}/apply`, data);

// ── Labour targets ──────────────────────────────────────────────────────────

export const getLabourTargets = (locationId: string) => apiFetch<LabourTargets>(`/rota/targets/${locationId}`);

export const setLabourTargets = (locationId: string, data: Omit<LabourTargets, 'locationId'>) =>
  apiFetch<LabourTargets>(`/rota/targets/${locationId}`, { method: 'PUT', body: JSON.stringify(data) });

// ── Shift requests ──────────────────────────────────────────────────────────

export const getShiftRequests = (params: { locationId?: string; status?: ShiftRequestStatus } = {}) =>
  apiFetch<ShiftRequest[]>(`/rota/requests${query(params)}`);

export const getMyShiftRequests = () => apiFetch<ShiftRequest[]>('/rota/requests/my');

export const createShiftRequest = (data: CreateShiftRequestPayload) => post<ShiftRequest>('/rota/requests', data);

export const acceptShiftRequest = (id: string) => post<ShiftRequest>(`/rota/requests/${id}/accept`);

export const cancelShiftRequest = (id: string) => post<ShiftRequest>(`/rota/requests/${id}/cancel`);

export const declineShiftRequest = (id: string) => post<ShiftRequest>(`/rota/requests/${id}/decline`);

/** 409 with `warnings` when the result breaks a working-time rule; resend with `override: true` to approve anyway. */
export const approveShiftRequest = (id: string, override = false) =>
  post<ShiftRequest>(`/rota/requests/${id}/approve`, { override });
