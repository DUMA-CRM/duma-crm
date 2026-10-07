import { redirect } from 'next/navigation';

import { StorefrontKeysPanel } from '@/components/settings/developers/StorefrontKeysPanel';

import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

// Keys that record orders and customers are a settings decision — the same
// holders who switch modules on and off. The API checks `settings:write` too.
export default async function SettingsDevelopersPage() {
  const profile = await getCurrentStaffProfile();
  if (!profile || !hasCapability(profile, 'settings:write')) redirect('/settings');
  return <StorefrontKeysPanel />;
}
