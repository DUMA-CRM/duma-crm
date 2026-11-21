import { apiFetch } from './client';

export const APP_EVENTS = ['entry.published', 'entry.unpublished', 'entry.deleted', 'asset.changed'] as const;
export const APP_PLACEMENTS = {
  dashboard: { label: 'Dashboard', access: 'Add a widget to the dashboard' },
  'order.detail': { label: 'Order details', access: 'Read the total of the open order when a user opens the widget' },
  'menu.photo': { label: 'Menu item photo', access: 'Read the selected photo on request and offer a new image for the user to apply' },
  'media.preview': { label: 'Media preview', access: 'Read the selected image or video on request and offer a new image for the user to save' },
} as const;
export type AppSurface = keyof typeof APP_PLACEMENTS;
type AppExtension = { surface: AppSurface; title: string; url: string };

type AppEvent = (typeof APP_EVENTS)[number];
export type AppManifest = {
  name: string;
  description: string;
  supportUrl: string;
  privacyUrl: string;
  pageUrl?: string;
  extensions?: AppExtension[];
  scopes: 'cms.published:read'[];
  webhook?: { url: string; events: AppEvent[] };
};
export type Listing = Omit<AppManifest, 'pageUrl' | 'webhook' | 'extensions'> & {
  id: string;
  version: string;
  builtin?: 'margin-calculator' | 'reorder-planner';
  pageOrigin: string | null;
  webhookOrigin: string | null;
  events: AppEvent[];
  extensions?: (Omit<AppExtension, 'url'> & { origin: string })[];
};
type ListingText = Pick<AppManifest, 'name' | 'description' | 'supportUrl' | 'privacyUrl'>;
export type StoreListing = ListingText & { revision: number; icon: string | null; screenshots: string[] };
export type ListingImage = { id: string } | { mimeType: string; data: string };
export type ListingUpdate = ListingText & { expectedRevision: number; icon: ListingImage | null; screenshots: ListingImage[] };

export function listingImageUrl(appId: string, imageId: string) {
  return `/be/v1/marketplace/media/${appId}/${imageId}`;
}

export type StoreApp = {
  id: string;
  slug: string;
  publisher: string;
  suspended: boolean;
  storeListing?: StoreListing | null;
  latest: Listing | null;
  testRelease: Listing | null;
  installation: {
    id: string;
    release: Listing;
    status: 'active' | 'disabled';
    revision: number;
    test: boolean;
    canOpen: boolean;
    activeSurfaces?: AppSurface[];
  } | null;
};
export type Release = {
  id: string;
  version: string;
  manifest: AppManifest;
  testInstructions: string;
  status: 'submitted' | 'changes_requested' | 'published' | 'superseded';
  reviewNote: string | null;
};
export type PublisherApp = {
  id: string;
  slug: string;
  suspensionReason: string | null;
  storeListing?: StoreListing | null;
  releases: Release[];
};
type InstallChange =
  | { action: 'activate'; releaseId: string; expectedRevision: number | null; test?: boolean }
  | { action: 'disable' | 'uninstall'; expectedRevision: number };
export type InstallCredentials = {
  installationId: string;
  token?: string;
  webhookSecret?: string | null;
};

const post = (body: unknown, workspaceId?: string) => ({
  method: 'POST',
  body: JSON.stringify(body),
  ...(workspaceId ? { workspaceId } : {}),
});

export const marketplaceKey = (workspaceId: string | undefined) => ['organization', 'marketplace', workspaceId] as const;
export const getMarketplace = (workspaceId: string) =>
  apiFetch<{ canManage: boolean; apps: StoreApp[] }>('/marketplace', { workspaceId });

export const changeInstallation = (workspaceId: string, slug: string, change: InstallChange) =>
  apiFetch<InstallCredentials>(`/marketplace/${encodeURIComponent(slug)}/manage`, post(change, workspaceId));

export const getPublisher = () =>
  apiFetch<{ publisher: string | null; apps: PublisherApp[] }>('/platform/app-publishers', { workspaceId: 'platform' });
export const registerApp = (slug: string) => apiFetch('/platform/app-publishers', post({ slug }, 'platform'));
export const submitRelease = (appId: string, version: string, manifest: AppManifest, testInstructions: string) =>
  apiFetch(`/platform/app-publishers/${appId}/releases`, post({ version, manifest, testInstructions }, 'platform'));

export const getReviewQueue = () =>
  apiFetch<{ apps: (PublisherApp & { publisher: string; hidden: boolean })[] }>('/platform/app-review', { workspaceId: 'platform' });
export const invitePublisher = (email: string, name: string) =>
  apiFetch('/platform/app-review/publishers', post({ email, name }, 'platform'));
export const decideRelease = (releaseId: string, decision: 'publish' | 'request_changes', note: string) =>
  apiFetch(`/platform/app-review/releases/${releaseId}`, post({ decision, note }, 'platform'));
export const suspendApp = (appId: string, reason: string) =>
  apiFetch(`/platform/app-review/apps/${appId}/suspend`, post({ reason }, 'platform'));

export const setAppVisibility = (appId: string, hidden: boolean) =>
  apiFetch(`/platform/app-review/apps/${appId}/visibility`, post({ hidden }, 'platform'));
export const restoreApp = (appId: string) =>
  apiFetch(`/platform/app-review/apps/${appId}/restore`, post({}, 'platform'));

export const saveListing = (appId: string, listing: ListingUpdate, admin: boolean) =>
  apiFetch<{ storeListing: StoreListing }>(admin ? `/platform/app-review/apps/${appId}/listing`
    : `/platform/app-publishers/${appId}/listing`, post(listing, 'platform'));
