import { Suspense } from 'react';

import { SupportGuide } from '@/components/support/SupportGuide';

import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

export default async function SupportPage() {
  const profile = await getCurrentStaffProfile();

  // The guide reads `?tab=` for deep links, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <SupportGuide role={profile?.role ?? null} />
    </Suspense>
  );
}
