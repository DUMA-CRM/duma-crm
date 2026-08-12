import { redirect } from 'next/navigation';

import { BusinessReportPage } from '@/components/reports/BusinessReportPage';
import { MetricReportPage } from '@/components/reports/MetricReportPage';

import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';
import { isBusinessReportSection } from '@/lib/utils/business-reports';
import { isMetricKey } from '@/lib/utils/reports';

export default async function Page({ params }: { params: Promise<{ metric: string }> }) {
  const { metric } = await params;
  const profile = await getCurrentStaffProfile();

  if (!profile || !hasCapability(profile, 'analytics:read')) redirect('/dashboard');
  if (isBusinessReportSection(metric)) return <BusinessReportPage section={metric} />;
  if (!isMetricKey(metric)) redirect('/reports');

  return <MetricReportPage metric={metric} />;
}
