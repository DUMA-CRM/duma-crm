import { listPosts } from '@/lib/blog/posts';
import { BLOG_AUTHOR } from '@/lib/blog/model';
import { absoluteUrl } from '@/lib/marketing/site';

/**
 * /llms.txt and /llms-full.txt — the llmstxt.org convention: a plain-text map
 * of the site for AI assistants and answer engines (GEO). The short file
 * lists what DUMA is and links every page worth citing; the full file adds
 * every post's text. Every line is true of the product today — the same
 * claims as the pages themselves.
 */

const PAGES: { title: string; path: string; summary: string }[] = [
  { title: 'Home', path: '/', summary: 'What DUMA is: one place to run a small business, on one bill.' },
  { title: 'Pricing', path: '/pricing', summary: 'Free forever plan; Business at £89 a month or £80 a month paid yearly, coming soon.' },
  { title: 'Cafés and restaurants', path: '/solutions/cafes', summary: 'Till, kitchen screen, QR ordering, recipe margin, stock, rotas and loyalty.' },
  { title: 'Bars and pubs', path: '/solutions/bars', summary: 'Drinks costed by recipe, table bookings with a waitlist, rotas and cash-up.' },
  { title: 'Bakeries', path: '/solutions/bakeries', summary: 'Recipe costing with the right VAT per item, waste tracking, stock and supplier orders.' },
  { title: 'Shops and online stores', path: '/solutions/shops', summary: 'Stock by size and colour, a till for the shop and pop-ups, and a storefront API.' },
  { title: 'Retail', path: '/solutions/retail', summary: 'Stock in every location, stocktakes, supplier orders, customers and loyalty.' },
  { title: 'Blogs and creators', path: '/solutions/blogs', summary: 'A headless content system with drafts, reviews, languages and your own storage.' },
  { title: 'Any business', path: '/solutions/any-business', summary: 'Use one part on its own: content, forms, notes or the API.' },
  { title: 'About', path: '/about', summary: 'Who builds DUMA, and why.' },
  { title: 'Public API', path: '/developers', summary: 'Store, Content and management APIs with one scoped workspace key.' },
  { title: 'MCP server', path: '/developers/mcp', summary: 'Connect an AI assistant to a DUMA workspace.' },
];

const INTRO = `# DUMA

> DUMA is the one place to run a small business — till, orders, stock, rotas, customers, marketing and reports in one workspace, on one bill. Built for cafés, restaurants, bars, bakeries and small shops in the UK. Free plan forever, no card needed.

## Facts

- Works in the browser on any tablet, phone or computer, and installs like an app.
- The till keeps taking orders offline and sends them when the connection is back.
- Square and SumUp card terminals connect directly; any other card machine works with the amount keyed in.
- Hosted in the United Kingdom.
- Built and supported by ${BLOG_AUTHOR.name}, founder.`;

export async function llmsText(full: boolean): Promise<string> {
  const { posts } = await listPosts();
  const published = posts.filter((post) => !post.sample && !post.seo.noIndex);

  const pages = PAGES.map((page) => `- [${page.title}](${absoluteUrl(page.path)}): ${page.summary}`).join('\n');
  const postList = published.map((post) => `- [${post.title}](${absoluteUrl(`/blog/${post.slug}`)}) (${post.publishedAt.slice(0, 10)}): ${post.excerpt}`).join('\n');

  const sections = [INTRO, `## Pages\n\n${pages}`, published.length ? `## Blog\n\n${postList}` : ''];
  if (!full) {
    sections.push(`## More\n\n- Full text of every post: ${absoluteUrl('/llms-full.txt')}\n- RSS: ${absoluteUrl('/blog/feed.xml')}\n- Sitemap: ${absoluteUrl('/sitemap.xml')}`);
    return sections.filter(Boolean).join('\n\n') + '\n';
  }

  const bodies = published.map((post) =>
    [
      `## ${post.title}`,
      `URL: ${absoluteUrl(`/blog/${post.slug}`)}`,
      `Published: ${post.publishedAt.slice(0, 10)} · Updated: ${post.updatedAt.slice(0, 10)} · Category: ${post.category}`,
      post.tldr ? `TL;DR: ${post.tldr}` : '',
      post.body,
      post.faq.length ? `### Questions\n\n${post.faq.map((q) => `**${q.question}**\n${q.answer}`).join('\n\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  );
  return [...sections.filter(Boolean), ...bodies].join('\n\n---\n\n') + '\n';
}
