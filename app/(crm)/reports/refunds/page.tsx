import { redirect } from 'next/navigation';

import { RefundReportPage } from '@/components/reports/RefundReportPage';
import { roleAtLeast } from '@/lib/api/staff.service';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function Page() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !roleAtLeast(profile.role, 'store_manager')) redirect('/dashboard');
  return <RefundReportPage />;
}
