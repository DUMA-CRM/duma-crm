// ─── Forms ────────────────────────────────────────────────────────────────────
//
// Forms a workspace builds and the responses they collect (the forms module,
// /v1/forms). A form has a draft (`definition`) and the snapshot that is live
// (`publishedDefinition`); saving changes the draft, publishing makes it live.
// The hosted page reads and submits through /v1/forms/public/:publicId, with
// no session — the same endpoints a website's own code uses.
import type { Answer, FormDefinition, FormField, FormResponseSource, FormResponseStatus, FormStatus, Problem } from '@/lib/utils/forms';

import { apiFetch } from './client';

export type { FormDefinition, FormField, FormResponseStatus, FormStatus } from '@/lib/utils/forms';

export interface FormListItem {
  id: string;
  name: string;
  description: string | null;
  status: FormStatus;
  publicId: string;
  fieldCount: number;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  closesAt: string | null;
  responseLimit: number | null;
  responseCount: number;
  newResponses: number;
  lastResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormDetail {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: FormStatus;
  publicId: string;
  definition: FormDefinition;
  version: number;
  publishedDefinition: FormDefinition | null;
  publishedVersion: number | null;
  publishedAt: string | null;
  closesAt: string | null;
  responseLimit: number | null;
  responseCount: number;
  lastResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** What stops the draft being published. */
  problems: Problem[];
  hasUnpublishedChanges: boolean;
  storedResponses?: number;
  newResponses?: number;
}

export interface FormResponse {
  id: string;
  formId: string;
  answers: Record<string, Answer>;
  answersByKey: Record<string, Answer>;
  formVersion: number;
  customerId: string | null;
  customer: { id: string; name: string; email: string | null } | null;
  source: FormResponseSource;
  status: FormResponseStatus;
  metadata: Record<string, string>;
  submittedAt: string;
  updatedAt: string;
}

export interface FormResponsePage {
  data: FormResponse[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type ResponseFilter = FormResponseStatus | 'open';

export interface FormSummary {
  responses: number;
  byDay: { date: string; total: number }[];
  fields: {
    id: string;
    key: string;
    label: string;
    type: FormField['type'];
    answered: number;
    average: number | null;
    breakdown: { label: string; total: number }[] | null;
    latest: string[] | null;
  }[];
}

/** What a respondent sees. */
export interface PublicForm {
  publicId: string;
  name: string;
  description: string | null;
  brandName: string;
  version: number;
  accepting: boolean;
  closedReason: 'closed' | 'deadline' | 'full' | null;
  closedMessage: string | null;
  fields: FormField[];
  submitLabel: string;
  successTitle: string;
  successMessage: string;
  redirectUrl: string | null;
  showProgress: boolean;
  accentColor: string | null;
}

export interface SubmittedResponse {
  id: string;
  successTitle: string;
  successMessage: string;
  redirectUrl: string | null;
}

const qs = (tenantId?: string, extra: Record<string, string | number | undefined> = {}) => {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenantId', tenantId);
  for (const [key, value] of Object.entries(extra)) if (value !== undefined && value !== '') params.set(key, String(value));
  return params.toString();
};

export const getForms = (tenantId?: string) => apiFetch<{ data: FormListItem[] }>(`/forms?${qs(tenantId)}`).then((res) => res.data);

export const getForm = (id: string, tenantId?: string) =>
  apiFetch<{ data: FormDetail }>(`/forms/${id}?${qs(tenantId)}`).then((res) => res.data);

export const createForm = (data: { name: string; description?: string | null; definition?: FormDefinition }, tenantId?: string) =>
  apiFetch<{ data: FormDetail }>(`/forms`, { method: 'POST', body: JSON.stringify({ ...data, tenantId }) }).then((res) => res.data);

/** Save the draft and settings. A definition needs the version it was read at; 409 when someone saved in between. */
export const updateForm = (
  id: string,
  data: {
    name?: string;
    description?: string | null;
    definition?: FormDefinition;
    expectedVersion?: number;
    closesAt?: string | null;
    responseLimit?: number | null;
  },
  tenantId?: string,
) =>
  apiFetch<{ data: FormDetail }>(`/forms/${id}?${qs(tenantId)}`, { method: 'PATCH', body: JSON.stringify(data) }).then((res) => res.data);

export const publishForm = (id: string, tenantId?: string) =>
  apiFetch<{ data: FormDetail }>(`/forms/${id}/publish?${qs(tenantId)}`, { method: 'POST' }).then((res) => res.data);

export const setFormStatus = (id: string, status: 'published' | 'closed' | 'archived' | 'restore', tenantId?: string) =>
  apiFetch<{ data: FormDetail }>(`/forms/${id}/status?${qs(tenantId)}`, { method: 'POST', body: JSON.stringify({ status }) }).then(
    (res) => res.data,
  );

export const duplicateForm = (id: string, tenantId?: string) =>
  apiFetch<{ data: FormDetail }>(`/forms/${id}/duplicate?${qs(tenantId)}`, { method: 'POST' }).then((res) => res.data);

export const deleteForm = (id: string, tenantId?: string) =>
  apiFetch<{ data: { id: string } }>(`/forms/${id}?${qs(tenantId)}`, { method: 'DELETE' });

export const getFormResponses = (
  id: string,
  options: { page?: number; limit?: number; status?: ResponseFilter; q?: string },
  tenantId?: string,
) => apiFetch<FormResponsePage>(`/forms/${id}/responses?${qs(tenantId, options)}`);

export const exportFormResponses = (id: string, options: { status?: ResponseFilter; q?: string }, tenantId?: string) =>
  apiFetch<Blob>(`/forms/${id}/responses/export?${qs(tenantId, options)}`, { asBlob: true, timeoutMs: 120_000 });

export const getFormSummary = (id: string, tenantId?: string) =>
  apiFetch<{ data: FormSummary }>(`/forms/${id}/summary?${qs(tenantId)}`).then((res) => res.data);

export const markFormResponse = (id: string, responseId: string, status: FormResponseStatus, tenantId?: string) =>
  apiFetch<{ data: FormResponse }>(`/forms/${id}/responses/${responseId}?${qs(tenantId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const bulkFormResponses = (id: string, ids: string[], action: FormResponseStatus | 'delete', tenantId?: string) =>
  apiFetch<{ data: { changed: number } }>(`/forms/${id}/responses/bulk?${qs(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify({ ids, action }),
  });

export const deleteFormResponse = (id: string, responseId: string, tenantId?: string) =>
  apiFetch<{ data: { id: string } }>(`/forms/${id}/responses/${responseId}?${qs(tenantId)}`, { method: 'DELETE' });

// ─── The public form ─────────────────────────────────────────────────────────

export const getPublicForm = (publicId: string) =>
  apiFetch<{ data: PublicForm }>(`/forms/public/${encodeURIComponent(publicId)}`).then((res) => res.data);

export const submitPublicForm = (
  publicId: string,
  body: { answers: Record<string, Answer>; source: FormResponseSource; metadata?: Record<string, string>; website?: string },
) =>
  apiFetch<{ data: SubmittedResponse }>(`/forms/public/${encodeURIComponent(publicId)}/responses`, {
    method: 'POST',
    body: JSON.stringify(body),
  }).then((res) => res.data);
