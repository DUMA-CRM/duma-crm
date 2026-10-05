import { type ReactNode } from 'react';

import { requireAnyCapability } from '@/lib/auth/require-capability';

/**
 * Reports holds reports gated on different capabilities — analytics, refunds,
 * cash-ups, waste, purchasing — and one person's staff performance, gated on
 * staff access. The segment lets in anyone who can open at least one of them;
 * each page then checks its own. Until 2026-10-04 this required
 * `analytics:read`, which locked a `staff:read`-only manager out of the staff
 * performance page it linked them to.
 */
export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await requireAnyCapability(
    'analytics:read',
    'orders:refund',
    'cashups:read',
    'loss:read',
    'purchasing:read',
    'staff:read',
    'hr.people:read',
  );
  return children;
}
