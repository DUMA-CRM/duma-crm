import { redirect } from 'next/navigation';

import { KitchenConfiguration } from '@/components/settings/configuration/KitchenConfiguration';
import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function KitchenConfigurationPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !hasCapability(profile, 'orders:status')) redirect('/settings/configuration');
  return <KitchenConfiguration />;
}
