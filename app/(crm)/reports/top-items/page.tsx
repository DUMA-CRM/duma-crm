import { redirect } from 'next/navigation';

import { TopItemsReportPage } from '@/components/reports/TopItemsReportPage';

import { roleAtLeast } from '@/lib/api/staff.service';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function Page() {
  const profile = await getCurrentStaffProfile();

  if (!profile || !roleAtLeast(profile.role, 'store_manager')) redirect('/dashboard');

  return <TopItemsReportPage />;
}
