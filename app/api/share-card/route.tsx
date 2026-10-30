import { renderShareCard } from '@/lib/marketing/og-image';

/**
 * A share card for any CMS entry — what the editor's "Generate" beside
 * Social image draws, then uploads to Media. Signed-in only: the proxy keeps
 * /api/* behind sign-in, so this is not an open image renderer.
 *
 * GET /api/share-card?label=Blog&title=… → 1200 × 630 PNG
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const title = params.get('title')?.trim().slice(0, 300);
  const label = params.get('label')?.trim().slice(0, 40) || 'Blog';
  if (!title) return new Response('A title is required', { status: 400 });
  return renderShareCard({ label, title });
}
