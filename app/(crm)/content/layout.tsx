import { redirect } from 'next/navigation';

import { UpdatesAdmin } from '@/components/updates/UpdatesAdmin';

import { requireCapability } from '@/lib/auth/require-capability';
import { workspaceModuleEnabled } from '@/lib/auth/require-module';

/**
 * Content is a switchable module (see requireModule). With it off, a super
 * admin still lands here — on product updates, which live in this section.
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireCapability('cms:read');

  // null for a platform administrator: the tab's workspace decides (ContextBoundary).
  const cmsEnabled = await workspaceModuleEnabled('cms');
  if (cmsEnabled === false && profile.role === 'super_admin') return <UpdatesAdmin />;
  if (cmsEnabled === false) redirect('/settings/modules');

  return children;
}
