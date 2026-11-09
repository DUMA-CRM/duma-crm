import { CONTACT_EMAIL, SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/marketing/site';

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
    email: CONTACT_EMAIL,
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
/**
 * What the product does, as every page that carries this schema says it in
 * view: the home page's one-line promise and the parts each solution page shows.
 */
const FEATURES = ['Till (EPOS) that works offline', 'Orders and payments', 'Stock', 'Recipe costing and margin', 'Staff rotas and clock-ins', 'Customers and loyalty', 'Email marketing', 'Reports'];

export function softwareApplicationSchema({ description }: { description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    // One product, however many pages describe it.
    '@id': `${SITE_URL}/#software`,
    name: SITE_NAME,
    url: SITE_URL,
    description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android, Windows, macOS',
    publisher: { '@id': ORGANIZATION_ID },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
    featureList: FEATURES,
    // The dashboard is the screenshot the home page shows. The till's still has a demo menu that isn't English.
    screenshot: absoluteUrl('/marketing/screenshots/dashboard.png'),
  };
}

/**
 * A free tool on the site — the menu margin calculator — as the WebApplication
 * it is: its own name and URL, free, runs in a browser. `featureList` must be
 * what the page visibly does.
 */
export function webApplicationSchema({ name, path, description, features }: { name: string; path: string; description: string; features: string[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${absoluteUrl(path)}#app`,
    name,
    url: absoluteUrl(path),
    description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any (runs in a web browser)',
    browserRequirements: 'Requires JavaScript',
    inLanguage: 'en-GB',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
    featureList: features,
    publisher: { '@id': ORGANIZATION_ID },
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

const PERSON_ID = `${SITE_URL}/about#founder`;
const AUTHOR = { '@type': 'Person', '@id': PERSON_ID, name: 'Marian Dudych', jobTitle: 'Founder of DUMA', url: absoluteUrl('/about'), worksFor: { '@id': ORGANIZATION_ID } } as const;

/** /about: the page is about the founder — the same Person every post names as author. */
export function aboutPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${absoluteUrl('/about')}#page`,
    url: absoluteUrl('/about'),
    mainEntity: AUTHOR,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };
}

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

/**
 * /tools — the index as a CollectionPage whose list is the tools on it, in
 * the summary-list form (each item a URL), since every tool has its own page.
 */
export function toolCollectionSchema({ path, name, description, tools }: { path: string; name: string; description: string; tools: readonly { path: string; name: string }[] }) {
  const url = absoluteUrl(path);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#page`,
    url,
    name,
    description,
    inLanguage: 'en-GB',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': ORGANIZATION_ID },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: tools.length,
      itemListElement: tools.map((tool, index) => ({ '@type': 'ListItem', position: index + 1, name: tool.name, url: absoluteUrl(tool.path) })),
    },
  };
}

/** /glossary — the set every DefinedTerm belongs to. */
export function glossarySchema(terms: { slug: string; term: string; short: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${absoluteUrl('/glossary')}#set`,
    name: 'Business terms & definitions',
    url: absoluteUrl('/glossary'),
    hasDefinedTerm: terms.map((term) => ({
      '@type': 'DefinedTerm',
      name: term.term,
      description: term.short,
      url: absoluteUrl(`/glossary/${term.slug}`),
    })),
  };
}

/** One /glossary/<slug> page: the term, defined, and the article that explains it. */
export function glossaryTermSchema(term: { slug: string; term: string; title: string; short: string; updated: string }) {
  const url = absoluteUrl(`/glossary/${term.slug}`);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTerm',
        '@id': `${url}#term`,
        name: term.term,
        description: term.short,
        url,
        inDefinedTermSet: { '@id': `${absoluteUrl('/glossary')}#set` },
      },
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        headline: term.title,
        description: term.short,
        about: { '@id': `${url}#term` },
        dateModified: term.updated,
        publisher: { '@id': ORGANIZATION_ID },
      },
    ],
  };
}
