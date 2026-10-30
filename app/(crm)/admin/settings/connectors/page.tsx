import { Suspense } from 'react';

import { ConnectorsRoute } from '@/components/settings/connectors/ConnectorsRoute';

export default function AdminConnectionsPage() {
  return (
    <Suspense fallback={null}>
      <ConnectorsRoute />
    </Suspense>
  );
}
