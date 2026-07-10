import { apiFetch } from './client';

export type StaffRole = 'super_admin' | 'franchise_owner' | 'store_manager' | 'barista' | 'hr_manager' | 'marketing_manager' | 'auditor';
export type StaffScope = 'global' | 'franchise' | 'location';

// Role ranks — same ordering the API uses for requireMinRole.
export const ROLE_RANK: Record<StaffRole, number> = {
  super_admin: 100,
  franchise_owner: 80,
  store_manager: 60,
  hr_manager: 40,
  marketing_manager: 40,
  auditor: 40,
  barista: 20,
};

// True if `role` meets or exceeds `min`. A null role (unknown) never qualifies.
export function roleAtLeast(role: StaffRole | null | undefined, min: StaffRole): boolean {
  if (!role) return false;
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[min] ?? 0);
}

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
  password: string;
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
  const qs = tenantId ? `?tenantId=${tenantId}` : '';
  const rows = await apiFetch<StaffProfile[]>(`/staff${qs}`);
  return rows.map(normalizeStaff);
};

export const getStaffMember = async (userId: string) => normalizeStaff(await apiFetch<StaffProfile>(`/staff/${userId}`));

// The current user's own staff profile (role, scope, locations). Pass cookieHeader
// when calling from a Server Component. Returns null if no profile / not authed.
export const getMyStaffProfile = async (cookieHeader?: string): Promise<StaffProfile | null> => {
  try {
    return normalizeStaff(await apiFetch<StaffProfile>('/staff/me', cookieHeader ? { cookieHeader } : {}));
  } catch {
    return null;
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

export const getStaffPerformance = (userId: string) =>
  apiFetch<StaffPerformance>(`/staff/${userId}/performance`);
