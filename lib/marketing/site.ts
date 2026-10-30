/**
 * The marketing site's one registry. The header, the footer and app/sitemap.ts
 * all read from here, so a page is added in one place and `published` decides
 * whether anything links to it. An unpublished entry is a plan, not a link: it
 * never reaches the nav or the sitemap, so nothing points at a 404.
 *
 * Every path here must sit under a section in MARKETING_PATHS
 * (lib/utils/public-paths.ts) or the proxy sends visitors to sign-in.
 */

export const SITE_NAME = 'DUMA';
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://duma-business.com').replace(/\/+$/, '');

export function absoluteUrl(path: string): string {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}

export type ModuleGroup = 'front-of-house' | 'back-of-house' | 'people' | 'growth' | 'insight';

export const MODULE_GROUP_LABELS: Record<ModuleGroup, string> = {
  'front-of-house': 'Front of house',
  'back-of-house': 'Back of house',
  people: 'People',
  growth: 'Customers & growth',
  insight: 'Insight & control',
};

export type MarketingModule = {
  slug: string;
  name: string;
  /** One line for menus and the features index. */
  summary: string;
  group: ModuleGroup;
  published: boolean;
};

/**
 * One entry per /features/[slug] page, in menu order within each group: the
 * 25 modules a workspace can switch on (lib/modules/manifest.ts MODULE_IDS,
 * less the always-on core, identity and organisation). Summaries follow the
 * product's own copy (components/onboarding/modules.ts MODULE_COPY) — keep the
 * two in step when a module changes.
 */
export const MODULES: readonly MarketingModule[] = [
  {
    slug: 'pos',
    name: 'Point of sale',
    summary: 'Take orders and payments at a counter or till, and keep selling offline.',
    group: 'front-of-house',
    published: false,
  },
  {
    slug: 'orders',
    name: 'Orders',
    summary: 'Every order from every channel in one list, through to fulfilment.',
    group: 'front-of-house',
    published: false,
  },
  {
    slug: 'qr-ordering',
    name: 'QR ordering',
    summary: 'Customers scan, order and pay from their own phone.',
    group: 'front-of-house',
    published: false,
  },
  {
    slug: 'kitchen-display',
    name: 'Kitchen display',
    summary: 'A live screen for the kitchen or packing bench: new, preparing, ready.',
    group: 'front-of-house',
    published: false,
  },
  {
    slug: 'payments',
    name: 'Payments',
    summary: 'Card, cash and invoice, reconciled every day.',
    group: 'front-of-house',
    published: false,
  },
  {
    slug: 'reservations',
    name: 'Reservations',
    summary: 'Bookings, a floor plan of your tables and a walk-in waitlist.',
    group: 'front-of-house',
    published: false,
  },

  {
    slug: 'products-catalog',
    name: 'Products & menu',
    summary: 'Everything you sell, with prices, options, recipes and margin.',
    group: 'back-of-house',
    published: false,
  },
  {
    slug: 'inventory',
    name: 'Stock',
    summary: 'Know what is on hand before you run out, updated by every sale.',
    group: 'back-of-house',
    published: false,
  },
  {
    slug: 'purchasing',
    name: 'Purchasing',
    summary: 'Order from suppliers and check deliveries in against them.',
    group: 'back-of-house',
    published: false,
  },
  {
    slug: 'notes',
    name: 'Notes',
    summary: 'Recipes, checklists and how-tos, shared by folder and searchable.',
    group: 'back-of-house',
    published: false,
  },

  {
    slug: 'staff-scheduling',
    name: 'Rotas & time',
    summary: 'Shifts, clock-ins and leave your team sees on their phone.',
    group: 'people',
    published: false,
  },
  {
    slug: 'people-hr',
    name: 'People & HR',
    summary: 'Employee records, documents and HR details in one place.',
    group: 'people',
    published: false,
  },
  { slug: 'payroll', name: 'Payroll', summary: 'Prepare pay runs and issue payslips.', group: 'people', published: false },
  { slug: 'help-centre', name: 'Help centre', summary: 'Guides and a helpdesk for your staff.', group: 'people', published: false },

  {
    slug: 'customers-loyalty',
    name: 'Customers & loyalty',
    summary: 'Recognise your regulars and reward them for coming back.',
    group: 'growth',
    published: false,
  },
  { slug: 'email-marketing', name: 'Messages', summary: 'Email your customers and your team.', group: 'growth', published: false },
  {
    slug: 'automation',
    name: 'Automation',
    summary: 'Build workflows that run on their own, and follow every run.',
    group: 'growth',
    published: false,
  },
  {
    slug: 'promotions',
    name: 'Promotions',
    summary: 'Promo codes with limits and dates, honoured at the till.',
    group: 'growth',
    published: false,
  },
  {
    slug: 'referrals',
    name: 'Refer a friend',
    summary: 'Every customer gets a code; a friend’s first order earns a reward.',
    group: 'growth',
    published: false,
  },
  {
    slug: 'forms',
    name: 'Forms',
    summary: 'Enquiry, feedback and sign-up forms whose responses become customers.',
    group: 'growth',
    published: false,
  },
  {
    slug: 'content-management',
    name: 'Content (CMS)',
    summary: 'Write your website and app content, and publish it over an API.',
    group: 'growth',
    published: false,
  },

  {
    slug: 'reports',
    name: 'Analytics',
    summary: 'Sales, margin and labour trends for one location or all of them.',
    group: 'insight',
    published: false,
  },
  {
    slug: 'ask-duma',
    name: 'Ask DUMA',
    summary: 'An assistant that knows your operation and answers from your data.',
    group: 'insight',
    published: false,
  },
  {
    slug: 'compliance',
    name: 'Compliance',
    summary: 'Handle privacy and personal-data requests properly.',
    group: 'insight',
    published: false,
  },
  {
    slug: 'audit-log',
    name: 'Audit log',
    summary: 'Review important activity and changes across the workspace.',
    group: 'insight',
    published: false,
  },
];

export type MarketingPage = {
  path: string;
  /** Label in the nav and footer. */
  label: string;
  published: boolean;
  /** Shown in the header's top level, not just the footer. */
  inHeader?: boolean;
  changeFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
};

/** Standalone pages. Module pages come from MODULES; blog posts from the CMS. */
export const PAGES: readonly MarketingPage[] = [
  { path: '/', label: 'Home', published: true, changeFrequency: 'weekly', priority: 1 },
  { path: '/features', label: 'All features', published: false, changeFrequency: 'monthly', priority: 0.9 },
  { path: '/why-duma', label: 'Why DUMA', published: false, inHeader: true, changeFrequency: 'monthly', priority: 0.8 },
  { path: '/pricing', label: 'Pricing', published: true, changeFrequency: 'monthly', priority: 0.9 },
  { path: '/solutions/cafes', label: 'Cafés and restaurants', published: true, changeFrequency: 'monthly', priority: 0.9 },
  { path: '/solutions/shops', label: 'Shops and online stores', published: true, changeFrequency: 'monthly', priority: 0.9 },
  { path: '/solutions/bars', label: 'Bars and pubs', published: true, changeFrequency: 'monthly', priority: 0.8 },
  { path: '/solutions/bakeries', label: 'Bakeries', published: true, changeFrequency: 'monthly', priority: 0.8 },
  { path: '/solutions/retail', label: 'Retail', published: true, changeFrequency: 'monthly', priority: 0.8 },
  { path: '/solutions/blogs', label: 'Blogs and creators', published: true, changeFrequency: 'monthly', priority: 0.8 },
  { path: '/solutions/any-business', label: 'Any business', published: true, changeFrequency: 'monthly', priority: 0.8 },
  { path: '/developers', label: 'Public API', published: true, changeFrequency: 'monthly', priority: 0.6 },
  { path: '/developers/mcp', label: 'MCP', published: true, changeFrequency: 'monthly', priority: 0.6 },
  { path: '/blog', label: 'Blog', published: true, inHeader: true, changeFrequency: 'daily', priority: 0.7 },
  { path: '/about', label: 'About', published: true, changeFrequency: 'yearly', priority: 0.5 },
  { path: '/contact', label: 'Contact', published: false, changeFrequency: 'yearly', priority: 0.5 },
  { path: '/privacy', label: 'Privacy', published: true, changeFrequency: 'yearly', priority: 0.2 },
  { path: '/terms', label: 'Terms', published: true, changeFrequency: 'yearly', priority: 0.2 },
];

export const SIGN_IN_PATH = '/sign-in';
export const SIGN_UP_PATH = '/sign-up';
/**
 * The one sign-up label, everywhere on the site. DUMA is free for now, and a
 * free product's strongest call to action says so. When paid plans arrive this
 * changes here, together with the free offer in softwareApplicationSchema.
 */
export const SIGN_UP_CTA = 'Start for free';

export function publishedModules(): MarketingModule[] {
  return MODULES.filter((m) => m.published);
}

export function modulePath(slug: string): string {
  return `/features/${slug}`;
}

export function publishedPage(path: string): MarketingPage | undefined {
  return PAGES.find((p) => p.path === path && p.published);
}

/**
 * The site's primary navigation: the two audiences, then pricing. Each links
 * to its own page once that page is published and to its home-page section
 * until then, so no link ever points at a 404 and nothing needs editing on
 * the day a page ships.
 */
const PRIMARY_NAV = [
  { label: 'Food & drink', path: '/solutions/cafes', fallback: '/#food' },
  { label: 'Shops', path: '/solutions/shops', fallback: '/#shops' },
  { label: 'Pricing', path: '/pricing', fallback: '/#pricing' },
] as const;

function primaryNav(): { label: string; path: string }[] {
  return PRIMARY_NAV.map((item) => ({ label: item.label, path: publishedPage(item.path) ? item.path : item.fallback }));
}

/** Where a link to one of the PRIMARY_NAV pages should go today. */
export function linkTo(path: (typeof PRIMARY_NAV)[number]['path']): string {
  return primaryNav()[PRIMARY_NAV.findIndex((item) => item.path === path)].path;
}

export type NavLink = { label: string; path: string; description?: string; icon?: 'api' | 'blog' };

/**
 * The header, after seline.com's: Pricing and About us as plain links, then a
 * small Resources menu — the Public API and the Blog, each with a line of
 * description. The audience pages are linked from the footer and the home page.
 */
export function headerNav(): { links: NavLink[]; resources: NavLink[] } {
  const about = publishedPage('/about');
  const blog = publishedPage('/blog');
  return {
    links: [{ label: 'Pricing', path: linkTo('/pricing') }, ...(about ? [{ label: 'About us', path: about.path }] : [])],
    resources: [
      { label: 'Public API', path: '/developers', description: 'Build on DUMA, or connect an AI assistant', icon: 'api' as const },
      ...(blog ? [{ label: 'Blog', path: blog.path, description: 'Guides for cafés, restaurants and small shops', icon: 'blog' as const }] : []),
    ],
  };
}
