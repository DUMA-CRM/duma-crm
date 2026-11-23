'use client';

import Link from 'next/link';

import { Package, Plus } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { appPlaces, appState, shownRelease, storeTabs } from '@/lib/utils/marketplace';

import { ListingIcon } from './ListingMedia';
import { TONE_BADGE, aboutHref, useMarketplace } from './MarketplaceStore';

/** Settings → Installed apps: this workspace's apps, each row opening its listing, where it is managed. */
export function InstalledApps() {
  const store = useMarketplace();
  const installed = store.data ? storeTabs(store.data.apps).installed : [];

  return (
    <SettingsTabBody>
      <RecordGroup
        id="installed-apps"
        title="Installed apps"
        actions={<Button asChild variant="outline" size="sm"><Link href="/apps"><Plus aria-hidden="true" />Add apps</Link></Button>}
        footnote={store.data && installed.length > 0 ? 'Updates, credentials and removal are on each app’s page.' : undefined}
      >
        {store.isPending ? (
          <ListSkeleton rows={3} label="Loading installed apps" />
        ) : store.isError ? (
          <ErrorState icon={Package} title="Installed apps couldn’t be loaded" description={store.error.message} onRetry={() => void store.refetch()} />
        ) : installed.length === 0 ? (
          <EmptyState icon={Package} title="No apps installed" description="Apps add pages, dashboard widgets and tools to this workspace."
            action={{ label: 'Browse apps', href: '/apps' }} />
        ) : (
          <ListRowGroup>
            {installed.map((app) => {
              const release = shownRelease(app, true)!;
              const state = appState(app);
              return (
                <ListRow
                  key={app.id}
                  href={aboutHref(app.slug)}
                  leading={<ListingIcon appId={app.id} imageId={app.storeListing?.icon} builtin={release.builtin} size="sm" />}
                  title={app.storeListing?.name ?? release.name}
                  meta={[release.builtin ? 'Built by DUMA' : app.publisher, `v${release.version}`, ...appPlaces(release)].join(' · ')}
                  trailing={state && <Badge variant={TONE_BADGE[state.tone]}>{state.label}</Badge>}
                />
              );
            })}
          </ListRowGroup>
        )}
      </RecordGroup>
    </SettingsTabBody>
  );
}
