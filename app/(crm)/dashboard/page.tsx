import { MyDashboard } from '@/components/dashboard/MyDashboard';
import { TodayDashboard } from '@/components/dashboard/TodayDashboard';

import { roleAtLeast } from '@/lib/api/staff.service';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function DashboardPage() {
  const profile = await getCurrentStaffProfile();

  if (profile && roleAtLeast(profile.role, 'store_manager')) {
    return <TodayDashboard role={profile.role} />;
  }

  return <MyDashboard />;
}
