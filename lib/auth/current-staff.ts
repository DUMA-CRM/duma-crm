import { cookies } from 'next/headers';
import { cache } from 'react';
import 'server-only';

import { getMyStaffProfile } from '@/lib/api/staff.service';

// Layouts and pages render in the same request but cannot pass data directly to
// one another. React cache gives them one authoritative profile result per
// request and also shares any failure instead of producing inconsistent roles.
export const getCurrentStaffProfile = cache(async () => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  return getMyStaffProfile(cookieHeader);
});
