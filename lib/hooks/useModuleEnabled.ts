'use client';

import { useWorkspaceModules } from '@/lib/hooks/useWorkspaceContext';
import type { ModuleId } from '@/lib/modules/manifest';

/**
 * Whether a module is switched on for this workspace — `true` only once that
 * is known. Reads the tab's workspace context, so it costs no extra request and
 * can never answer with another workspace's modules.
 *
 * A capability is not enough on its own: the API refuses a disabled module's
 * routes (`requireEnabledModule`, 403 `module_disabled`) even for a role that
 * holds the capability. Gate the query itself on this, not just the UI around
 * it, or the request still goes out and the screen reports a permission error.
 */
export function useModuleEnabled(moduleId: ModuleId): boolean {
  const modules = useWorkspaceModules();
  return modules?.some((state) => state.moduleId === moduleId && state.status === 'enabled') ?? false;
}
