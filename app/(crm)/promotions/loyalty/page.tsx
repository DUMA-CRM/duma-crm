import { Suspense } from 'react';

import { LoyaltyProgramWorkspace } from '@/components/customers/LoyaltyProgramWorkspace';

export default function PromotionsLoyaltyPage() {
  // The workspace reads `?programme=`, which needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <LoyaltyProgramWorkspace />
    </Suspense>
  );
}
