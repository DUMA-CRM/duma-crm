'use client';

import { hasCapability } from '@/lib/auth/capabilities';
import { useAuthStore } from '@/stores/authStore';

/**
 * What this viewer may do in Communications — the same capabilities the API
 * checks per route (`duma-api/src/routes/email.ts`). Hiding a control is only a
 * courtesy; the API is the boundary. `email:read` is guaranteed by the layout.
 */
export function useEmailAccess() {
  const capabilities = useAuthStore((state) => state.capabilities);
  return {
    /** Create, edit, pause and delete templates and automations. */
    canWrite: hasCapability(capabilities, 'email:write'),
    /** Put a workflow live (first switch-on included). */
    canPublish: hasCapability(capabilities, 'email:publish'),
    /** Test sends and retrying a failed delivery. */
    canSend: hasCapability(capabilities, 'email:send'),
    /** Add and lift marketing suppressions. */
    canSuppress: hasCapability(capabilities, 'email:suppressions'),
    /** `GET /email/connection` — without it the state is unknown, not "not set up". */
    canReadConnection: hasCapability(capabilities, 'email.connections:read'),
    /** Open the email connector in Settings. */
    canConfigure: hasCapability(capabilities, 'email.connections:write'),
  };
}

export type EmailAccess = ReturnType<typeof useEmailAccess>;
