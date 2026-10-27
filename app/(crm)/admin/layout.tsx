import { redirect } from 'next/navigation';

import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

// DUMA Admin is for platform administrators — authority from a platform role,
// never a workspace role. The API refuses every /platform route to anyone
// else; this only spares them a page of refusals.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentStaffProfile();
  if (!profile?.platform) redirect('/dashboard');
  return children;
}
