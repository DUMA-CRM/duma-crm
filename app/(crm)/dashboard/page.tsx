import { Suspense } from 'react';

import { ResolvedDashboard } from '@/components/dashboard/ResolvedDashboard';

export default function DashboardPage() {
  return (
    <Suspense>
      <ResolvedDashboard />
    </Suspense>
  );
}
