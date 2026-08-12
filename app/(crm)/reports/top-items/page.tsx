import { redirect } from 'next/navigation';

import { TopItemsReportPage } from '@/components/reports/TopItemsReportPage';

import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function Page() {
  const profile = await getCurrentStaffProfile();

  if (!profile || !hasCapability(profile, 'analytics:read')) redirect('/dashboard');

  return <TopItemsReportPage />;
}
