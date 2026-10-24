import type { ApiKeyKind, ApiKeyScope } from '@/lib/developers/api-reference';

import { apiFetch } from './client';

// Workspace API keys — the one key a business's own website or app uses for
// every public API: Content (/v1/cms/delivery) and Store (/v1/store). Its
// scopes say which (lib/developers/api-reference.ts; duma-api routes/api-keys.ts).

export type { ApiKeyKind, ApiKeyScope };

export interface WorkspaceApiKey {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  kind: ApiKeyKind;
  tokenPrefix: string;
  scopes: ApiKeyScope[];
  locationId: string | null;
  /** Content types a `content:read` key may read; null means all. */
  contentTypeKeys: string[] | null;
  allowedOrigins: string[] | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy?: string | null;
  state: 'active' | 'revoked' | 'expired';
}

export interface WorkspaceApiKeyPayload {
  name: string;
  description?: string | null;
  kind: ApiKeyKind;
  scopes?: ApiKeyScope[];
  locationId?: string | null;
  contentTypeKeys?: string[] | null;
  allowedOrigins?: string[] | null;
  expiresAt?: string | null;
}

const qs = (tenantId?: string) => (tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '');

export const getWorkspaceApiKeys = (tenantId?: string) =>
  apiFetch<{ data: WorkspaceApiKey[] }>(`/api-keys${qs(tenantId)}`).then((res) => res.data);
export const createWorkspaceApiKey = (data: WorkspaceApiKeyPayload, tenantId?: string) =>
  apiFetch<{ apiKey: WorkspaceApiKey; token: string }>(`/api-keys${qs(tenantId)}`, { method: 'POST', body: JSON.stringify(data) });
export const updateWorkspaceApiKey = (id: string, data: Partial<Omit<WorkspaceApiKeyPayload, 'kind'>>, tenantId?: string) =>
  apiFetch<WorkspaceApiKey>(`/api-keys/${id}${qs(tenantId)}`, { method: 'PATCH', body: JSON.stringify(data) });
export const revokeWorkspaceApiKey = (id: string, tenantId?: string) =>
  apiFetch<WorkspaceApiKey>(`/api-keys/${id}/revoke${qs(tenantId)}`, { method: 'POST' });
