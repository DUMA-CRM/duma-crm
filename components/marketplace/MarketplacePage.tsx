'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { getMarketplace, marketplaceKey } from '@/lib/api/marketplace.service';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';

import { MarketplaceMarginCalculator, StockReorderPlanner } from './StarterApps';
import { ListingIcon } from './ListingMedia';

const builtinPages = {
  'margin-calculator': MarketplaceMarginCalculator,
  'reorder-planner': StockReorderPlanner,
};

export function MarketplacePage({ slug }: { slug: string }) {
  const { workspace } = useWorkspaceContext();
  const workspaceId = workspace?.id;
  const store = useQuery({
    queryKey: marketplaceKey(workspaceId), queryFn: () => getMarketplace(workspaceId!),
    enabled: Boolean(workspaceId), refetchInterval: 30_000, refetchOnMount: 'always', meta: { silentError: true },
  });
  const app = store.data?.apps.find((entry) => entry.slug === slug);
  const installation = app?.installation;
  const item = installation?.release;
  const BuiltinPage = item?.builtin ? builtinPages[item.builtin] : null;
  const name = app?.storeListing?.name ?? item?.name;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline"><Link href="/apps">App Store</Link></Button>
        {app && item && <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ListingIcon appId={app.id} imageId={app.storeListing?.icon} builtin={item.builtin} />{name}
        </h1>}
      </header>
      {store.isPending ? <p role="status">Loading app…</p> : installation?.canOpen && !store.isError ? (
        BuiltinPage ? <BuiltinPage key={installation.revision} /> : <iframe
          key={installation.revision}
          className="block min-h-[65vh] w-full rounded-lg border border-border bg-card md:h-[calc(100dvh-11rem)]"
          title={name ?? installation.release.name}
          referrerPolicy="no-referrer"
          src={`/api/marketplace-frame/${encodeURIComponent(slug)}?workspace=${encodeURIComponent(workspaceId!)}`}
        />
      ) : <p role="status">{store.error?.message ?? 'This app page is unavailable in this workspace.'}</p>}
    </div>
  );
}
