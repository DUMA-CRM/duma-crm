import { Suspense } from 'react';

import { ExtensionSlot } from '@/components/marketplace/ExtensionSlot';
import { ResolvedDashboard } from '@/components/dashboard/ResolvedDashboard';

export default function DashboardPage() {
  return (
    <Suspense>
      <ResolvedDashboard />
      <ExtensionSlot surface="dashboard" />
    </Suspense>
  );
}
