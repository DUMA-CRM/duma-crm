// Workspaces service: which workspaces an account belongs to, switching
// between them, and workspace invitations (both sides).
//
// The account-level routes (/workspaces/*) never need a workspace — an account
// in none can call them. The management routes (/staff-invitations) are
// scoped like any workspace route; a platform administrator passes
// `workspaceId` to act in a client's workspace.
import { apiFetch } from './client';

export interface MyWorkspace {
  tenantId: string;
  name: string;
  slug: string;
  status: 'active' | 'winding_down' | 'inactive';
  role: string;
  roleName: string;
  isActive: boolean;
  activationPending: boolean;
  current: boolean;
}

export interface MyInvitation {
  id: string;
  tenantId: string;
  workspaceName: string;
  role: string;
  roleName: string;
  inviterName: string | null;
  expiresAt: string;
}

export interface MyWorkspaces {
  current: string | null;
  emailVerified: boolean;
  workspaces: MyWorkspace[];
  /** Only listed once the account email is verified. */
  invitations: MyInvitation[];
}

export const getMyWorkspaces = (signal?: AbortSignal) => apiFetch<MyWorkspaces>('/workspaces/mine', { signal });

/** Moves this browser (every tab, on its next load) to another of the account's workspaces. */
export const setActiveWorkspace = (tenantId: string) =>
  apiFetch<{ ok: true; tenantId: string }>('/workspaces/active', { method: 'POST', body: JSON.stringify({ tenantId }) });

export const leaveWorkspace = (tenantId: string) =>
  apiFetch<{ ok: true }>(`/workspaces/${encodeURIComponent(tenantId)}/leave`, { method: 'POST' });

export const acceptMyInvitation = (id: string) =>
  apiFetch<{ ok: true; tenantId: string }>(`/workspaces/invitations/${encodeURIComponent(id)}/accept`, { method: 'POST' });

export const declineMyInvitation = (id: string) =>
  apiFetch<{ ok: true }>(`/workspaces/invitations/${encodeURIComponent(id)}/decline`, { method: 'POST' });

// ── The emailed link ─────────────────────────────────────────────────────────

export type InvitationLinkState = 'pending' | 'expired' | 'accepted' | 'revoked';

export interface InvitationPreview {
  state: InvitationLinkState;
  email: string;
  workspaceName: string;
  roleName: string;
  inviterName: string | null;
  expiresAt: string;
  /** Whether the invited address already has an account: sign in, or create one. */
  accountExists: boolean;
}

export const getInvitationPreview = (token: string, signal?: AbortSignal) =>
  apiFetch<InvitationPreview>(`/workspaces/invitations/token/${encodeURIComponent(token)}`, { signal });

export const acceptInvitationLink = (token: string) =>
  apiFetch<{ ok: true; tenantId: string }>(`/workspaces/invitations/token/${encodeURIComponent(token)}/accept`, { method: 'POST' });

/** Creates the account for the invited address, accepts and signs in (sets the session cookie). */
export const signUpFromInvitation = (token: string, input: { name: string; password: string }) =>
  apiFetch<{ ok: true; tenantId: string }>(`/workspaces/invitations/token/${encodeURIComponent(token)}/sign-up`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

// ── A workspace's own invitations ────────────────────────────────────────────

export type StaffInvitationState = 'pending' | 'expired';

export interface StaffInvitation {
  id: string;
  email: string;
  role: string;
  roleName: string;
  scope: 'global' | 'franchise' | 'location';
  locationIds: string[] | null;
  state: StaffInvitationState;
  expiresAt: string;
  lastSentAt: string;
  sendCount: number;
  invitedBy: string | null;
  createdAt: string;
}

export interface InviteInput {
  email: string;
  role: string;
  scope: 'global' | 'franchise' | 'location';
  locationIds?: string[];
}

type Scoped = { workspaceId?: string };

export const getStaffInvitations = ({ workspaceId }: Scoped = {}, signal?: AbortSignal) =>
  apiFetch<{ invitations: StaffInvitation[] }>('/staff-invitations', { signal, workspaceId }).then((body) => body.invitations);

export const sendStaffInvitation = (input: InviteInput, { workspaceId }: Scoped = {}) =>
  apiFetch<{ invitation: StaffInvitation; emailSent: boolean }>('/staff-invitations', {
    method: 'POST',
    body: JSON.stringify(input),
    workspaceId,
  });

export const resendStaffInvitation = (id: string, { workspaceId }: Scoped = {}) =>
  apiFetch<{ invitation: StaffInvitation; emailSent: boolean }>(`/staff-invitations/${encodeURIComponent(id)}/resend`, {
    method: 'POST',
    workspaceId,
  });

export const revokeStaffInvitation = (id: string, { workspaceId }: Scoped = {}) =>
  apiFetch<{ ok: true }>(`/staff-invitations/${encodeURIComponent(id)}`, { method: 'DELETE', workspaceId });

/** Removes someone from the current workspace only — their account and other workspaces stay. */
export const removeStaffMember = (userId: string) =>
  apiFetch<{ ok: true }>(`/staff/${encodeURIComponent(userId)}`, { method: 'DELETE' });
