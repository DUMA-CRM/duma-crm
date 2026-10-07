import { apiFetch } from './client';

// ─── Content model ───────────────────────────────────────────────────────────
//
// Mirrors `CmsFieldDefinition` in @duma-crm/db. The API validates every
// definition and every entry against it; the editor only shapes input.

export const CMS_FIELD_TYPES = [
  'text',
  'longText',
  'richText',
  'number',
  'boolean',
  'date',
  'dateTime',
  'select',
  'slug',
  'email',
  'url',
  'color',
  'location',
  'json',
  'media',
  'reference',
  'group',
] as const;
export type CmsFieldType = (typeof CMS_FIELD_TYPES)[number];
export type CmsMediaGroup = 'image' | 'video' | 'audio' | 'document';

export interface CmsFieldDefinition {
  key: string;
  label: string;
  type: CmsFieldType;
  description?: string;
  required?: boolean;
  unique?: boolean;
  private?: boolean;
  multiple?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  pattern?: string;
  patternMessage?: string;
  minItems?: number;
  maxItems?: number;
  options?: string[];
  referenceTypes?: string[];
  mediaGroups?: CmsMediaGroup[];
  slugSource?: string;
  fields?: CmsFieldDefinition[];
  defaultValue?: unknown;
}

export type CmsContentTypeKind = 'collection' | 'singleton';

export interface CmsContentType {
  id: string;
  tenantId: string;
  key: string;
  name: string;
  description: string | null;
  kind: CmsContentTypeKind;
  fields: CmsFieldDefinition[];
  titleField: string | null;
  previewUrl: string | null;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  entryCount?: number;
  publishedCount?: number;
}

export interface CmsContentTypePayload {
  key: string;
  name: string;
  description?: string | null;
  kind: CmsContentTypeKind;
  fields: CmsFieldDefinition[];
  titleField?: string | null;
  previewUrl?: string | null;
}

export interface CmsSchemaImpact {
  removed: string[];
  retyped: Array<{ key: string; from: CmsFieldType; to: CmsFieldType }>;
  newlyRequired: string[];
  affectedEntries: number;
  publishedEntries: number;
}

// ─── Entries ─────────────────────────────────────────────────────────────────

export type CmsEntryStatus = 'draft' | 'published' | 'changed' | 'archived';

export interface CmsEntrySummary {
  id: string;
  tenantId: string;
  contentTypeId: string;
  documentId: string;
  locale: string;
  status: CmsEntryStatus;
  slug: string | null;
  publishedSlug: string | null;
  version: number;
  publishedVersion: number | null;
  title: string | null;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  firstPublishedAt: string | null;
  scheduledPublishAt: string | null;
  scheduledUnpublishAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  /** Waiting for someone who can publish; cleared by publishing or "Request changes". */
  reviewRequestedAt: string | null;
  reviewRequestedBy: string | null;
  /** The writer's note on a request, or "Changes requested: …" from the reviewer. */
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  contentType: { id: string; key: string; name: string; kind: CmsContentTypeKind };
  /** Every language version of this entry — present when listed with `group: 'document'`. */
  localizations?: Array<{ id: string; locale: string; status: CmsEntryStatus }>;
}

export interface CmsEntry extends Omit<CmsEntrySummary, 'contentType' | 'localizations'> {
  draftData: Record<string, unknown>;
  publishedData: Record<string, unknown> | null;
  contentType: CmsContentType;
  localizations?: Array<{ id: string; locale: string; status: CmsEntryStatus }>;
}

export interface CmsEntryVersion {
  id: string;
  version: number;
  action: 'saved' | 'published' | 'unpublished' | 'restored' | 'archived';
  createdBy: string | null;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface CmsPage<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CmsEntryFilters {
  contentTypeId?: string;
  locale?: string;
  status?: CmsEntryStatus | 'scheduled' | 'live' | 'review' | '';
  q?: string;
  page?: number;
  /** Comma-separated document ids. */
  documentIds?: string;
  /** One row per entry, with its language versions in `localizations`. */
  group?: 'document';
}

// ─── Assets, locales, keys, webhooks ─────────────────────────────────────────

export interface CmsAsset {
  id: string;
  tenantId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  title: string | null;
  altText: string | null;
  folder: string | null;
  tags: string[];
  checksumSha256: string;
  /** Where the bytes live: the API host, built-in DUMA storage, or a connected bucket. */
  storageBackend: CmsStorageBackend;
  storageConnectionId: string | null;
  url: string;
  /** Where the subject is, 0–1 from left and top; sites crop around it. */
  focalPoint: { x: number; y: number } | null;
  /** Smaller copies, smallest first, and a ready `srcset` (null when there are none). */
  renditions: Array<{ width: number; height: number; mimeType: string; sizeBytes: number; url: string }>;
  srcset: string | null;
  createdAt: string;
  updatedAt: string;
  usedBy?: Array<{ id: string; contentType: string; title: string | null }>;
}

export type CmsStorageBackend = 'local' | 'duma' | 'connection';
export type CmsStorageProvider = 's3' | 'vercel_blob';
export type CmsStorageKind = 'image' | 'video' | 'audio' | 'document';
export type CmsStorageByKind = Record<CmsStorageKind, number>;

/** Non-secret bucket settings. `accessKeyId` comes back masked (`••••ABCD`). */
export interface CmsStorageConfiguration {
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  publicBaseUrl?: string;
  pathPrefix?: string;
}

export interface CmsStorageConnection {
  id: string;
  provider: CmsStorageProvider;
  displayName: string;
  configuration: CmsStorageConfiguration;
  /** The workspace's own limit; providers do not report one. Null = no limit. */
  quotaBytes: number | null;
  isActive: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
  usedBytes: number;
  fileCount: number;
  byKind: CmsStorageByKind;
  createdAt: string;
}

export interface CmsStorage {
  active: { kind: 'builtIn'; connectionId: null } | { kind: 'connection'; connectionId: string };
  builtIn: {
    /** False while the platform bucket is unconfigured and files sit on the API host. */
    hosted: boolean;
    quotaBytes: number;
    usedBytes: number;
    fileCount: number;
    byKind: CmsStorageByKind;
  };
  connections: CmsStorageConnection[];
}

export interface CmsStorageConnectionPayload {
  provider: CmsStorageProvider;
  displayName: string;
  configuration: CmsStorageConfiguration;
  /** S3: secret access key. Vercel Blob: read-write token. */
  secret: string;
  quotaBytes?: number | null;
  activate?: boolean;
}

export interface CmsLocale {
  tenantId: string;
  code: string;
  name: string;
  isDefault: boolean;
  fallbackCode: string | null;
}

export type CmsApiKeyKind = 'delivery' | 'preview';

export interface CmsApiKey {
  id: string;
  name: string;
  description: string | null;
  kind: CmsApiKeyKind;
  tokenPrefix: string;
  contentTypeKeys: string[] | null;
  allowedOrigins: string[] | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  state: 'active' | 'revoked' | 'expired';
}

export interface CmsApiKeyPayload {
  name: string;
  description?: string | null;
  kind: CmsApiKeyKind;
  contentTypeKeys?: string[] | null;
  allowedOrigins?: string[] | null;
  expiresAt?: string | null;
}

export const CMS_WEBHOOK_EVENTS = ['entry.published', 'entry.unpublished', 'entry.deleted', 'asset.changed'] as const;
export type CmsWebhookEvent = (typeof CMS_WEBHOOK_EVENTS)[number];

export interface CmsWebhook {
  id: string;
  name: string;
  url: string;
  events: CmsWebhookEvent[];
  contentTypeKeys: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastDelivery?: { status: 'pending' | 'succeeded' | 'failed'; responseStatus: number | null; at: string } | null;
}

export interface CmsWebhookPayload {
  name: string;
  url: string;
  events: CmsWebhookEvent[];
  contentTypeKeys?: string[] | null;
  isActive?: boolean;
}

export interface CmsWebhookDelivery {
  id: string;
  eventType: string;
  status: 'pending' | 'succeeded' | 'failed';
  attemptCount: number;
  responseStatus: number | null;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface CmsOverview {
  contentTypes: number;
  locales: number;
  /** Counted per entry: one entry in three languages is one. */
  entries: { total: number; live: number; changed: number; draft: number; scheduled: number; archived: number; review: number };
  assets: { count: number; bytes: number };
  activeApiKeys: number;
  activeWebhooks: number;
  /** Each entry once, at its most recent edit, with every language version. */
  recentEntries: Array<{
    id: string;
    documentId: string;
    status: CmsEntryStatus;
    locale: string;
    updatedAt: string;
    title: string | null;
    contentType: { id: string; key: string; name: string };
    localizations: Array<{ id: string; locale: string; status: CmsEntryStatus }>;
  }>;
}

// ─── Calls ───────────────────────────────────────────────────────────────────

/**
 * The query string, always written after a literal `?` in the path so the
 * contract test can still read every path statically (an empty `?` is harmless).
 */
const qs = (tenantId?: string, params: Record<string, string | number | undefined> = {}) => {
  const query = new URLSearchParams();
  if (tenantId) query.set('tenantId', tenantId);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') query.set(key, String(value));
  return query.toString();
};

export const getCmsOverview = (tenantId?: string) => apiFetch<CmsOverview>(`/cms/overview?${qs(tenantId)}`);

export const getCmsLocales = (tenantId?: string) => apiFetch<{ data: CmsLocale[] }>(`/cms/locales?${qs(tenantId)}`).then((res) => res.data);
export const createCmsLocale = (data: { code: string; name: string; isDefault?: boolean; fallbackCode?: string | null }, tenantId?: string) =>
  apiFetch<CmsLocale>(`/cms/locales?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify(data) });
export const updateCmsLocale = (code: string, data: { name?: string; isDefault?: boolean; fallbackCode?: string | null }, tenantId?: string) =>
  apiFetch<CmsLocale>(`/cms/locales/${encodeURIComponent(code)}?${qs(tenantId)}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteCmsLocale = (code: string, tenantId?: string) =>
  apiFetch<void>(`/cms/locales/${encodeURIComponent(code)}?${qs(tenantId)}`, { method: 'DELETE' });

export const getCmsContentTypes = (tenantId?: string) =>
  apiFetch<{ data: CmsContentType[] }>(`/cms/content-types?${qs(tenantId)}`).then((res) => res.data);
export const getCmsContentType = (id: string, tenantId?: string) => apiFetch<CmsContentType>(`/cms/content-types/${id}?${qs(tenantId)}`);
export const createCmsContentType = (data: CmsContentTypePayload, tenantId?: string) =>
  apiFetch<CmsContentType>(`/cms/content-types?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify(data) });
export const updateCmsContentType = (id: string, data: Partial<Omit<CmsContentTypePayload, 'key'>> & { expectedSchemaVersion?: number }, tenantId?: string) =>
  apiFetch<CmsContentType>(`/cms/content-types/${id}?${qs(tenantId)}`, { method: 'PATCH', body: JSON.stringify(data) });
export const previewCmsSchemaImpact = (id: string, fields: CmsFieldDefinition[], tenantId?: string) =>
  apiFetch<CmsSchemaImpact>(`/cms/content-types/${id}/impact?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify({ fields }) });
export const deleteCmsContentType = (id: string, force: boolean, tenantId?: string) =>
  apiFetch<void>(`/cms/content-types/${id}?${qs(tenantId, { force: force ? 'true' : undefined })}`, { method: 'DELETE' });

export const getCmsEntries = (filters: CmsEntryFilters, tenantId?: string) =>
  apiFetch<CmsPage<CmsEntrySummary>>(`/cms/entries?${qs(tenantId, { ...filters, limit: 25 })}`);
export const getCmsEntry = (id: string, tenantId?: string) => apiFetch<CmsEntry>(`/cms/entries/${id}?${qs(tenantId)}`);
export const createCmsEntry = (data: { contentTypeId: string; locale?: string; documentId?: string; data?: Record<string, unknown> }, tenantId?: string) =>
  apiFetch<CmsEntry>(`/cms/entries?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify(data) });
export const saveCmsEntry = (id: string, data: Record<string, unknown>, expectedVersion: number, tenantId?: string) =>
  apiFetch<CmsEntry>(`/cms/entries/${id}?${qs(tenantId)}`, { method: 'PATCH', body: JSON.stringify({ data, expectedVersion }) });
export const publishCmsEntry = (id: string, tenantId?: string) => apiFetch<CmsEntry>(`/cms/entries/${id}/publish?${qs(tenantId)}`, { method: 'POST' });
export const unpublishCmsEntry = (id: string, tenantId?: string) => apiFetch<CmsEntry>(`/cms/entries/${id}/unpublish?${qs(tenantId)}`, { method: 'POST' });
export const scheduleCmsEntry = (id: string, data: { publishAt?: string | null; unpublishAt?: string | null }, tenantId?: string) =>
  apiFetch<CmsEntry>(`/cms/entries/${id}/schedule?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify(data) });
export const archiveCmsEntry = (id: string, tenantId?: string) => apiFetch<CmsEntry>(`/cms/entries/${id}/archive?${qs(tenantId)}`, { method: 'POST' });
export const restoreCmsEntry = (id: string, tenantId?: string) => apiFetch<CmsEntry>(`/cms/entries/${id}/restore?${qs(tenantId)}`, { method: 'POST' });
export const duplicateCmsEntry = (id: string, tenantId?: string) => apiFetch<CmsEntry>(`/cms/entries/${id}/duplicate?${qs(tenantId)}`, { method: 'POST' });
export const deleteCmsEntry = (id: string, force: boolean, tenantId?: string) =>
  apiFetch<void>(`/cms/entries/${id}?${qs(tenantId, { force: force ? 'true' : undefined })}`, { method: 'DELETE' });
export const bulkCmsEntries = (ids: string[], action: 'publish' | 'unpublish' | 'archive', tenantId?: string) =>
  apiFetch<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }>(`/cms/entries/bulk?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify({ ids, action }) });
export const getCmsEntryVersions = (id: string, tenantId?: string) =>
  apiFetch<{ data: CmsEntryVersion[] }>(`/cms/entries/${id}/versions?${qs(tenantId)}`).then((res) => res.data);
export const getCmsEntryVersion = (id: string, versionId: string, tenantId?: string) =>
  apiFetch<CmsEntryVersion>(`/cms/entries/${id}/versions/${versionId}?${qs(tenantId)}`);
export const restoreCmsEntryVersion = (id: string, versionId: string, tenantId?: string) =>
  apiFetch<CmsEntry>(`/cms/entries/${id}/versions/${versionId}/restore?${qs(tenantId)}`, { method: 'POST' });

export type CmsAssetFilters = {
  q?: string;
  folder?: string;
  kind?: CmsMediaGroup | '';
  page?: number;
  ids?: string;
  /** Nothing refers to it — candidates for freeing space. */
  usage?: 'unused';
  /** Only files uploaded more than once, grouped together. */
  duplicates?: 'true';
  /** Comma-separated public bucket URLs: which assets these are. */
  urls?: string;
};

export const getCmsAssets = (filters: CmsAssetFilters, tenantId?: string) =>
  apiFetch<CmsPage<CmsAsset> & { folders: string[] }>(`/cms/assets?${qs(tenantId, filters)}`);
export const getCmsAsset = (id: string, tenantId?: string) => apiFetch<CmsAsset>(`/cms/assets/${id}?${qs(tenantId)}`);
export const uploadCmsAsset = (file: File, meta: { title?: string; altText?: string; folder?: string }, tenantId?: string) => {
  const body = new FormData();
  body.set('file', file);
  for (const [key, value] of Object.entries(meta)) if (value) body.set(key, value);
  return apiFetch<CmsAsset>(`/cms/assets?${qs(tenantId)}`, { method: 'POST', body, timeoutMs: 120_000 });
};
/** The file's bytes, read through the API (a bucket may send no CORS headers). */
export const getCmsAssetFile = (id: string, tenantId?: string) =>
  apiFetch<Blob>(`/cms/assets/${id}/file?${qs(tenantId)}`, { asBlob: true, timeoutMs: 120_000 });
/** Swap the file under an asset — same id, so entries using it keep working. */
export const replaceCmsAssetFile = (id: string, file: File, tenantId?: string) => {
  const body = new FormData();
  body.set('file', file);
  return apiFetch<CmsAsset>(`/cms/assets/${id}/file?${qs(tenantId)}`, { method: 'PUT', body, timeoutMs: 120_000 });
};
/** Store one smaller copy made in the browser; returns the asset with its renditions. */
export const uploadCmsRendition = (id: string, file: File, tenantId?: string) => {
  const body = new FormData();
  body.set('file', file);
  return apiFetch<CmsAsset>(`/cms/assets/${id}/renditions?${qs(tenantId)}`, { method: 'POST', body, timeoutMs: 120_000 });
};
export const deleteCmsRenditions = (id: string, tenantId?: string) =>
  apiFetch<void>(`/cms/assets/${id}/renditions?${qs(tenantId)}`, { method: 'DELETE' });
export const updateCmsAsset = (
  id: string,
  data: { title?: string | null; altText?: string | null; folder?: string | null; tags?: string[]; fileName?: string; focalPoint?: { x: number; y: number } | null },
  tenantId?: string,
) =>
  apiFetch<CmsAsset>(`/cms/assets/${id}?${qs(tenantId)}`, { method: 'PATCH', body: JSON.stringify(data) });
export type CmsBulkAssetAction =
  | { action: 'delete'; ids: string[]; force?: boolean }
  | { action: 'move'; ids: string[]; folder: string | null }
  | { action: 'tag' | 'untag'; ids: string[]; tags: string[] };
export const bulkCmsAssets = (body: CmsBulkAssetAction, tenantId?: string) =>
  apiFetch<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }>(`/cms/assets/bulk?${qs(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 120_000,
  });
export const deleteCmsAsset = (id: string, force: boolean, tenantId?: string) =>
  apiFetch<void>(`/cms/assets/${id}?${qs(tenantId, { force: force ? 'true' : undefined })}`, { method: 'DELETE' });

export const getCmsApiKeys = (tenantId?: string) => apiFetch<{ data: CmsApiKey[] }>(`/cms/api-keys?${qs(tenantId)}`).then((res) => res.data);
export const createCmsApiKey = (data: CmsApiKeyPayload, tenantId?: string) =>
  apiFetch<{ apiKey: CmsApiKey; token: string }>(`/cms/api-keys?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify(data) });
export const updateCmsApiKey = (id: string, data: Partial<Omit<CmsApiKeyPayload, 'kind'>>, tenantId?: string) =>
  apiFetch<CmsApiKey>(`/cms/api-keys/${id}?${qs(tenantId)}`, { method: 'PATCH', body: JSON.stringify(data) });
export const revokeCmsApiKey = (id: string, tenantId?: string) => apiFetch<CmsApiKey>(`/cms/api-keys/${id}/revoke?${qs(tenantId)}`, { method: 'POST' });

export const getCmsWebhooks = (tenantId?: string) => apiFetch<{ data: CmsWebhook[] }>(`/cms/webhooks?${qs(tenantId)}`).then((res) => res.data);
export const createCmsWebhook = (data: CmsWebhookPayload, tenantId?: string) =>
  apiFetch<{ webhook: CmsWebhook; secret: string }>(`/cms/webhooks?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify(data) });
export const updateCmsWebhook = (id: string, data: Partial<CmsWebhookPayload>, tenantId?: string) =>
  apiFetch<CmsWebhook>(`/cms/webhooks/${id}?${qs(tenantId)}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteCmsWebhook = (id: string, tenantId?: string) => apiFetch<void>(`/cms/webhooks/${id}?${qs(tenantId)}`, { method: 'DELETE' });
export const rotateCmsWebhookSecret = (id: string, tenantId?: string) =>
  apiFetch<{ webhook: CmsWebhook; secret: string }>(`/cms/webhooks/${id}/rotate-secret?${qs(tenantId)}`, { method: 'POST' });
export const testCmsWebhook = (id: string, tenantId?: string) =>
  apiFetch<{ ok: boolean; status?: number | null; error?: string }>(`/cms/webhooks/${id}/test?${qs(tenantId)}`, { method: 'POST' });
export const getCmsWebhookDeliveries = (id: string, tenantId?: string) =>
  apiFetch<{ data: CmsWebhookDelivery[] }>(`/cms/webhooks/${id}/deliveries?${qs(tenantId)}`).then((res) => res.data);
export const redeliverCmsWebhook = (id: string, deliveryId: string, tenantId?: string) =>
  apiFetch<CmsWebhookDelivery>(`/cms/webhooks/${id}/deliveries/${deliveryId}/redeliver?${qs(tenantId)}`, { method: 'POST' });

export const getCmsStorage = (tenantId?: string) => apiFetch<CmsStorage>(`/cms/storage?${qs(tenantId)}`);
export const createCmsStorageConnection = (data: CmsStorageConnectionPayload, tenantId?: string) =>
  apiFetch<CmsStorageConnection>(`/cms/storage/connections?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify(data), timeoutMs: 60_000 });
export const updateCmsStorageConnection = (
  id: string,
  data: { displayName?: string; quotaBytes?: number | null; configuration?: CmsStorageConfiguration; secret?: string },
  tenantId?: string,
) => apiFetch<CmsStorageConnection>(`/cms/storage/connections/${id}?${qs(tenantId)}`, { method: 'PATCH', body: JSON.stringify(data), timeoutMs: 60_000 });
export const verifyCmsStorageConnection = (id: string, tenantId?: string) =>
  apiFetch<CmsStorageConnection>(`/cms/storage/connections/${id}/verify?${qs(tenantId)}`, { method: 'POST', timeoutMs: 60_000 });
export const setCmsActiveStorage = (connectionId: string | null, tenantId?: string) =>
  apiFetch<void>(`/cms/storage/active?${qs(tenantId)}`, { method: 'PUT', body: JSON.stringify({ connectionId }) });
export const deleteCmsStorageConnection = (id: string, tenantId?: string) =>
  apiFetch<void>(`/cms/storage/connections/${id}?${qs(tenantId)}`, { method: 'DELETE' });
/** Move up to `batch` files from `from` to where uploads go now; call again until `remaining` is 0. */
export const migrateCmsStorage = (from: 'builtIn' | string, tenantId?: string) =>
  apiFetch<{ moved: number; remaining: number; failed: Array<{ id: string; error: string }> }>(`/cms/storage/migrate?${qs(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify({ from, batch: 10 }),
    timeoutMs: 300_000,
  });

export const requestCmsReview = (id: string, note: string | undefined, tenantId?: string) =>
  apiFetch<CmsEntry>(`/cms/entries/${id}/review?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify(note ? { note } : {}) });
export const requestCmsChanges = (id: string, note: string, tenantId?: string) =>
  apiFetch<CmsEntry>(`/cms/entries/${id}/review/changes?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify({ note }) });
export const clearCmsReview = (id: string, tenantId?: string) => apiFetch<CmsEntry>(`/cms/entries/${id}/review?${qs(tenantId)}`, { method: 'DELETE' });
/** A signed, expiring link to this draft on the website (`url`), and the API address the site reads it from. */
export const createCmsPreviewLink = (id: string, hours: number, tenantId?: string) =>
  apiFetch<{ token: string; url: string | null; apiUrl: string; expiresAt: string }>(`/cms/entries/${id}/preview-link?${qs(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify({ hours }),
  });

export interface CmsSettings {
  /** The keyless file URL refuses assets no published entry uses. */
  privateUnpublishedAssets: boolean;
}
export const getCmsSettings = (tenantId?: string) => apiFetch<CmsSettings>(`/cms/settings?${qs(tenantId)}`);
export const updateCmsSettings = (settings: CmsSettings, tenantId?: string) =>
  apiFetch<CmsSettings>(`/cms/settings?${qs(tenantId)}`, { method: 'PUT', body: JSON.stringify(settings) });

/** Everything in the CMS as one JSON file (a backup, or a move). */
export const exportCmsContent = (tenantId?: string) => apiFetch<Blob>(`/cms/export?${qs(tenantId)}`, { asBlob: true, timeoutMs: 120_000 });
/** Create up to 200 entries; returns which were created and why others were not. */
export const importCmsEntries = (
  body: { contentTypeId: string; locale?: string; publish?: boolean; entries: Array<Record<string, unknown>> },
  tenantId?: string,
) =>
  apiFetch<{ created: Array<{ index: number; id: string }>; failed: Array<{ index: number; error: string; issues?: Array<{ field: string; message: string }> }> }>(
    `/cms/import?${qs(tenantId)}`,
    { method: 'POST', body: JSON.stringify(body), timeoutMs: 300_000 },
  );
/** Roles allowed to edit a type's entries; empty means every role that can edit content. */
export const getCmsTypeRoles = (id: string, tenantId?: string) =>
  apiFetch<{ roles: string[] }>(`/cms/content-types/${id}/roles?${qs(tenantId)}`).then((res) => res.roles);
export const setCmsTypeRoles = (id: string, roles: string[], tenantId?: string) =>
  apiFetch<{ roles: string[] }>(`/cms/content-types/${id}/roles?${qs(tenantId)}`, { method: 'PUT', body: JSON.stringify({ roles }) }).then((res) => res.roles);
