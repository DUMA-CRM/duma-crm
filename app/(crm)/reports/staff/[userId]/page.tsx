import { redirect } from 'next/navigation';

import { StaffPerformanceReport } from '@/components/reports/StaffPerformanceReport';

import { hasAnyCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

/**
 * One person's operational performance. It lives in Reports because it is
 * trading analysis, but it is gated on `staff:read` rather than the
 * `analytics:read` the rest of Reports uses: that is what the API enforces on
 * `GET /staff/:userId/performance`, and gating any wider would show
 * `marketing_manager` and `auditor` a link the API then refuses.
 *
 * Guarded inline rather than in a layout, matching `/reports` itself — the
 * whole area lacks route guards (UI-TD-012).
 */
export default async function StaffPerformancePage({ params }: { params: Promise<{ userId: string }> }) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !hasAnyCapability(profile, 'staff:read', 'hr.people:read')) redirect('/dashboard');

  const { userId } = await params;
  return <StaffPerformanceReport userId={userId} />;
}
