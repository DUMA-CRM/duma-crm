import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard';
import { MyDashboard } from '@/components/dashboard/MyDashboard';

import { roleAtLeast } from '@/lib/api/staff.service';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function DashboardPage() {
  const profile = await getCurrentStaffProfile();

  if (profile && roleAtLeast(profile.role, 'store_manager')) {
    return <ManagerDashboard role={profile.role} />;
  }

  return <MyDashboard />;
}
