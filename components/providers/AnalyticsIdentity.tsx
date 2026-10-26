'use client';

import { useEffect } from 'react';

import { identifyUser } from '@/lib/analytics/client';

/** Ties this browser's analytics to the signed-in account. Renders nothing. */
export function AnalyticsIdentity({
  id,
  email,
  name,
  role,
  tenantId,
}: {
  id: string;
  email: string;
  name: string;
  role: string | null;
  tenantId: string | null;
}) {
  useEffect(() => {
    identifyUser({ id, email, name }, { role, tenantId });
  }, [id, email, name, role, tenantId]);
  return null;
}
