import { Suspense } from 'react';

import { ConnectorsRoute } from '@/components/settings/connectors/ConnectorsRoute';

export default function SettingsConnectorsPage() {
  // ConnectorsRoute reads the connector/mode query params.
  return (
    <Suspense fallback={null}>
      <ConnectorsRoute />
    </Suspense>
  );
}
