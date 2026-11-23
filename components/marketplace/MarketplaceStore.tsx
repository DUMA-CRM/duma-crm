'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Package, Search } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type StoreApp, getMarketplace, marketplaceKey } from '@/lib/api/marketplace.service';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';
import { ACTION_LABEL, type AppTone, appPlaces, appState, matchesAppSearch, primaryAction, shownRelease, storeTabs } from '@/lib/utils/marketplace';

import { type InstallKind, useInstallFlow } from './InstallFlow';
import { ListingIcon } from './ListingMedia';

type Tab = 'discover' | 'installed';

export const TONE_BADGE: Record<AppTone, 'success' | 'warning' | 'destructive' | 'reference' | 'muted'> = {
  success: 'success',
  warning: 'warning',
  exception: 'destructive',
  info: 'reference',
  muted: 'muted',
};

export const aboutHref = (slug: string) => `/apps/${encodeURIComponent(slug)}/about`;
export const openHref = (slug: string) => `/apps/${encodeURIComponent(slug)}`;

export function useMarketplace(options: { refetchInterval?: number } = {}) {
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;
  return useQuery({
    queryKey: marketplaceKey(workspaceId),
    queryFn: () => getMarketplace(workspaceId!),
    enabled: Boolean(workspaceId),
    meta: { silentError: true },
    ...options,
  });
}

function AppCard({ app, canManage, installedTab, onAction }: {
  app: StoreApp;
  canManage: boolean;
  installedTab: boolean;
  onAction: (kind: InstallKind) => void;
}) {
  const release = shownRelease(app, installedTab);
  if (!release) return null;
  const name = app.storeListing?.name ?? release.name;
  const state = appState(app);
  const action = primaryAction(app, canManage);
  const places = appPlaces(release);
  return (
    <li className="group relative flex min-w-0 flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition-[border-color,box-shadow] hover:border-rule/60 hover:shadow-md focus-within:border-rule/60">
      <div className="flex items-start gap-3">
        <ListingIcon appId={app.id} imageId={app.storeListing?.icon} builtin={release.builtin} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-heading">
            {/* The whole card opens the listing; the action button sits above this link. */}
            <Link href={aboutHref(app.slug)} className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring">
              {name}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted-foreground">{release.builtin ? 'Built by DUMA' : app.publisher}</p>
        </div>
        {state && <Badge variant={TONE_BADGE[state.tone]}>{state.label}</Badge>}
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{app.storeListing?.description ?? release.description}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{places.join(' · ')}</span>
        {action && (
          action === 'open' ? (
            <Button asChild size="sm" variant="outline" className="relative z-10 shrink-0">
              <Link href={openHref(app.slug)}>Open</Link>
            </Button>
          ) : (
            <Button size="sm" variant={action === 'install' ? 'default' : 'outline'} className="relative z-10 shrink-0" onClick={() => onAction(action)}>
              {ACTION_LABEL[action]}
            </Button>
          )
        )}
      </div>
    </li>
  );
}

function CardsSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading apps">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Bone className="size-12 rounded-xl" />
            <span className="flex-1 space-y-1.5 pt-1">
              <Bone className="h-3.5 w-32" />
              <Bone className="h-3 w-20" />
            </span>
          </div>
          <Bone className="mt-4 h-3 w-full" />
          <Bone className="mt-2 h-3 w-2/3" />
          <div className="mt-5 flex justify-between">
            <Bone className="h-3 w-24" />
            <Bone className="h-8 w-16" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function CardGrid({ title, apps, ...props }: { title?: string; apps: StoreApp[]; canManage: boolean; installedTab: boolean; onAction: (app: StoreApp, kind: InstallKind) => void }) {
  return (
    <section aria-label={title} className="space-y-2">
      {title && <h2 className="px-1 text-base font-semibold tracking-title text-heading">{title}</h2>}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} canManage={props.canManage} installedTab={props.installedTab} onAction={(kind) => props.onAction(app, kind)} />
        ))}
      </ul>
    </section>
  );
}

/** Apps: the store's Discover tab and this workspace's Installed tab. A card opens the app’s listing. */
export function MarketplaceStore() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = params.get('tab') === 'installed' ? 'installed' : 'discover';
  const [search, setSearch] = useState('');
  const store = useMarketplace({ refetchInterval: 60_000 });
  const flow = useInstallFlow();
  const tabs = store.data ? storeTabs(store.data.apps) : null;
  const visible = tabs?.[tab].filter((app) => matchesAppSearch(app, search)) ?? [];
  const searching = search.trim().length > 0;
  // Discover leads with DUMA's own tools when it isn't searching.
  const builtIn = visible.filter((app) => shownRelease(app)?.builtin);
  const partners = visible.filter((app) => !shownRelease(app)?.builtin);
  const grouped = tab === 'discover' && !searching && builtIn.length > 0 && partners.length > 0;
  const setTab = (next: Tab) => router.replace(next === 'installed' ? `${pathname}?tab=installed` : pathname, { scroll: false });
  const gridProps = {
    canManage: store.data?.canManage ?? false,
    installedTab: tab === 'installed',
    onAction: (app: StoreApp, kind: InstallKind) => flow.start({ app, kind }),
  };

  return (
    <EditorShell
      title="Apps"
      icon={<Package size={18} aria-hidden="true" />}
      actions={<Button asChild variant="outline" size="sm"><Link href="/developers/apps">Build an app</Link></Button>}
    >
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel="Show"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'discover', label: 'Discover' },
              { value: 'installed', label: tabs ? `Installed · ${tabs.installed.length}` : 'Installed' },
            ]}
          />
          <div className="ml-auto w-full sm:w-72">
            <Input type="search" aria-label="Search apps" placeholder="Search apps" value={search} maxLength={120}
              leftIcon={<Search size={14} aria-hidden="true" />} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>

        {store.isPending ? (
          <CardsSkeleton />
        ) : store.isError ? (
          <ErrorState icon={Package} title="Apps couldn’t be loaded" description={store.error.message} onRetry={() => void store.refetch()} />
        ) : visible.length === 0 ? (
          searching ? (
            <EmptyState icon={Package} kind="search" title="No apps match" description="Try another name or publisher."
              action={{ label: 'Clear search', onClick: () => setSearch('') }} />
          ) : tab === 'installed' ? (
            <EmptyState icon={Package} title="No apps installed" description="Apps you install appear here and in the sidebar."
              action={{ label: 'Discover apps', onClick: () => setTab('discover') }} />
          ) : (
            <EmptyState icon={Package} title="No apps yet" description="Apps for this workspace will appear here." />
          )
        ) : grouped ? (
          <div className="space-y-8">
            <CardGrid title="From DUMA" apps={builtIn} {...gridProps} />
            <CardGrid title="From partners" apps={partners} {...gridProps} />
          </div>
        ) : (
          <CardGrid apps={visible} {...gridProps} />
        )}

        {store.data && !store.data.canManage && (
          <p className="px-1 text-xs text-muted-foreground">A workspace admin installs and removes apps.</p>
        )}
      </div>
      {flow.dialogs}
    </EditorShell>
  );
}
