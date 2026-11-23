'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Info, Package } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import type { StoreApp } from '@/lib/api/marketplace.service';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';

import { ListingIcon } from './ListingMedia';
import { aboutHref, useMarketplace } from './MarketplaceStore';
import { MarketplaceMarginCalculator, StockReorderPlanner } from './StarterApps';

const builtinPages = {
  'margin-calculator': MarketplaceMarginCalculator,
  'reorder-planner': StockReorderPlanner,
};

/** Why an installed app can't open here, in one line the reader can act on. */
function unavailableReason(app: StoreApp | undefined) {
  if (!app) return 'It isn’t installed in this workspace.';
  if (app.suspended) return 'DUMA has suspended it.';
  if (!app.installation) return 'It isn’t installed in this workspace.';
  if (app.installation.status === 'disabled') return 'It’s disabled in this workspace.';
  return 'It needs access this workspace or your role doesn’t have.';
}

/** An installed app's own page: a built-in tool, or the publisher's page in a sandboxed frame. */
export function MarketplacePage({ slug }: { slug: string }) {
  const router = useRouter();
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;
  const store = useMarketplace({ refetchInterval: 30_000 });
  const [loadedRevision, setLoadedRevision] = useState<number>();
  const app = store.data?.apps.find((entry) => entry.slug === slug);
  const installation = app?.installation;
  const item = installation?.release;
  const BuiltinPage = item?.builtin ? builtinPages[item.builtin] : null;
  const name = app?.storeListing?.name ?? item?.name ?? 'App';

  return (
    <EditorShell
      title={name}
      onClose={() => router.push('/apps')}
      leading={app && <ListingIcon appId={app.id} imageId={app.storeListing?.icon} builtin={item?.builtin} size="sm" />}
      meta={app && <span className="text-sm text-muted-foreground">{item?.builtin ? 'Built by DUMA' : app.publisher}</span>}
      actions={app && (
        <Button asChild variant="outline" size="sm">
          <Link href={aboutHref(slug)}><Info aria-hidden="true" />About</Link>
        </Button>
      )}
    >
      {store.isPending ? (
        <LoadingState label="Opening app" />
      ) : store.isError ? (
        <ErrorState icon={Package} title="This app couldn’t be opened" description={store.error.message} onRetry={() => void store.refetch()} />
      ) : !installation?.canOpen ? (
        <EmptyState icon={Package} kind="gone" title={`${name} can’t open here`} description={unavailableReason(app)}
          action={{ label: app ? 'View in App Store' : 'Back to Apps', href: app ? aboutHref(slug) : '/apps' }} />
      ) : BuiltinPage ? (
        <div className="mx-auto w-full max-w-5xl"><BuiltinPage key={installation.revision} /></div>
      ) : (
        <div className="relative h-[calc(100dvh-9rem)] min-h-[32rem] overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {loadedRevision !== installation.revision && (
            <LoadingState label={`Opening ${name}`} className="absolute inset-0 bg-card" />
          )}
          <iframe
            key={installation.revision}
            className="block size-full"
            title={name}
            referrerPolicy="no-referrer"
            onLoad={() => setLoadedRevision(installation.revision)}
            src={`/api/marketplace-frame/${encodeURIComponent(slug)}?workspace=${encodeURIComponent(workspaceId!)}`}
          />
        </div>
      )}
    </EditorShell>
  );
}
