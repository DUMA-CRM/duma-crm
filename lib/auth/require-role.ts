import { redirect } from 'next/navigation';
import 'server-only';

import { type StaffRole, roleAtLeast } from '@/lib/api/staff.service';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export async function requireMinimumRole(minimum: StaffRole) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !roleAtLeast(profile.role, minimum)) redirect('/dashboard');
  return profile;
}

export async function requireAnyRole(roles: StaffRole[]) {
  const profile = await getCurrentStaffProfile();
  if (!profile || (profile.role !== 'super_admin' && !roles.includes(profile.role))) redirect('/dashboard');
  return profile;
}
