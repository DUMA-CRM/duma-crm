import { cookies } from 'next/headers';
import 'server-only';

import { getCurrentStaffProfile } from '@/lib/auth/current-staff';
import type { ModuleId } from '@/lib/modules/manifest';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';

/**
 * Whether a module is on in the workspace this request is for — as far as the
 * server can tell.
 *
 * A member's workspace is their own, so the server can answer. A platform
 * administrator's workspace is chosen per tab (sessionStorage), which a Server
 * Component cannot see: asking the API here would answer for the wrong
 * workspace, or be refused. For them this returns `null` — not known — and the
 * tab's ContextBoundary shows the "module is off" state from the tab's own
 * workspace context. The API refuses a disabled module's routes either way.
 */
export async function workspaceModuleEnabled(moduleId: ModuleId): Promise<boolean | null> {
  const profile = await getCurrentStaffProfile();
  if (profile?.platform) return null;
  const cookieHeader = (await cookies())
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  const modules = await getCurrentTenantModules(undefined, cookieHeader);
  return modules.modules.some((module) => module.moduleId === moduleId && module.status === 'enabled');
}
