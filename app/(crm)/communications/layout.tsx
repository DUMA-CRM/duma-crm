import { redirect } from 'next/navigation';

import { requireCapability } from '@/lib/auth/require-capability';
import { workspaceModuleEnabled } from '@/lib/auth/require-module';

export default async function CommunicationsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('email:read');
  // Communications holds two modules' tabs: Automations (automation) and the
  // rest (communications). The page opens when either is on and hides the
  // other's tabs. `null` is a platform administrator — the tab's workspace decides.
  const [communications, automation] = await Promise.all([workspaceModuleEnabled('communications'), workspaceModuleEnabled('automation')]);
  if (communications === false && automation === false) redirect('/settings/modules');
  return children;
}
