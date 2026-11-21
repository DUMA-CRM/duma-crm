import { apiFetch } from '@/lib/api/client';
import type { TenantModuleState } from '@/lib/api/modules.service';
import type { WorkspaceClassification } from '@/lib/api/workspace.service';

// ── Context ──────────────────────────────────────────────────────────────────
// GET /workspace-context — who the caller is and, when this tab is in one, the
// workspace: identity, status, brand, timezone and modules, in one answer that
// names the workspace it describes. Any member of staff or platform administrator.

export interface WorkspaceContextActor {
  userId: string;
  kind: 'platform' | 'staff';
  platformRoles: string[];
  homeTenantId: string | null;
  role: string;
  capabilities: string[];
  locationIds: string[] | null;
}

export interface WorkspaceContextWorkspace {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'winding_down' | 'inactive';
  classification: WorkspaceClassification;
  timezone: string;
  brand: string;
  modules: TenantModuleState[];
}

export interface WorkspaceContextResponse {
  mode: 'platform' | 'workspace';
  actor: WorkspaceContextActor;
  workspace: WorkspaceContextWorkspace | null;
}

export const getWorkspaceContext = (signal?: AbortSignal) =>
  apiFetch<WorkspaceContextResponse>('/workspace-context', { timeoutMs: 15_000, ...(signal ? { signal } : {}) });

// ── DUMA Admin ───────────────────────────────────────────────────────────────
// Everything under /platform needs an active platform role. Each figure carries
// its definition, unit, window, freshness and source; a source that cannot
// answer is `unavailable` with a reason — never a zero.

export type PlatformMetric<T> =
  | {
      status: 'ok';
      value: T;
      unit: string;
      definition: string;
      window: string | null;
      collectedAt: string;
      source: string;
      estimate: boolean;
    }
  | { status: 'unavailable'; reason: string; definition: string; source: string; collectedAt: string };

export interface PlatformContext {
  actor: { userId: string; kind: 'platform'; platformRoles: string[]; homeTenantId: string | null };
  internalWorkspace: { id: string; name: string; slug: string; status: string } | null;
}

export const getPlatformContext = () => apiFetch<PlatformContext>('/platform/context', { workspaceId: 'platform' });

export interface PlatformAttentionItem {
  key: string;
  count: number;
  label: string;
  href: string;
}

export interface WorkspaceSummary {
  customers: number;
  byStatus: Record<'active' | 'winding_down' | 'inactive', number>;
  byBilling: Record<'trialing' | 'active' | 'past_due' | 'cancelled' | 'not_configured', number>;
  excluded: { internal: number; demo: number };
  activeLocations: number;
  activeStaff: number;
  onboarding: { inProgress: number; withBlockers: number; notReadyToGoLive: number };
}

export interface PlatformOverview {
  attention: PlatformAttentionItem[];
  workspaces: PlatformMetric<WorkspaceSummary>;
  locations: PlatformMetric<number>;
  staff: PlatformMetric<number>;
  customerProfiles: PlatformMetric<number>;
  database: PlatformMetric<number>;
}

export const getPlatformOverview = () => apiFetch<PlatformOverview>('/platform/overview', { workspaceId: 'platform' });

export interface PlatformWorkspace {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'winding_down' | 'inactive';
  classification: WorkspaceClassification;
  createdAt: string;
  planKey: string | null;
  billingStatus: string | null;
  trialEndsAt: string | null;
  activeLocations: number;
  activeStaff: number;
  enabledModules: number;
  onboardingStatus: string | null;
  blockedTasks: number;
  openRequiredTasks: number;
}

export const getPlatformWorkspaces = () =>
  apiFetch<{ workspaces: PlatformWorkspace[]; collectedAt: string }>('/platform/workspaces', { workspaceId: 'platform' });

export const setWorkspaceClassification = (id: string, classification: WorkspaceClassification, reason: string) =>
  apiFetch<{ id: string; classification: WorkspaceClassification }>(`/platform/workspaces/${id}/classification`, {
    method: 'PATCH',
    workspaceId: 'platform',
    body: JSON.stringify({ classification, reason }),
  });

export interface InternalWorkspaceInput {
  name: string;
  slug: string;
  timezone: string;
  moduleIds: string[];
}

export const provisionInternalWorkspace = (input: InternalWorkspaceInput) =>
  apiFetch<{ workspace: { id: string; name: string; slug: string; status: string }; created: boolean }>('/platform/internal-workspace', {
    method: 'POST',
    workspaceId: 'platform',
    body: JSON.stringify(input),
  });

export interface ActiveUsage {
  staff: { d1: number; d7: number; d30: number };
  workspaces: { d1: number; d7: number; d30: number };
  earliestEventAt: string | null;
}

export interface PlatformUsage {
  adoption: PlatformMetric<{ moduleId: string; enabled: number }[]>;
  activeCustomers: number;
  active: PlatformMetric<ActiveUsage>;
}

export const getPlatformUsage = () => apiFetch<PlatformUsage>('/platform/usage', { workspaceId: 'platform' });

export interface DatabaseTable {
  table: string;
  kind: 'business' | 'operational';
  totalBytes: number;
  tableBytes: number;
  indexBytes: number;
  toastBytes: number;
  estimatedRows: number;
  statisticsAt: string | null;
}

export interface DatabaseSnapshot {
  collectedAt: string;
  databaseBytes: number;
  tables: DatabaseTable[];
  totals: { business: { estimatedRows: number }; operational: { estimatedRows: number } };
}

export interface PlatformDatabase {
  snapshot: DatabaseSnapshot | null;
  stale: boolean;
  history: { collectedAt: string; databaseBytes: number }[];
  notes: string[];
}

export const getPlatformDatabase = () => apiFetch<PlatformDatabase>('/platform/database', { workspaceId: 'platform' });

export const collectPlatformDatabase = () =>
  apiFetch<{ snapshot: DatabaseSnapshot; collected: boolean }>('/platform/database/collect', { method: 'POST', workspaceId: 'platform' });

export interface PlatformHealth {
  database: { status: 'ok' | 'error'; latencyMs: number | null };
  cache: { status: string; [key: string]: unknown };
  workers: {
    healthy: boolean;
    workers: { name: string; enabled: boolean; stalled: boolean; starting: boolean; lastTickAt: string | null }[];
  };
  queues: Record<string, number>;
  monitoring: { metricsPath: string; dashboardUrl: string | null };
  collectedAt: string;
}

export const getPlatformHealth = () => apiFetch<PlatformHealth>('/platform/health', { workspaceId: 'platform' });

export interface PlatformAdmin {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'super_admin';
  status: 'active' | 'revoked';
  source: string;
  grantedAt: string;
  revokedAt: string | null;
}

export const getPlatformAdmins = () => apiFetch<{ admins: PlatformAdmin[] }>('/platform/admins', { workspaceId: 'platform' });

export const grantPlatformAdmin = (email: string) =>
  apiFetch<{ granted: boolean }>('/platform/admins', { method: 'POST', workspaceId: 'platform', body: JSON.stringify({ email }) });

export const revokePlatformAdmin = (id: string, reason: string) =>
  apiFetch<{ revoked: boolean }>(`/platform/admins/${id}/revoke`, {
    method: 'POST',
    workspaceId: 'platform',
    body: JSON.stringify({ reason }),
  });

export interface UserDirectoryFilters {
  q: string;
  verification: 'all' | 'verified' | 'unverified';
  status: 'all' | 'active' | 'suspended';
  membership: 'all' | 'member' | 'none';
  sort: 'newest' | 'oldest' | 'last_sign_in' | 'name';
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
  workspace: string | null;
  workspaceId: string | null;
  role: string | null;
  memberActive: boolean | null;
  activationPending: boolean | null;
  canResetPassword: boolean;
  /** better-auth provider ids: `credential`, `google`, … */
  providers: string[];
  platformAdmin: boolean;
  lastSignInAt: string | null;
  suspendedAt: string | null;
}

export const getPlatformUsers = (filters: UserDirectoryFilters, page: number, signal?: AbortSignal) =>
  apiFetch<{ users: PlatformUser[]; hasNext: boolean; total: number; pageSize: number }>(
    `/platform/users?${new URLSearchParams({ ...filters, page: String(page) })}`,
    { workspaceId: 'platform', signal },
  );

export interface PlatformUserSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  current: boolean;
}

export interface PlatformUserDetail {
  user: { id: string; name: string; email: string; image: string | null; emailVerified: boolean; createdAt: string; updatedAt: string };
  methods: { id: string; providerId: string; hasPassword: boolean; createdAt: string; canUnlink: boolean }[];
  membership: {
    workspaceId: string;
    workspace: string;
    workspaceStatus: string;
    role: string;
    roleName: string | null;
    scope: string;
    locationCount: number | null;
    isActive: boolean;
    activationPending: boolean;
    joinedAt: string;
  } | null;
  platformRoles: { id: string; role: string; grantedAt: string }[];
  sessions: PlatformUserSession[];
  /** ChatGPT and other OAuth clients holding a live grant. */
  connectedApps: number;
  lastSignInAt: string | null;
  suspension: { at: string; reason: string; by: string | null } | null;
  isSelf: boolean;
  /** Why each destructive action is refused, or null when it is allowed — the API's own rule. */
  blockers: { suspend: string | null; delete: string | null };
}

const userPath = (id: string) => `/platform/users/${encodeURIComponent(id)}`;
const platform = { workspaceId: 'platform' as const };

export const getPlatformUser = (id: string, signal?: AbortSignal) =>
  apiFetch<PlatformUserDetail>(userPath(id), { ...platform, signal });

export const renamePlatformUser = (id: string, name: string) =>
  apiFetch<{ id: string; name: string }>(userPath(id), { ...platform, method: 'PATCH', body: JSON.stringify({ name }) });

type UserRef = { id: string; email: string };

export const updatePlatformUserVerification = (user: UserRef, verified: boolean) =>
  apiFetch<{ id: string; emailVerified: boolean }>(`${userPath(user.id)}/verification`,
    { ...platform, method: 'PATCH', body: JSON.stringify({ email: user.email, verified }) });

export const sendPlatformUserPasswordReset = (user: UserRef) =>
  apiFetch<{ sent: true }>(`${userPath(user.id)}/password-reset`,
    { ...platform, method: 'POST', body: JSON.stringify({ email: user.email }) });

export const suspendPlatformUser = (user: UserRef, reason: string) =>
  apiFetch<{ suspended: true; sessionsEnded: number }>(`${userPath(user.id)}/suspend`,
    { ...platform, method: 'POST', body: JSON.stringify({ email: user.email, reason }) });

export const unsuspendPlatformUser = (id: string, reason: string) =>
  apiFetch<{ suspended: false }>(`${userPath(id)}/unsuspend`, { ...platform, method: 'POST', body: JSON.stringify({ reason }) });

export const endPlatformUserSession = (id: string, sessionId: string) =>
  apiFetch<{ ended: number }>(`${userPath(id)}/sessions/${encodeURIComponent(sessionId)}`, { ...platform, method: 'DELETE' });

export const endAllPlatformUserSessions = (id: string) =>
  apiFetch<{ ended: number }>(`${userPath(id)}/sessions`, { ...platform, method: 'DELETE' });

export const unlinkPlatformUserMethod = (id: string, methodId: string) =>
  apiFetch<{ unlinked: true }>(`${userPath(id)}/methods/${encodeURIComponent(methodId)}`, { ...platform, method: 'DELETE' });

export const deletePlatformUser = (user: UserRef) =>
  apiFetch<{ deleted: true }>(userPath(user.id), { ...platform, method: 'DELETE', body: JSON.stringify({ email: user.email }) });
