import { redirect } from 'next/navigation';

import { TradingAndPaymentsSettings } from '@/components/settings/TradingAndPaymentsSettings';
import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function TradingSettingsPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !hasCapability(profile, 'settings:write')) redirect('/settings');
  return <TradingAndPaymentsSettings />;
}
