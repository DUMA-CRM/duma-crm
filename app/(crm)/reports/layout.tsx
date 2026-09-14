import { type ReactNode } from 'react';

import { requireCapability } from '@/lib/auth/require-capability';

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await requireCapability('analytics:read');
  return children;
}
