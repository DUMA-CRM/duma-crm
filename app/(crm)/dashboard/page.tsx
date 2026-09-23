import { ResolvedDashboard } from '@/components/dashboard/ResolvedDashboard';

import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function DashboardPage() {
  const profile = await getCurrentStaffProfile();

  return <ResolvedDashboard role={profile?.role ?? 'barista'} />;
}
