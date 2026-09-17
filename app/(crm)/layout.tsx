import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { Header } from '@/components/layout/Header';
import { LoginIntro } from '@/components/layout/LoginIntro';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthInitializer } from '@/components/providers/AuthInitializer';
import { WorkspaceInitializer } from '@/components/providers/WorkspaceInitializer';

import { getSession } from '@/lib/api/auth.service';
import { getCurrentTenantModules } from '@/lib/api/modules.service';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

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
  const moduleState = profile ? (await getCurrentTenantModules(undefined, cookieHeader)).modules : [];

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      {/* Hydrates the Zustand auth store with the server-fetched user. */}
      <AuthInitializer user={session.user} role={profile?.role ?? null} capabilities={profile?.capabilities ?? []} />
      <WorkspaceInitializer
        profile={profile ? { tenantId: profile.tenantId, role: profile.role, locationIds: profile.locationIds } : null}
      />

      {/* Plays only when a sign-in armed it; renders nothing otherwise. */}
      <LoginIntro />

      <Sidebar capabilities={profile?.capabilities ?? []} moduleState={moduleState} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 outline-none md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
