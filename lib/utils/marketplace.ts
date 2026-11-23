import type { Listing, Release, StoreApp } from '@/lib/api/marketplace.service';

/* The App Store's rules, kept out of the components so they can be tested:
   which release a card shows, what state it is in, and the one action it
   offers. The API is the boundary for every one of these — a button shown here
   that the API refuses still fails safely; a button hidden here that the API
   allows is only a missed affordance. */

export type AppTone = 'success' | 'warning' | 'exception' | 'info' | 'muted';

/** The release to describe: the installed one where it counts, else the store's latest, else the one in review. */
export function shownRelease(app: StoreApp, preferInstalled = false): Listing | null {
  const installed = app.installation?.release ?? null;
  return (preferInstalled ? installed ?? app.latest : app.latest ?? installed) ?? app.testRelease ?? null;
}

/** A live install whose release the store has moved past. A test install is replaced, not updated. */
export function updateAvailable(app: StoreApp): boolean {
  const installation = app.installation;
  return Boolean(installation && !installation.test && app.latest && installation.release.id !== app.latest.id);
}

/** The one state word a card carries, or null for an app this workspace hasn't touched. */
export function appState(app: StoreApp): { label: string; tone: AppTone } | null {
  const installation = app.installation;
  if (app.suspended) return { label: 'Suspended', tone: 'exception' };
  if (installation) {
    if (installation.test) return { label: 'Testing', tone: 'info' };
    if (installation.status === 'disabled') return { label: 'Disabled', tone: 'muted' };
    if (updateAvailable(app)) return { label: 'Update available', tone: 'warning' };
    return { label: 'Installed', tone: 'success' };
  }
  if (!app.latest && app.testRelease) return { label: 'In review', tone: 'info' };
  return null;
}

export type AppAction = 'open' | 'install' | 'update' | 'test' | 'enable';

/**
 * The card's main button. Opening wins for everyone who can open it, except a
 * manager with an update waiting — the update is then the thing to do.
 * Without `settings:write` the only action is opening.
 */
export function primaryAction(app: StoreApp, canManage: boolean): AppAction | null {
  const installation = app.installation;
  const update = updateAvailable(app);
  if (installation?.canOpen && !(update && canManage && !app.suspended)) return 'open';
  if (!canManage || app.suspended) return null;
  if (installation) {
    if (installation.status === 'disabled' && !installation.test) return 'enable';
    if (update) return 'update';
    // A test install is swapped for the published release once there is one.
    if (installation.test && app.latest) return 'install';
    return null;
  }
  if (app.latest) return 'install';
  if (app.testRelease) return 'test';
  return null;
}

export const ACTION_LABEL: Record<AppAction, string> = {
  open: 'Open',
  install: 'Install',
  update: 'Update',
  test: 'Install test release',
  enable: 'Enable',
};

/** Where an installed app shows up in DUMA, in the store's words. */
export function appPlaces(item: Pick<Listing, 'builtin' | 'pageOrigin' | 'extensions' | 'webhookOrigin' | 'scopes'>): string[] {
  const places: string[] = [];
  if (item.builtin || item.pageOrigin) places.push('Apps page');
  for (const { surface } of item.extensions ?? []) places.push(PLACE_LABEL[surface]);
  if (item.webhookOrigin || item.scopes.includes('cms.published:read')) places.push('Content');
  return places;
}

const PLACE_LABEL: Record<NonNullable<Listing['extensions']>[number]['surface'], string> = {
  dashboard: 'Dashboard',
  'order.detail': 'Orders',
  'menu.photo': 'Menu',
  'media.preview': 'Media',
};

export function matchesAppSearch(app: StoreApp, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const release = shownRelease(app);
  return [app.slug, app.publisher, app.storeListing?.name, app.storeListing?.description, release?.name, release?.description]
    .some((value) => value?.toLowerCase().includes(q));
}

/** The store's two tabs. Discover lists what can be installed; Installed what this workspace has. */
export function storeTabs(apps: StoreApp[]) {
  return {
    discover: apps.filter((app) => !app.suspended && (app.latest || app.testRelease)),
    installed: apps.filter((app) => app.installation),
  };
}

export const RELEASE_STATUS: Record<Release['status'], { label: string; tone: AppTone }> = {
  submitted: { label: 'In review', tone: 'info' },
  changes_requested: { label: 'Changes requested', tone: 'warning' },
  published: { label: 'Live', tone: 'success' },
  superseded: { label: 'Replaced', tone: 'muted' },
};

/** A publisher's app in one word: its newest release decides, a suspension overrides. */
export function publisherAppState(app: { suspensionReason: string | null; releases: Release[] }): { label: string; tone: AppTone } {
  if (app.suspensionReason) return { label: 'Suspended', tone: 'exception' };
  const newest = app.releases[0];
  if (!newest) return { label: 'Draft', tone: 'muted' };
  if (newest.status === 'superseded') return { label: 'Live', tone: 'success' };
  return RELEASE_STATUS[newest.status];
}
