import { redirect } from 'next/navigation';

import { ReportsWorkspace } from '@/components/reports/ReportsWorkspace';

import { roleAtLeast } from '@/lib/api/staff.service';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function ReportsPage() {
  const profile = await getCurrentStaffProfile();

  if (!profile || !roleAtLeast(profile.role, 'store_manager')) redirect('/dashboard');

  return <ReportsWorkspace />;
}
