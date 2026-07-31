import { Suspense } from 'react';

import { MyHrWorkspace } from '@/components/people/MyHrWorkspace';

export default function MyHrPage() {
  // The workspace reads `?tab=` for deep links, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <MyHrWorkspace />
    </Suspense>
  );
}
