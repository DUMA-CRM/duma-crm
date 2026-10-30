import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/marketing/site';

/**
 * schema.org builders for the marketing site's JSON-LD. Render the result with
 * <JsonLd> (components/marketing/JsonLd.tsx), never a hand-written script tag —
 * that is where the escaping lives.
 *
 * Only claims the page itself makes visibly belong here: Google treats markup
 * that describes content the visitor cannot see as spam.
 */

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/**
 * DUMA's profiles elsewhere — LinkedIn, X, YouTube, Product Hunt, G2. Google
 * and AI answer engines use these to tie mentions of DUMA to this site, and
 * off-site mentions are the strongest evidenced signal for AI search. Empty
 * until the profiles exist; never list one that does not.
 */
const SAME_AS: string[] = [];

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    alternateName: 'DUMA Business',
    url: SITE_URL,
    // Google needs at least 112×112, legible on white: the forest mark is both.
    logo: absoluteUrl('/icon.svg'),
    ...(SAME_AS.length > 0 && { sameAs: SAME_AS }),
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    // Read by Google when it picks the site name shown in results.
    alternateName: 'DUMA Business',
    url: SITE_URL,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

/**
 * The product itself. DUMA is free for now, and the home page says so — the
 * offer must come out the day paid plans arrive (see SIGN_UP_CTA).
 *
 * Google shows a software rich result only with `aggregateRating` or
 * `review`, so this earns none yet — and must not be given an invented one,
 * which is a manual-action offence. Add real ratings when there are some.
 */
export function softwareApplicationSchema({ description }: { description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android, Windows, macOS',
    publisher: { '@id': ORGANIZATION_ID },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
  };
}

/** `trail` runs from the top level down to the current page, home excluded. */
export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...trail].map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * Only for a FAQ the page renders in full — the answers must be on the page.
 * Google retired FAQ rich results for every site in May 2026, so this buys no
 * search-result feature; it stays because the questions are still read for
 * understanding the page, by Google and by AI answer engines.
 */
export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

type PostForSchema = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  cover: { url: string; width: number | null; height: number | null } | null;
  publishedAt: string;
  updatedAt: string;
  wordCount: number;
  seo: { metaDescription?: string; canonicalUrl?: string };
};

const AUTHOR = { '@type': 'Person', name: 'Marian Dudych', jobTitle: 'Founder of DUMA', url: absoluteUrl('/about'), worksFor: { '@id': ORGANIZATION_ID } } as const;

/**
 * One blog post as a BlogPosting — what Google's article results and AI
 * answer engines read for the headline, dates, author and image. The image
 * falls back to the post's generated share card, so it is never empty.
 */
export function blogPostingSchema(post: PostForSchema) {
  const url = post.seo.canonicalUrl ?? absoluteUrl(`/blog/${post.slug}`);
  const image = post.cover
    ? { '@type': 'ImageObject', url: post.cover.url, ...(post.cover.width && { width: post.cover.width }), ...(post.cover.height && { height: post.cover.height }) }
    : { '@type': 'ImageObject', url: absoluteUrl(`/blog/${post.slug}/og`), width: 1200, height: 630 };
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: post.title,
    description: post.seo.metaDescription ?? post.excerpt,
    image,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    articleSection: post.category,
    wordCount: post.wordCount,
    inLanguage: 'en-GB',
    author: AUTHOR,
    publisher: { '@id': ORGANIZATION_ID },
    isPartOf: { '@type': 'Blog', '@id': `${SITE_URL}/blog#blog` },
  };
}

/** The blog itself, listing its posts — for the /blog index. */
export function blogSchema(posts: PostForSchema[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${SITE_URL}/blog#blog`,
    url: absoluteUrl('/blog'),
    name: 'DUMA blog',
    description: 'Practical guides on running a café, restaurant or small shop — margins, rotas, stock and selling — from the team behind DUMA.',
    inLanguage: 'en-GB',
    publisher: { '@id': ORGANIZATION_ID },
    blogPost: posts.slice(0, 50).map((post) => ({
      '@type': 'BlogPosting',
      '@id': `${absoluteUrl(`/blog/${post.slug}`)}#article`,
      headline: post.title,
      url: absoluteUrl(`/blog/${post.slug}`),
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
    })),
  };
}
