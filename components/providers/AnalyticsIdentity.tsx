'use client';

import { useEffect } from 'react';

import { identifyUser } from '@/lib/analytics/client';

/** Ties this browser's analytics to the signed-in account. Renders nothing. */
export function AnalyticsIdentity({ id, email, name, role }: { id: string; email: string; name: string; role: string | null }) {
  useEffect(() => {
    identifyUser({ id, email, name }, { role });
  }, [id, email, name, role]);
  return null;
}
