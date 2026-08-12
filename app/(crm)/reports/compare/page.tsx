import { redirect } from 'next/navigation';

import { ReportsWorkspace } from '@/components/reports/ReportsWorkspace';

import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function ReportsComparePage() {
  const profile = await getCurrentStaffProfile();

  if (!profile || !hasCapability(profile, 'analytics:read')) redirect('/dashboard');

  return <ReportsWorkspace tab="compare" />;
}
