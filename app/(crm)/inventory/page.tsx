'use client';

import { Suspense } from 'react';

import { InventoryWorkspace } from '@/components/inventory/InventoryWorkspace';

export default function InventoryPage() {
  // useSearchParams (the `?tab=` deep link) needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <InventoryWorkspace />
    </Suspense>
  );
}
