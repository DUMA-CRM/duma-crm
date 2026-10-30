import { listPosts } from '@/lib/blog/posts';
import { SITE_NAME, absoluteUrl } from '@/lib/marketing/site';

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The blog's RSS 2.0 feed — for readers, aggregators and AI crawlers that
 * follow feeds. Each item carries the TL;DR when there is one, else the
 * excerpt. Samples and noindexed posts stay out.
 */
export async function GET() {
  const { posts } = await listPosts();
  const items = posts
    .filter((post) => !post.sample && !post.seo.noIndex)
    .map((post) => {
      const url = absoluteUrl(`/blog/${post.slug}`);
      return `    <item>
      <title>${escape(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <category>${escape(post.category)}</category>
      <description>${escape(post.tldr ?? post.excerpt)}</description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME} blog</title>
    <link>${absoluteUrl('/blog')}</link>
    <description>Practical guides on running a café, restaurant or small shop, from the team behind DUMA.</description>
    <language>en-gb</language>
    <atom:link href="${absoluteUrl('/blog/feed.xml')}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
