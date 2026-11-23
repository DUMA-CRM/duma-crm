import { Suspense } from 'react';

import { MarketplaceStore } from '@/components/marketplace/MarketplaceStore';

export default function AppStorePage() {
  // The store reads ?tab= for Discover / Installed.
  return (
    <Suspense>
      <MarketplaceStore />
    </Suspense>
  );
}
