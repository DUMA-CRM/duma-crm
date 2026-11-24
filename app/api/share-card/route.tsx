import { getCurrentStaffProfile } from '@/lib/auth/current-staff';
import { renderShareCard } from '@/lib/marketing/og-image';

/**
 * A share card for any CMS entry — what the editor's "Generate" beside
 * Social image draws, then uploads to Media. Signed-in only, checked here
 * against the API: the proxy only sees that a session cookie exists, and any
 * cookie would do, so on its own it left an open image renderer.
 *
 * GET /api/share-card?label=Blog&title=… → 1200 × 630 PNG
 */
export async function GET(request: Request) {
  const profile = await getCurrentStaffProfile().catch(() => null);
  if (!profile) return new Response('Authentication required', { status: 401 });
  const params = new URL(request.url).searchParams;
  const title = params.get('title')?.trim().slice(0, 300);
  const label = params.get('label')?.trim().slice(0, 40) || 'Blog';
  if (!title) return new Response('A title is required', { status: 400 });
  return renderShareCard({ label, title });
}
