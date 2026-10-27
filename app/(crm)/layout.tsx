import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ContextBoundary } from '@/components/layout/ContextBoundary';
import { Header } from '@/components/layout/Header';
import { LoginIntro } from '@/components/layout/LoginIntro';
import { Sidebar } from '@/components/layout/Sidebar';
import { AnalyticsIdentity } from '@/components/providers/AnalyticsIdentity';
import { AuthInitializer } from '@/components/providers/AuthInitializer';
import { WorkspaceInitializer } from '@/components/providers/WorkspaceInitializer';
import { WorkspaceSettingsSync } from '@/components/providers/WorkspaceSettingsSync';

import { apiFetch } from '@/lib/api/client';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';
import { WorkspaceSeedProvider } from '@/lib/hooks/useWorkspaceContext';
import { getSession } from '@/lib/modules/identity/client';
import type { WorkspaceContextResponse } from '@/lib/modules/identity/client';

// Server Component — runs on every navigation to a CRM page.
// Validates the session with the API (not just a cookie existence check).
// Middleware handles the fast pre-filter; this is the authoritative guard.
export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  // Forward the browser's cookies to the API so it can read the session token.
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  // Both calls use the same cookie and are independent. Starting them together
  // removes one full API round trip from the first authenticated render.
  const [session, profile] = await Promise.all([getSession(cookieHeader), getCurrentStaffProfile()]);

  // Session invalid — redirect through the clear-session route handler which
  // deletes the stale cookie before sending the browser to sign-in.
  // (Cookies can't be deleted directly in a Server Component.)
  if (!session) redirect('/api/auth/clear-session');

  // A member's workspace is known here, so its context (modules, brand, zone)
  // is read now and seeds the first paint — for that workspace only. A platform
  // administrator's context lives in the tab (sessionStorage), which the server
  // cannot see: their shell renders neutral until the tab says where it is.
  const account = profile?.platform ? 'platform' : profile ? 'member' : 'none';
  const seed =
    account === 'member' ? await apiFetch<WorkspaceContextResponse>('/workspace-context', { cookieHeader }).catch(() => null) : null;

  return (
    <WorkspaceSeedProvider seed={seed?.workspace ? { accountId: session.user.id, data: seed } : null}>
      <div className="flex h-dvh overflow-hidden bg-background">
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-transform focus:translate-y-0"
        >
          Skip to main content
        </a>
        {/* Hydrates the Zustand auth store with the server-fetched user. */}
        <AuthInitializer user={session.user} role={profile?.role ?? null} capabilities={profile?.capabilities ?? []} />
        <AnalyticsIdentity id={session.user.id} email={session.user.email} name={session.user.name} role={profile?.role ?? null} />
        <WorkspaceInitializer
          userId={session.user.id}
          account={account}
          homeTenantId={profile?.tenantId ?? null}
          locationIds={profile?.locationIds ?? null}
          seed={seed}
        />
        {/* Before the pages: every time they show is read in this zone. */}
        <WorkspaceSettingsSync account={account} />

        {/* Plays only when a sign-in armed it; renders nothing otherwise. */}
        <LoginIntro />

        <Sidebar capabilities={profile?.capabilities ?? []} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 outline-none md:p-8">
            <ContextBoundary>{children}</ContextBoundary>
          </main>
        </div>
      </div>
    </WorkspaceSeedProvider>
  );
}
