import { parseJsonObject } from '../utils/json';

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

// The API stores metadata and response as JSON strings.
export const parseAuditMeta = parseJsonObject;

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
  /** Free text, searched server-side across actor, action, record and request details. */
  q?: string;
  /** Exact entry ids — how a group from `getAuditGroups` is opened. */
  ids?: string[];
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
  if (params.q) qs.set('q', params.q);
  if (params.ids?.length) qs.set('ids', params.ids.join(','));
  const query = qs.toString();
  return apiFetch<AuditLogsResponse>(`/audit-logs${query ? `?${query}` : ''}`);
};

export type AuditGroupSeverity = 'ok' | 'destructive' | 'refused' | 'failed';

/**
 * One person's work on one record on one local day, as grouped by the API over
 * the whole filtered range — so a record's history is never split by a page
 * boundary the way grouping the loaded rows used to split it.
 */
export interface AuditGroup {
  /** `day|actor|resourceType|record` — stable across refetches. */
  key: string;
  /** Local calendar day in the requested time zone, `YYYY-MM-DD`. */
  day: string;
  actor: { userId: string | null; name: string | null; email: string | null; role: string | null };
  resourceType: string;
  resourceId: string | null;
  count: number;
  firstAt: string;
  lastAt: string;
  /** Distinct actions, newest first. */
  actions: string[];
  /** The worst outcome anywhere in the group. */
  severity: AuditGroupSeverity;
  failedCount: number;
  refusedCount: number;
  /** Newest first, capped at 100 — `count` is the true size. */
  entryIds: string[];
  /** The newest entry in full; null only if it vanished between the two reads. */
  latest: AuditLog | null;
}

export interface AuditGroupsResponse {
  data: AuditGroup[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  timeZone: string;
}

export const getAuditGroups = (params: Omit<AuditLogsParams, 'ids'> & { tz?: string } = {}) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') qs.set(key, String(value));
  const query = qs.toString();
  return apiFetch<AuditGroupsResponse>(`/audit-logs/groups${query ? `?${query}` : ''}`);
};
