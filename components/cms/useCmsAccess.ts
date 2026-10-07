'use client';

import { hasCapability } from '@/lib/auth/capabilities';
import { useAuthStore } from '@/stores/authStore';

/**
 * What this viewer may do in Content — the same capabilities the API checks
 * per route (`duma-api/src/routes/cms.ts`). Hiding a control is a courtesy;
 * the API is the boundary. `cms:read` is guaranteed by the layout.
 */
export function useCmsAccess() {
  const capabilities = useAuthStore((state) => state.capabilities);
  return {
    /** Create and edit drafts, upload media, duplicate and restore. */
    canWrite: hasCapability(capabilities, 'cms:write'),
    /** Publish, unpublish, schedule, archive and delete. */
    canPublish: hasCapability(capabilities, 'cms:publish'),
    /** Change content types and locales. */
    canModel: hasCapability(capabilities, 'cms.schema:write'),
    /** API keys and webhooks — integration credentials. */
    canManageKeys: hasCapability(capabilities, 'cms.keys:write'),
  };
}

export type CmsAccess = ReturnType<typeof useCmsAccess>;
