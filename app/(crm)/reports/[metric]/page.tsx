import { redirect } from 'next/navigation';

import { MetricReportPage } from '@/components/reports/MetricReportPage';

import { roleAtLeast } from '@/lib/api/staff.service';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';
import { isMetricKey } from '@/lib/utils/reports';

export default async function Page({ params }: { params: Promise<{ metric: string }> }) {
  const { metric } = await params;
  const profile = await getCurrentStaffProfile();

  if (!profile || !roleAtLeast(profile.role, 'store_manager')) redirect('/dashboard');
  if (!isMetricKey(metric)) redirect('/reports');

  return <MetricReportPage metric={metric} />;
}
