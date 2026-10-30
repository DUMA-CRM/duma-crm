import type { ComparisonOption, ListItem } from '@/lib/marketing/solutions';

/**
 * /solutions/any-business — DUMA one part at a time: the content system for a
 * blog or website, forms, notes, the API. Each claim is checked against
 * duma-api: the CMS (content types, drafts and versions, preview links,
 * locales, webhooks, delivery keys, own storage bucket, JSON export), public
 * forms whose responses become customers, and notes with Google Drive sync.
 *
 * The CMS is headless — DUMA has no website builder — so a site needs to be
 * connected to it once. Forms have their own public link and need no site.
 */

export const ANY_USE_CASES: readonly ListItem[] = [
  {
    title: 'A blog or a magazine',
    body: 'Write posts in DUMA, in as many languages as you need, and show them on your own site. Drafts, versions and preview links come built in.',
  },
  {
    title: 'The content behind a website',
    body: 'Pages, products, team members, FAQs — design the content types your site needs, and publish them to it through the delivery API.',
  },
  {
    title: 'A waiting list or an enquiry form',
    body: 'Build a form, share its link, and every response becomes a customer you can follow up — no website needed.',
  },
  {
    title: 'A handbook for your team',
    body: 'Recipes, checklists, how-tos and policies in shared folders, searchable by everyone, and kept in step with Google Docs if you use them.',
  },
];

export const ANY_SETUP_STEPS: readonly ListItem[] = [
  {
    title: 'Switch on the part you need.',
    body: 'Sign up free and turn on Content, Forms or Notes on its own. Nothing else needs setting up.',
  },
  {
    title: 'Shape your content.',
    body: 'Create a content type — a blog post, a page, a product — with the fields it needs, then write your first entry.',
  },
  {
    title: 'Connect your site.',
    body: 'Give your site a delivery key and it reads what you publish. A webhook can tell it to rebuild the moment something changes.',
  },
];

/** What the content system includes — each one an endpoint in duma-api's CMS routes. */
export const CMS_FEATURES: readonly ListItem[] = [
  { title: 'Your own content types', body: 'Posts, pages, products, anything — with the fields you choose, and a preview of what a change would affect.' },
  { title: 'Drafts, versions and previews', body: 'Work in a draft, look back at earlier versions, and share a link that shows a draft on your real site.' },
  { title: 'Every language', body: 'Add the languages you write in. Fields that don’t change between them can be shared across all of them.' },
  { title: 'Media in your own storage', body: 'Keep images in DUMA, or connect your own Cloudflare R2 or Vercel Blob bucket and move files across.' },
  { title: 'Delivery API and webhooks', body: 'Your site reads published content with a key, and webhooks tell it when something changes.' },
  { title: 'Take it all with you', body: 'Export everything in the content system as one JSON document, whenever you like.' },
];

/** Three ways to run a blog or a website's content — categories, not named products. */
export const ANY_COMPARISON: readonly ComparisonOption[] = [
  {
    title: 'A hosted blog platform',
    summary: 'Quick to start, with themes to pick from. Your design, storage and growth stay within the platform.',
    bestFor: 'A simple blog that will stay a blog',
    rows: [
      { job: 'Write and publish', mark: 'yes' },
      { job: 'Your own site and design', mark: 'part', note: 'Their themes' },
      { job: 'Media in your own storage', mark: 'no' },
      { job: 'Many languages', mark: 'part', note: 'Often a plugin' },
      { job: 'Grows into a business', mark: 'part', note: 'Plugins and add-ons' },
    ],
  },
  {
    title: 'A headless CMS',
    summary: 'Flexible content over an API, for a site you build. It does content, and only content.',
    bestFor: 'Developers who only need content',
    rows: [
      { job: 'Write and publish', mark: 'yes' },
      { job: 'Your own site and design', mark: 'yes' },
      { job: 'Media in your own storage', mark: 'part', note: 'Varies' },
      { job: 'Many languages', mark: 'yes' },
      { job: 'Grows into a business', mark: 'no', note: 'Content only' },
    ],
  },
  {
    title: 'DUMA',
    summary: 'A content system with an API — and forms, customers, a till and a shop in the same workspace when you need them.',
    bestFor: 'A blog or site that may grow into a business',
    rows: [
      { job: 'Write and publish', mark: 'yes', note: 'Drafts, versions, previews' },
      { job: 'Your own site and design', mark: 'yes', note: 'Through the delivery API' },
      { job: 'Media in your own storage', mark: 'yes', note: 'Cloudflare R2 or Vercel Blob' },
      { job: 'Many languages', mark: 'yes' },
      { job: 'Grows into a business', mark: 'yes', note: 'Switch on more parts' },
    ],
  },
];

export const ANY_FAQS: { question: string; answer: string }[] = [
  {
    question: 'Can I use just one part of DUMA?',
    answer: 'Yes. Switch on the content system, forms or notes on their own — you never have to set up a till or anything else you don’t need.',
  },
  {
    question: 'Do I need a developer?',
    answer:
      'For a website, once: DUMA’s content system is headless, so your site is connected to it with a delivery key, and then you write and publish in DUMA. Forms and notes need no developer — a form has its own link to share.',
  },
  {
    question: 'Where are my images stored?',
    answer: 'In DUMA by default. You can connect your own Cloudflare R2 or Vercel Blob bucket instead, and move existing files across.',
  },
  {
    question: 'Can I write in more than one language?',
    answer: 'Yes. Add the languages you need; each entry has a version in each, and fields that don’t change between languages can be shared.',
  },
  {
    question: 'Can I take my content with me?',
    answer: 'Yes. You can export everything in the content system as one JSON document at any time.',
  },
  {
    question: 'What does it cost?',
    answer:
      'Nothing to start: the free plan has no time limit and no card. Parts beyond the basics have a free allowance, and the Business plan raises it when you need more.',
  },
];
