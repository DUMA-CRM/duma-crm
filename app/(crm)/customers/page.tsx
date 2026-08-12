import { Suspense } from 'react';

import { CustomersWorkspace } from '@/components/customers/CustomersWorkspace';

export default function CustomersPage() {
  // The workspace keeps its filters in the query string, which needs a Suspense
  // boundary above useSearchParams.
  return (
    <Suspense fallback={null}>
      <CustomersWorkspace />
    </Suspense>
  );
}
