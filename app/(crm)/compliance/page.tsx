import { Suspense } from 'react';

import { ComplianceWorkspace } from '@/components/compliance/ComplianceWorkspace';

export default function CompliancePage() {
  // The tab lives in the query string, and useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <ComplianceWorkspace />
    </Suspense>
  );
}
