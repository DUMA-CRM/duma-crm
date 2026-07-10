import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthInitializer } from '@/components/providers/AuthInitializer';

import { getSession } from '@/lib/api/auth.service';
import { getMyStaffProfile } from '@/lib/api/staff.service';

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

  const session = await getSession(cookieHeader);

  // Session invalid — redirect through the clear-session route handler which
  // deletes the stale cookie before sending the browser to sign-in.
  // (Cookies can't be deleted directly in a Server Component.)
  if (!session) redirect('/api/auth/clear-session');

  // The signed-in user's role drives which nav items they can see.
  const profile = await getMyStaffProfile(cookieHeader);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Hydrates the Zustand auth store with the server-fetched user. */}
      <AuthInitializer user={session.user} role={profile?.role ?? null} />

      <Sidebar role={profile?.role ?? null} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
