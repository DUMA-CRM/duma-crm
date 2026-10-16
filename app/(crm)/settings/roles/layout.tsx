import { redirect } from 'next/navigation';

import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function SettingsRolesLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentStaffProfile();
  if (profile?.role !== 'super_admin') redirect('/settings');
  return children;
}
