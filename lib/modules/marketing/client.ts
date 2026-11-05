import { API_PREFIX, apiFetch } from '@/lib/api/client';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export type Platform = 'youtube' | 'facebook' | 'instagram' | 'tiktok';
export const PLATFORMS: Platform[] = ['youtube', 'facebook', 'instagram', 'tiktok'];
export const LABELS: Record<Platform, string> = { youtube: 'YouTube', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' };
export const FORMATS: Record<Platform, string[]> = {
  youtube: ['video', 'short'],
  facebook: ['text', 'image', 'video', 'reel'],
  instagram: ['image', 'carousel', 'reel'],
  tiktok: ['video'],
};
export interface Account {
  id: string;
  provider: Platform;
  name: string;
  remoteId: string;
  state: string;
}
export interface Asset {
  id: string;
  fileName: string;
  mimeType: string;
  url: string;
  sizeBytes: number;
  updatedAt?: string;
}
export interface Target {
  id: string;
  connectionId: string;
  format: string;
  caption: string;
  options: Record<string, unknown>;
  scheduledAt: string | null;
  timeZone: string;
  status: string;
  error: string | null;
  remoteUrl: string | null;
  canRetry: boolean;
  assets: Asset[];
}
export interface Post {
  canEdit: boolean;
  id: string;
  title: string;
  caption: string;
  version: number;
  status: string;
  targets: Target[];
  updatedAt: string;
}
export interface TargetDraft {
  connectionId: string;
  format: string;
  caption: string;
  assetIds: string[];
  scheduledAt: string | null;
  timeZone: string;
  options: Record<string, unknown>;
}
export interface PostDraft {
  requestId: string;
  title: string;
  caption: string;
  version?: number;
  targets: TargetDraft[];
  schedule: boolean;
  /** Publish every destination now; the API stamps the time. */
  publishNow?: boolean;
}
export interface Connections {
  accounts: Account[];
  providers: { provider: Platform; configured: boolean; formats: string[]; directPost: boolean }[];
}
export interface Creator {
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}
export const marketingKey = (tenantId: string | null | undefined, ...parts: unknown[]) => ['marketing', tenantId, ...parts];
export const accounts = () => apiFetch<Account[]>('/marketing/accounts');
export const connections = () => apiFetch<Connections>('/marketing/connections');
export const startConnect = (provider: Platform) =>
  apiFetch<{ url: string }>(`/marketing/oauth/${provider}`, { method: 'POST', body: '{}' });
export const disconnect = (id: string) => apiFetch<void>(`/marketing/connections/${id}`, { method: 'DELETE' });
export const getCreator = (id: string) => apiFetch<Creator>(`/marketing/accounts/${id}/creator`);
export const posts = (from: string, to: string, page = 1) =>
  apiFetch<{ data: Post[]; hasMore: boolean }>(`/marketing/posts?${new URLSearchParams({ from, to, page: String(page) })}`);
export const getPost = (id: string) => apiFetch<Post>(`/marketing/posts/${id}`);
export const savePost = (id: string | undefined, input: PostDraft) =>
  apiFetch<Post>(`/marketing/posts${id ? '/' + id : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) });
/** Removes the post from DUMA only — never from the platforms it went to. */
export const deletePost = (id: string) => apiFetch<void>(`/marketing/posts/${id}`, { method: 'DELETE' });
export const cancelTarget = (id: string) => apiFetch(`/marketing/targets/${id}/cancel`, { method: 'POST', body: '{}' });
export const resolveTarget = (id: string, outcome: 'published' | 'cancelled') =>
  apiFetch(`/marketing/targets/${id}/resolve`, { method: 'POST', body: JSON.stringify({ outcome, confirmed: true }) });
export const getAssets = (page = 1) => apiFetch<{ data: Asset[]; hasMore: boolean }>(`/marketing/assets?page=${page}`);
export const uploadAsset = (file: File) => {
  const body = new FormData();
  body.set('file', file);
  return apiFetch<Asset>('/marketing/assets', { method: 'POST', body });
};
export const history = (id: string) =>
  apiFetch<{ id: string; status: string; message: string | null; createdAt: string; targetId: string }[]>(`/marketing/posts/${id}/history`);

export const retryTarget = (id: string) => apiFetch(`/marketing/targets/${id}/retry`, { method: 'POST', body: '{}' });

/**
 * Where the browser loads a file for preview: the API's signed-in file route,
 * through the proxy. `url` is the public delivery link, which 404s for media
 * that isn't in published content — so never use it for a thumbnail.
 */
export function assetSrc(asset: Pick<Asset, 'id' | 'updatedAt'>): string {
  const query = new URLSearchParams();
  if (asset.updatedAt) query.set('v', asset.updatedAt);
  const tenantId = useWorkspaceStore.getState().tenantId;
  if (tenantId) query.set('tenantId', tenantId);
  return `${API_PREFIX}/v1/marketing/assets/${asset.id}/file${query.size ? `?${query}` : ''}`;
}
