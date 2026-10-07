import { apiFetch } from './client';

// Workspace API keys — what a business's own website or app uses to read the
// catalogue and send orders, customers and newsletter sign-ups to DUMA.
// The storefront endpoints they open live under /v1/store (duma-api routes/store.ts).

export type ApiKeyKind = 'publishable' | 'secret';
export type ApiKeyScope = 'catalog:read' | 'orders:write' | 'customers:write' | 'newsletter:write';

export interface WorkspaceApiKey {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  kind: ApiKeyKind;
  tokenPrefix: string;
  scopes: ApiKeyScope[];
  locationId: string | null;
  allowedOrigins: string[] | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  state: 'active' | 'revoked' | 'expired';
}

export interface WorkspaceApiKeyPayload {
  name: string;
  description?: string | null;
  kind: ApiKeyKind;
  scopes?: ApiKeyScope[];
  locationId?: string | null;
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
