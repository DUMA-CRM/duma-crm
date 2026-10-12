// ─── Reservations ─────────────────────────────────────────────────────────────
//
// Each location's floor plan, its bookings and the walk-in waitlist (the
// reservations module, /v1/reservations). Every call names one location. The
// API is the one place a clash is decided: it locks the tables and refuses a
// second live booking over the same one with a 409 that names them.
import type { BookingSource, FloorTable, ReservationStatus, WaitlistStatus } from '@/lib/utils/reservations';

import { apiFetch } from './client';

export type { BookingSource, DiningTableShape, FloorTable, ReservationStatus, WaitlistStatus } from '@/lib/utils/reservations';

export interface DiningArea {
  id: string;
  locationId: string;
  name: string;
  sortOrder: number;
  tables: FloorTable[];
}

export interface Booking {
  id: string;
  locationId: string;
  customerId: string | null;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  partySize: number;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  source: BookingSource;
  notes: string | null;
  seatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  tables: { id: string; label: string }[];
}

export interface BookingInput {
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  customerId?: string | null;
  partySize: number;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
  source?: BookingSource;
  tableIds?: string[];
  /** Email the guest a confirmation (new bookings; when they gave an address and the location sends them). */
  sendConfirmation?: boolean;
}

export interface TableAvailability {
  id: string;
  label: string;
  areaId: string;
  minCovers: number;
  maxCovers: number;
  free: boolean;
  seatsParty: boolean;
  clashes: { reservationId: string; guestName: string; startsAt: string }[];
}

export interface WaitlistEntry {
  id: string;
  locationId: string;
  customerId: string | null;
  guestName: string;
  guestPhone: string | null;
  partySize: number;
  quotedWaitMinutes: number | null;
  status: WaitlistStatus;
  notes: string | null;
  reservationId: string | null;
  notifiedAt: string | null;
  seatedAt: string | null;
  removedAt: string | null;
  createdAt: string;
}

export interface WaitlistInput {
  guestName: string;
  guestPhone?: string | null;
  customerId?: string | null;
  partySize: number;
  quotedWaitMinutes?: number | null;
  notes?: string | null;
}

export type TableInput = Pick<FloorTable, 'label' | 'minCovers' | 'maxCovers' | 'shape' | 'x' | 'y' | 'width' | 'height' | 'rotation'> & {
  areaId: string;
};
export type TablePosition = Pick<FloorTable, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation'>;

/** A write that went through, with what's worth a word — too few seats, outside the opening hours. */
type Saved<T> = { data: T; warnings: string[] };

// ─── The floor plan ───────────────────────────────────────────────────────────

export const getFloorPlan = (locationId: string) =>
  apiFetch<{ data: { areas: DiningArea[] } }>(`/reservations/floor?locationId=${locationId}`).then((response) => response.data.areas);

export const createArea = (locationId: string, name: string) =>
  apiFetch<{ data: DiningArea }>('/reservations/areas', { method: 'POST', body: JSON.stringify({ locationId, name }) }).then(
    (response) => response.data,
  );

export const updateArea = (id: string, patch: { name?: string; sortOrder?: number }) =>
  apiFetch<{ data: DiningArea }>(`/reservations/areas/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(
    (response) => response.data,
  );

export const deleteArea = (id: string) => apiFetch<{ data: { id: string } }>(`/reservations/areas/${id}`, { method: 'DELETE' });

export const createTable = (input: TableInput) =>
  apiFetch<{ data: FloorTable }>('/reservations/tables', { method: 'POST', body: JSON.stringify(input) }).then((response) => response.data);

export const updateTable = (id: string, patch: Partial<TableInput>) =>
  apiFetch<{ data: FloorTable }>(`/reservations/tables/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(
    (response) => response.data,
  );

export const removeTable = (id: string) => apiFetch<{ data: { id: string } }>(`/reservations/tables/${id}`, { method: 'DELETE' });

export const saveLayout = (locationId: string, tables: TablePosition[]) =>
  apiFetch<{ data: { saved: number } }>('/reservations/floor/layout', { method: 'PUT', body: JSON.stringify({ locationId, tables }) });

// ─── Bookings ─────────────────────────────────────────────────────────────────

export const getBookings = (locationId: string, range: { from: string; to: string }) => {
  const query = new URLSearchParams({ locationId, from: range.from, to: range.to });
  return apiFetch<{ data: Booking[] }>(`/reservations?${query}`).then((response) => response.data);
};

export const getAvailability = (
  locationId: string,
  window: { startsAt: string; endsAt: string; partySize?: number; excludeReservationId?: string | null },
) => {
  const query = new URLSearchParams({ locationId, startsAt: window.startsAt, endsAt: window.endsAt });
  if (window.partySize) query.set('partySize', String(window.partySize));
  if (window.excludeReservationId) query.set('excludeReservationId', window.excludeReservationId);
  return apiFetch<{ data: TableAvailability[] }>(`/reservations/availability?${query}`).then((response) => response.data);
};

export const createBooking = (locationId: string, input: BookingInput & { status?: 'booked' | 'confirmed' }) =>
  apiFetch<Saved<Booking>>('/reservations', { method: 'POST', body: JSON.stringify({ locationId, ...input }) });

export const updateBooking = (id: string, patch: Partial<BookingInput>) =>
  apiFetch<Saved<Booking>>(`/reservations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const setBookingStatus = (id: string, status: ReservationStatus) =>
  apiFetch<{ data: Booking }>(`/reservations/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }).then(
    (response) => response.data,
  );

// ─── The waitlist ─────────────────────────────────────────────────────────────

export const getWaitlist = (locationId: string, recent = false) =>
  apiFetch<{ data: WaitlistEntry[] }>(`/reservations/waitlist?locationId=${locationId}${recent ? '&recent=true' : ''}`).then(
    (response) => response.data,
  );

export const addToWaitlist = (locationId: string, input: WaitlistInput) =>
  apiFetch<{ data: WaitlistEntry }>('/reservations/waitlist', { method: 'POST', body: JSON.stringify({ locationId, ...input }) }).then(
    (response) => response.data,
  );

export const updateWaitlistEntry = (id: string, patch: Partial<WaitlistInput>) =>
  apiFetch<{ data: WaitlistEntry }>(`/reservations/waitlist/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then(
    (response) => response.data,
  );

export const setWaitlistStatus = (id: string, status: Exclude<WaitlistStatus, 'seated'>) =>
  apiFetch<{ data: WaitlistEntry }>(`/reservations/waitlist/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }).then(
    (response) => response.data,
  );

export const seatWaitlistEntry = (id: string, tableIds: string[], durationMinutes: number) =>
  apiFetch<{ data: { entry: WaitlistEntry; reservation: Booking } }>(`/reservations/waitlist/${id}/seat`, {
    method: 'POST',
    body: JSON.stringify({ tableIds, durationMinutes }),
  }).then((response) => response.data);

// ─── Booking rules ────────────────────────────────────────────────────────────

export interface ReservationSettings {
  locationId: string;
  onlineEnabled: boolean;
  slotIntervalMinutes: number;
  turnBufferMinutes: number;
  onlineDurationMinutes: number;
  onlineMaxPartySize: number;
  minNoticeMinutes: number;
  bookingHorizonDays: number;
  guestMessage: string | null;
  /** False until first saved — the guest link exists from then. */
  saved: boolean;
  publicUrl: string | null;
  hasOpeningHours: boolean;
  /** Whether guest emails can go anywhere: Communications on and an account connected. */
  email: { ready: boolean; reason: 'module_off' | 'no_connection' | null };
}

export type ReservationSettingsInput = Partial<
  Omit<ReservationSettings, 'locationId' | 'saved' | 'publicUrl' | 'hasOpeningHours' | 'email'>
>;

export const getReservationSettings = (locationId: string) =>
  apiFetch<{ data: ReservationSettings }>(`/reservations/settings?locationId=${locationId}`).then((response) => response.data);

export const saveReservationSettings = (locationId: string, changes: ReservationSettingsInput) =>
  apiFetch<{ data: ReservationSettings }>('/reservations/settings', {
    method: 'PUT',
    body: JSON.stringify({ locationId, ...changes }),
  }).then((response) => response.data);

export const replaceBookingLink = (locationId: string) =>
  apiFetch<{ data: ReservationSettings }>('/reservations/settings/new-link', { method: 'POST', body: JSON.stringify({ locationId }) }).then(
    (response) => response.data,
  );

// ─── One customer ─────────────────────────────────────────────────────────────

export type CustomerBooking = Booking & { locationName: string };

export const getCustomerBookings = (customerId: string) =>
  apiFetch<{ data: CustomerBooking[] }>(`/reservations/customer/${customerId}`).then((response) => response.data);

// ─── The guest's booking page (public) ────────────────────────────────────────

export interface GuestPlace {
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
}

export interface BookingPage {
  brandName: string;
  location: GuestPlace;
  /** Today in the location's zone, `YYYY-MM-DD`. */
  today: string;
  maxPartySize: number;
  bookingHorizonDays: number;
  durationMinutes: number;
  guestMessage: string | null;
  hasOpeningHours: boolean;
}

export interface OpenTimes {
  date: string;
  open: boolean;
  /** Why there are no times: closed that day, out of range, no table seats the party, or fully booked. */
  reason: 'no_hours' | 'closed' | 'too_far' | 'past' | 'no_table' | 'full' | null;
  slots: { startsAt: string; time: string }[];
}

export interface GuestBookingInput {
  startsAt: string;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  notes?: string;
}

export interface GuestBooking {
  guestName: string;
  partySize: number;
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
  canCancel: boolean;
  brandName: string;
  location: GuestPlace;
}

export const getBookingPage = (token: string) =>
  apiFetch<{ data: BookingPage }>(`/reservations/public/${encodeURIComponent(token)}`).then((response) => response.data);

export const getOpenTimes = (token: string, date: string, partySize: number) =>
  apiFetch<{ data: OpenTimes }>(`/reservations/public/${encodeURIComponent(token)}/slots?date=${date}&partySize=${partySize}`).then(
    (response) => response.data,
  );

export const bookTable = (token: string, input: GuestBookingInput) =>
  apiFetch<{ data: { manageToken: string; guestName: string; partySize: number; startsAt: string; location: GuestPlace } }>(
    `/reservations/public/${encodeURIComponent(token)}/bookings`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then((response) => response.data);

export const getGuestBooking = (manageToken: string) =>
  apiFetch<{ data: GuestBooking }>(`/reservations/public/manage/${encodeURIComponent(manageToken)}`).then((response) => response.data);

export const cancelGuestBooking = (manageToken: string) =>
  apiFetch<{ data: GuestBooking }>(`/reservations/public/manage/${encodeURIComponent(manageToken)}/cancel`, { method: 'POST' }).then(
    (response) => response.data,
  );

// ─── Guest emails: Communications automations ────────────────────────────────

export type BookingEmailTrigger = 'reservation_confirmed' | 'reservation_reminder' | 'reservation_cancelled';

export interface BookingEmailAutomation {
  id: string;
  name: string;
  trigger: BookingEmailTrigger;
  isEnabled: boolean;
  published: boolean;
  locationId: string | null;
  /** The reminder's hours before the booking; null for the others. */
  offsetHours: number | null;
}

export interface GuestEmails {
  email: ReservationSettings['email'];
  automations: BookingEmailAutomation[];
}

/** The workspace's automations that email booking guests. Nothing is sent for a moment without an enabled one. */
export const getGuestEmails = (locationId: string) =>
  apiFetch<{ data: GuestEmails }>(`/reservations/guest-emails?locationId=${locationId}`).then((response) => response.data);

/** Create the starter template and automation for each moment that has none — live, or drafts to review. */
export const setUpGuestEmails = (locationId: string, live: boolean) =>
  apiFetch<{ data: GuestEmails & { made: number } }>('/reservations/guest-emails/setup', {
    method: 'POST',
    body: JSON.stringify({ locationId, live }),
  }).then((response) => response.data);
