import { UpdatesAdmin } from '@/components/updates/UpdatesAdmin';
import { redirect } from 'next/navigation';

import { requireCapability } from '@/lib/auth/require-capability';
import { workspaceModuleEnabled } from '@/lib/auth/require-module';

/**
 * Content is a switchable module: a workspace that has not enabled it is sent
 * to the module settings rather than shown a page whose every call returns 403.
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireCapability('cms:read');

  // null for a platform administrator: the tab's workspace decides (ContextBoundary).
  const cmsEnabled = await workspaceModuleEnabled('cms');
  if (cmsEnabled === false && profile.role === 'super_admin') return <UpdatesAdmin />;
  if (cmsEnabled === false) redirect('/settings/modules');

  return children;
}
