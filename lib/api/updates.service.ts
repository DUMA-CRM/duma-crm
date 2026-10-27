import { apiFetch } from '@/lib/api/client';

export type UpdateContent = {
  title: string;
  summary: string;
  body: string;
  category: 'new' | 'improved' | 'fixed' | 'important' | 'retired';
  targetRoles: string[];
  targetModules: string[];
  actionLabel: string;
  actionUrl: string;
};
export type ProductUpdate = UpdateContent & { id: string; publishedAt: string; announcement: number; unread: boolean };
export type UpdateDraft = {
  id: string;
  draft: UpdateContent;
  published: UpdateContent | null;
  publishedAt: string | null;
  popupExpiresAt: string | null;
  announcement: number;
  revision: number;
  updatedAt: string;
};
export const updateKeys = {
  all: ['product-updates'] as const,
  unread: (userId: string | undefined) => ['product-updates', userId, 'unread'] as const,
};
export const getUpdates = (page = 0) =>
  apiFetch<{ data: ProductUpdate[]; hasMore: boolean }>(`/updates?page=${page}`, { cache: 'no-store' });
export const getUpdate = (id: string) => apiFetch<ProductUpdate>(`/updates/${encodeURIComponent(id)}`, { cache: 'no-store' });
export const getUnreadUpdates = () => apiFetch<{ count: number; popup: ProductUpdate | null }>('/updates/unread', { cache: 'no-store' });
export const recordUpdate = (id: string, announcement: number, event: 'shown' | 'dismiss' | 'read') => {
  const body = JSON.stringify({ announcement });
  if (event === 'shown') return apiFetch<{ claimed: boolean }>(`/updates/${encodeURIComponent(id)}/shown`, { method: 'POST', body });
  if (event === 'dismiss') return apiFetch<{ claimed: boolean }>(`/updates/${encodeURIComponent(id)}/dismiss`, { method: 'POST', body });
  return apiFetch<{ claimed: boolean }>(`/updates/${encodeURIComponent(id)}/read`, { method: 'POST', body });
};
export const getUpdateDrafts = (page = 0) => apiFetch<{ data: UpdateDraft[]; hasMore: boolean }>(`/updates/admin/posts?page=${page}`);
export const getUpdateDraft = (id: string) => apiFetch<UpdateDraft>(`/updates/admin/posts/${encodeURIComponent(id)}`);
export const saveUpdateDraft = (draft: UpdateContent, current: UpdateDraft | null) =>
  current
    ? apiFetch<UpdateDraft>(`/updates/admin/posts/${current.id}`, {
        method: 'PUT',
        body: JSON.stringify({ draft, revision: current.revision }),
      })
    : apiFetch<UpdateDraft>('/updates/admin/posts', { method: 'POST', body: JSON.stringify(draft) });
export const publishUpdate = (current: UpdateDraft, options: { announce: boolean; publishedAt?: string; popupExpiresAt?: string }) =>
  apiFetch<UpdateDraft>(`/updates/admin/posts/${current.id}/publish`, {
    method: 'POST',
    body: JSON.stringify({ revision: current.revision, ...options }),
  });
export const unpublishUpdate = (current: UpdateDraft) =>
  apiFetch<UpdateDraft>(`/updates/admin/posts/${current.id}/unpublish`, {
    method: 'POST',
    body: JSON.stringify({ revision: current.revision }),
  });
