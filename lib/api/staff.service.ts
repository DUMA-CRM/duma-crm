import { ApiError, apiFetch } from './client';

export type StaffRole = 'super_admin' | 'franchise_owner' | 'store_manager' | 'barista' | 'hr_manager' | 'marketing_manager' | 'auditor';
export type StaffScope = 'global' | 'franchise' | 'location';

// There is deliberately no ROLE_RANK / roleAtLeast here any more. Authority is
// not a single number: ranking `marketing_manager` below `store_manager` hid the
// customer base from the role that owns it, and ranking `auditor` above
// `barista` let a read-only role take payments. Gate features on capabilities
// instead — see lib/auth/capabilities.ts. `role` remains for display and for the
// few genuinely role-shaped questions, such as which accounts are pinned to a
// set of locations.

// The API returns the account details nested under `user`. We flatten `name`/
// `email`/`image` onto the profile (see `normalizeStaff`) so callers can read
// them directly instead of digging into `.user`.
export interface StaffUser {
  id: string;
  name?: string;
  email?: string;
  image?: string | null;
}

export interface StaffProfile {
  id: string;
  userId: string;
  tenantId: string;
  name?: string;
  email?: string;
  image?: string | null;
  role: StaffRole;
  scope: StaffScope;
  isActive: boolean;
  locationIds?: string[];
  createdAt: string;
  user?: StaffUser;
  // The capabilities this role holds, exactly as the API authorises on them.
  // Only `GET /staff/me` returns these — rows from `GET /staff` (the team list)
  // describe other people and carry no capability list, hence optional.
  capabilities?: string[];
}

// Lift the nested `user` fields to the top level so `profile.name` / `profile.email`
// resolve everywhere (staff table, HR screens, rota, etc.).
function normalizeStaff(p: StaffProfile): StaffProfile {
  return {
    ...p,
    name: p.name ?? p.user?.name,
    email: p.email ?? p.user?.email,
    image: p.image ?? p.user?.image ?? null,
  };
}

export interface CreateStaffPayload {
  email: string;
  name: string;
  tenantId: string;
  role: StaffRole;
  scope: StaffScope;
  locationIds?: string[];
}

export interface UpdateStaffPayload {
  role?: StaffRole;
  scope?: StaffScope;
  locationIds?: string[];
  isActive?: boolean;
}

export const getStaff = async (tenantId?: string) => {
  const qs = tenantId ? `?${new URLSearchParams({ tenantId })}` : '';
  const rows = await apiFetch<StaffProfile[]>(`/staff${qs}`);
  return rows.map(normalizeStaff);
};

export const getStaffMember = async (userId: string) => normalizeStaff(await apiFetch<StaffProfile>(`/staff/${userId}`));

// The current user's own staff profile (role, scope, locations). Pass cookieHeader
// when calling from a Server Component. Returns null only when no accessible
// profile exists; transport and server failures remain visible to callers.
export const getMyStaffProfile = async (cookieHeader?: string): Promise<StaffProfile | null> => {
  try {
    return normalizeStaff(await apiFetch<StaffProfile>('/staff/me', cookieHeader ? { cookieHeader } : {}));
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return null;
    throw error;
  }
};

export const createStaff = (data: CreateStaffPayload) => apiFetch<StaffProfile>('/staff', { method: 'POST', body: JSON.stringify(data) });

export const updateStaff = (userId: string, data: UpdateStaffPayload) =>
  apiFetch<StaffProfile>(`/staff/${userId}`, { method: 'PATCH', body: JSON.stringify(data) });

// ── Performance stats ─────────────────────────────────────────────────────────
// GET /staff/:userId/performance — sales + throughput metrics across three time
// windows. Revenue and avgOrderValue exclude cancelled orders; totalOrders counts
// every non-deleted order the member created. prepTime is the pending→ready
// fulfilment time from order status history.

export interface StaffPrepTime {
  measuredOrders: number;
  avgSeconds: number;
  avgMinutes: number;
  medianSeconds: number;
  medianMinutes: number;
  minMinutes: number;
  maxMinutes: number;
}

export interface StaffPerfWindow {
  window: string;
  windowDays: number | null;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  cancellationRate: number;
  totalRevenue: string;
  avgOrderValue: string;
  activeDays: number;
  avgOrdersPerActiveDay: number;
  avgOrdersPerCalendarDay: number | null;
  bySource: { pos: number; mobile: number };
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  prepTime: StaffPrepTime;
}

export type StaffPerfWindowKey = 'allTime' | 'last30Days' | 'last7Days';

export interface StaffPerformance {
  staff: { userId: string; name: string | null; email: string | null; role: StaffRole };
  windows: Record<StaffPerfWindowKey, StaffPerfWindow>;
}

export const getStaffPerformance = (userId: string) => apiFetch<StaffPerformance>(`/staff/${userId}/performance`);
