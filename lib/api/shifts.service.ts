import { apiFetch } from './client';

// ── Embedded shapes ───────────────────────────────────────────────────────────

export interface ShiftStaff {
  userId?: string;
  name?: string;
  user?: { id: string; name: string; email: string };
}

export interface ShiftLocation {
  id: string;
  name: string;
}

export interface Shift {
  id: string;
  userId: string;
  locationId: string;
  clockedIn: string;
  clockedOut?: string | null;
  scheduledShiftId?: string | null;
  durationMinutes?: number;
  staff?: ShiftStaff;
  location?: ShiftLocation;
}

// ── Payloads ────────────────────────────────────────────────────────────────

export interface ClockInPayload {
  locationId: string;
  scheduledShiftId?: string;
}

export interface ClockOutPayload {
  locationId: string;
}

/** A manager recording time for someone else. Omit `clockedOut` to leave it running. */
export interface ManualShiftPayload {
  userId: string;
  locationId: string;
  clockedIn?: string;
  clockedOut?: string;
  scheduledShiftId?: string;
}

/** Ends or corrects a recorded shift. `clockedOut: null` reopens one closed by mistake. */
export interface AdjustShiftPayload {
  clockedIn?: string;
  clockedOut?: string | null;
  scheduledShiftId?: string | null;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const clockIn = (data: ClockInPayload) => apiFetch<Shift>('/shifts/clock-in', { method: 'POST', body: JSON.stringify(data) });

export const clockOut = (data: ClockOutPayload) =>
  apiFetch<Shift & { durationMinutes: number }>('/shifts/clock-out', { method: 'POST', body: JSON.stringify(data) });

// store_manager+ — clocking on behalf of a staff member, and correcting the record.
export const createManualShift = (data: ManualShiftPayload) =>
  apiFetch<Shift & { durationMinutes: number | null }>('/shifts/manual', { method: 'POST', body: JSON.stringify(data) });

export const adjustShift = (id: string, data: AdjustShiftPayload) =>
  apiFetch<Shift & { durationMinutes: number | null }>(`/shifts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const getActiveShifts = () => apiFetch<Shift[]>('/shifts/active');

export const getMyShifts = () => apiFetch<Shift[]>('/shifts/my');

export const getShifts = (params: { locationId?: string } = {}) => {
  const qs = new URLSearchParams();
  if (params.locationId) qs.set('locationId', params.locationId);
  const q = qs.toString();
  return apiFetch<Shift[]>(`/shifts${q ? `?${q}` : ''}`);
};
