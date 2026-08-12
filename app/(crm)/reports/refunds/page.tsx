import { redirect } from 'next/navigation';

import { RefundReportPage } from '@/components/reports/RefundReportPage';
import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function Page() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !hasCapability(profile, 'analytics:read')) redirect('/dashboard');
  return <RefundReportPage />;
}
