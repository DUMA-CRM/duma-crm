import { getPost } from '@/lib/blog/posts';
import { renderShareCard } from '@/lib/marketing/og-image';

/**
 * A post's generated share card (1200 × 630), used when the post has no
 * social image or cover of its own. A route rather than opengraph-image.tsx:
 * file-based metadata would outrank the image an editor chose in the CMS.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug);
  if (!post) return new Response('Not found', { status: 404 });
  return renderShareCard({ label: 'Blog', title: post.title });
}
