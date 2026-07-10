import { apiFetch } from './client';

export interface AuditLog {
  id: string;
  userId: string | null;
  // Actor snapshot (denormalised on the server).
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  tenantId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  // Request context.
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  durationMs?: number | null;
  metadata?: string | null; // JSON string — parse with parseAuditMeta()
	response?: string | null; // JSON string — parse with parseAuditMeta()
  createdAt: string;
}

// The API stores metadata as a JSON string. Parse it defensively for display.
export function parseAuditMeta(raw?: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AuditLogsParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  from?: string;
  to?: string;
}

export const getAuditLogs = (params: AuditLogsParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.userId) qs.set('userId', params.userId);
  if (params.action) qs.set('action', params.action);
  if (params.resourceType) qs.set('resourceType', params.resourceType);
  if (params.resourceId) qs.set('resourceId', params.resourceId);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const query = qs.toString();
  return apiFetch<AuditLogsResponse>(`/audit-logs${query ? `?${query}` : ''}`);
};
