'use client';

import type { QueryClient } from '@tanstack/react-query';

import { ErrorState } from '@/components/shared/ErrorState';
import { Tooltip } from '@/components/shared/Tooltip';
import { Badge } from '@/components/ui/badge';

import { API_PREFIX } from '@/lib/api/client';
import type { CmsEntryStatus } from '@/lib/modules/cms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { entryStatusMeta } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** Every CMS server-state key, under the module prefix. */
export const cmsKeys = {
  overview: (tenantId: string | null) => moduleQueryKeys.cms.key('overview', tenantId),
  contentTypes: (tenantId: string | null) => moduleQueryKeys.cms.key('content-types', tenantId),
  contentType: (id: string | null) => moduleQueryKeys.cms.key('content-type', id),
  entries: (tenantId: string | null, filters: unknown) => moduleQueryKeys.cms.key('entries', tenantId, filters),
  entry: (id: string) => moduleQueryKeys.cms.key('entry', id),
  versions: (id: string) => moduleQueryKeys.cms.key('entry-versions', id),
  assets: (tenantId: string | null, filters: unknown) => moduleQueryKeys.cms.key('assets', tenantId, filters),
  storage: (tenantId: string | null) => moduleQueryKeys.cms.key('storage', tenantId),
  settings: (tenantId: string | null) => moduleQueryKeys.cms.key('settings', tenantId),
  locales: (tenantId: string | null) => moduleQueryKeys.cms.key('locales', tenantId),
  apiKeys: (tenantId: string | null) => moduleQueryKeys.cms.key('api-keys', tenantId),
  webhooks: (tenantId: string | null) => moduleQueryKeys.cms.key('webhooks', tenantId),
  deliveries: (id: string) => moduleQueryKeys.cms.key('webhook-deliveries', id),
};

/**
 * Content state is tightly linked — publishing an entry moves the overview
 * counts, the list, the type's published count and the version history — so a
 * mutation drops the whole module's cache rather than guessing which keys it
 * touched. It is one workspace's content; refetching it is cheap.
 */
export const invalidateCms = (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: moduleQueryKeys.cms.all });

export function EntryStatusBadge({ status, className }: { status: CmsEntryStatus; className?: string }) {
  const meta = entryStatusMeta(status);
  return (
    <Badge variant={meta.variant} className={className} title={meta.description}>
      {meta.label}
    </Badge>
  );
}

export function PanelError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
      <ErrorState title={title} onRetry={onRetry} />
    </div>
  );
}

/** The hairline card every CMS list sits in. */
export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-lg border border-rule/60 bg-card', className)}>{children}</div>;
}

export const TEXTAREA_CLASS =
  'w-full rounded-sm border border-rule bg-control px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-60';

export const FIELD_LABEL_CLASS = 'block text-label uppercase text-muted-foreground';

/** Copy to the clipboard, reporting the outcome — clipboard access can be refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const DELIVERY_FILE = /^\/v1\/cms\/delivery\/assets\/[0-9a-f-]{36}\/file(\/|$)/i;

/**
 * Where the CRM loads an asset URL from — for URLs with no asset beside them
 * (an image in rich text). Our CSP allows images from this origin only, so an
 * API delivery URL — root-relative, or absolute on the API's own host such as
 * `http://localhost:7777` — goes through the `/be` proxy. Anything else (a
 * tenant's own CDN) is left alone and may be refused by the CSP; prefer
 * `assetPreviewSrc` whenever the asset is known.
 */
export function assetSrc(url: string): string {
  if (url.startsWith('/')) return `${API_PREFIX}${url}`;
  try {
    const parsed = new URL(url);
    if (DELIVERY_FILE.test(parsed.pathname)) return `${API_PREFIX}${parsed.pathname}`;
  } catch {
    // Not a URL; let the browser decide.
  }
  return url;
}

/**
 * A thumbnail in the CRM, read by id through the API (`GET /cms/assets/:id/file`),
 * same-origin via `/be`. It works for every backend — local disk, DUMA storage,
 * a private bucket, a CDN the CSP has never heard of — and `v` caches it until
 * the file is replaced. Websites keep using `asset.url`.
 */
export function assetPreviewSrc(asset: { id: string; updatedAt: string }): string {
  const query = new URLSearchParams({ v: asset.updatedAt });
  const tenantId = useWorkspaceStore.getState().tenantId;
  if (tenantId) query.set('tenantId', tenantId);
  return `${API_PREFIX}/v1/cms/assets/${asset.id}/file?${query}`;
}

/** Each language version as a code with a status dot: live, changed, or draft. */
export function LanguageChips({ versions }: { versions: Array<{ id: string; locale: string; status: CmsEntryStatus }> }) {
  const dot: Record<CmsEntryStatus, string> = {
    published: 'bg-momentum',
    changed: 'bg-measured',
    draft: 'bg-reference',
    archived: 'bg-muted-foreground/50',
  };
  return (
    <span className="flex flex-nowrap gap-1 whitespace-nowrap">
      {versions.map((version) => (
        <Tooltip key={version.id} side="top" label={`${version.locale}: ${entryStatusMeta(version.status).label}`}>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-rule/60 bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            <span className={cn('size-1.5 rounded-full', dot[version.status])} aria-hidden="true" />
            {version.locale}
          </span>
        </Tooltip>
      ))}
    </span>
  );
}
