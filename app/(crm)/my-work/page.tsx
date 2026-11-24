import { Suspense } from 'react';

import { MyWork } from '@/components/people/my-hr/MyWork';

/** Your own rota and HR. No guard — every signed-in member reaches their own, as /scheduling and /my-hr did. */
export default function MyWorkPage() {
  // The page reads `?tab=`, which needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <MyWork />
    </Suspense>
  );
}
