import { redirect } from 'next/navigation';

import { PosConfiguration } from '@/components/settings/configuration/PosConfiguration';
import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function PosConfigurationPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !hasCapability(profile, 'orders:create')) redirect('/settings/configuration');
  return <PosConfiguration />;
}
