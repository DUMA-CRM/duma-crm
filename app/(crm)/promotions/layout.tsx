import { redirect } from 'next/navigation';

import { requireCapability } from '@/lib/auth/require-capability';
import { workspaceModuleEnabled } from '@/lib/auth/require-module';

/**
 * Promotions is a switchable module: a workspace that has not enabled it is
 * sent to the module settings rather than shown a page whose every call returns 403.
 */
export default async function PromotionsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('promotions:read');

  // null for a platform administrator: the tab's workspace decides (ContextBoundary).
  const enabled = await workspaceModuleEnabled('promotions');
  if (enabled === false) redirect('/settings/modules');

  return children;
}
