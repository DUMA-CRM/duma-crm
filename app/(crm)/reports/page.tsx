import { redirect } from 'next/navigation';

import { ReportsHome } from '@/components/reports/ReportsHome';

import { hasAnyCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function ReportsPage() {
  const profile = await getCurrentStaffProfile();
  // Someone who holds only staff access reaches staff performance from the staff record, not here.
  if (!profile || !hasAnyCapability(profile, 'analytics:read', 'orders:refund', 'cashups:read', 'loss:read', 'purchasing:read'))
    redirect('/dashboard');

  return <ReportsHome />;
}
