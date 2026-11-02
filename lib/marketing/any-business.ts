import type { ComparisonOption, ListItem } from '@/lib/marketing/solutions';

/**
 * /solutions/any-business — DUMA one part at a time: forms, notes and the API,
 * with the content system as one option among them. Each claim is checked
 * against duma-api: forms (forms.ts — a public link, required questions,
 * formats and options, questions shown by logic, close or cap a form, CSV
 * export, and responses matched to a customer by email or added as one);
 * notes (notes.ts — private notes and shared folders with read and edit
 * rights, search, tags, links between notes, history, Recently Deleted, and a
 * one-way sync to Google Drive); the API (scoped workspace keys, the Store,
 * Content and management APIs, the MCP server).
 *
 * The blog-led content words (CMS_*) belong to /solutions/blogs, which also
 * reads them from here. The CMS is headless — DUMA has no website builder — so
 * a site needs to be connected to it once. Forms have their own public link
 * and need no site.
 */

export const ANY_USE_CASES: readonly ListItem[] = [
  {
    title: 'An enquiry or booking-request form',
    body: 'Build the form, share its link, and every response arrives with the person who sent it saved as a customer you can follow up — no website needed.',
  },
  {
    title: 'A waiting list before you open',
    body: 'Collect names and emails with a form that closes on the date you choose or once it is full, then follow up with everyone on it.',
  },
  {
    title: 'A handbook for your team',
    body: 'Checklists, how-tos and policies in shared folders, with who can read and who can edit set per folder, searchable by everyone.',
  },
  {
    title: 'Your data in your own tools',
    body: 'Read and write products, content and notes from your own code with a scoped key, or let an AI assistant work with them through the MCP server.',
  },
];

export const ANY_SETUP_STEPS: readonly ListItem[] = [
  {
    title: 'Switch on the part you need.',
    body: 'Sign up free and turn on Forms, Notes or the API on its own. There is no till or menu to set up first.',
  },
  {
    title: 'Build it.',
    body: 'Add the questions to a form, or the first folder of notes for your team, or create a key with only the scopes your code needs.',
  },
  {
    title: 'Share it.',
    body: 'Send the form’s link, invite your team to the folder, or hand the key to your developer. Everything it collects lands in the same workspace.',
  },
];

/** What each of the three parts includes — each one an endpoint in duma-api. */
export const ANY_FEATURES: readonly ListItem[] = [
  { title: 'Forms with their own link', body: 'Required questions, formats and options, and questions that only show when an earlier answer calls for them.' },
  { title: 'Responses that become customers', body: 'A respondent is matched to an existing customer by email, or added as a new one, so you know who sent each answer.' },
  { title: 'Close a form, or cap it', body: 'Stop taking responses on a date or after a number of them, and export every response as a CSV file.' },
  { title: 'Shared notes and folders', body: 'Private notes, and shared folders where you choose who reads and who edits. Tags, links between notes and full history.' },
  { title: 'Notes in Google Drive', body: 'Connect Google Drive and DUMA keeps a copy of your notes there, synced one way, for anyone who works in Docs.' },
  { title: 'An API and MCP server', body: 'Scoped workspace keys for the Store, Content and management APIs, and an MCP server for an AI assistant.' },
];

/** Three ways to collect enquiries and keep a team's know-how — categories, not named products. */
export const ANY_COMPARISON: readonly ComparisonOption[] = [
  {
    title: 'A standalone form tool',
    summary: 'Good at forms. The people who fill them in end up in a spreadsheet, a long way from your customers.',
    bestFor: 'Surveys that stand on their own',
    rows: [
      { job: 'Forms with their own link', mark: 'yes' },
      { job: 'Responses become customers', mark: 'part', note: 'Exported or synced' },
      { job: 'Shared notes for the team', mark: 'no' },
      { job: 'An API for your data', mark: 'part', note: 'Varies' },
      { job: 'Grows into a business system', mark: 'no' },
    ],
  },
  {
    title: 'A notes app',
    summary: 'A good home for documents. Forms, customers and sales live somewhere else.',
    bestFor: 'Teams that only need documents',
    rows: [
      { job: 'Forms with their own link', mark: 'no' },
      { job: 'Responses become customers', mark: 'no' },
      { job: 'Shared notes for the team', mark: 'yes' },
      { job: 'An API for your data', mark: 'part', note: 'Varies' },
      { job: 'Grows into a business system', mark: 'no' },
    ],
  },
  {
    title: 'DUMA',
    summary: 'Forms, notes and an API in one workspace — and customers, a till and stock beside them when you need them.',
    bestFor: 'A business that may want more than one part later',
    rows: [
      { job: 'Forms with their own link', mark: 'yes', note: 'No website needed' },
      { job: 'Responses become customers', mark: 'yes', note: 'Matched by email' },
      { job: 'Shared notes for the team', mark: 'yes', note: 'Synced to Google Drive' },
      { job: 'An API for your data', mark: 'yes', note: 'Plus an MCP server' },
      { job: 'Grows into a business system', mark: 'yes', note: 'Switch on more parts' },
    ],
  },
];

/** How to start a blog on DUMA: /solutions/blogs. */
export const CMS_SETUP_STEPS: readonly ListItem[] = [
  {
    title: 'Switch on Content.',
    body: 'Sign up free and turn on the content system on its own. Nothing else needs setting up.',
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
  { title: 'Take it all with you', body: 'Export all your content as one JSON document, whenever you like.' },
];

/** Three ways to run a blog or a website's content — categories, not named products. */
export const CMS_COMPARISON: readonly ComparisonOption[] = [
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
    answer: 'Yes. Switch on forms, notes or the API on their own — you never have to set up a till or anything else you don’t need.',
  },
  {
    question: 'Do I need a website for a form?',
    answer: 'No. Every form has its own link to share by email, in a message or on social media. If you do have a site, it can send its forms to DUMA too.',
  },
  {
    question: 'What happens to form responses?',
    answer:
      'Each response is kept with the form, and the person who sent it is matched to a customer by email or added as a new one. You can export every response as a CSV file.',
  },
  {
    question: 'Can my team share notes?',
    answer:
      'Yes. Keep notes private or put them in shared folders, and choose who can read and who can edit each folder. If your team works in Google Docs, DUMA can keep a copy in Google Drive.',
  },
  {
    question: 'Is there an API?',
    answer:
      'Yes. Create a workspace key with only the scopes it needs, and use the Store, Content and management APIs from your own code — or connect an AI assistant through the MCP server.',
  },
  {
    question: 'What does it cost?',
    answer:
      'Nothing to start: the free plan has no time limit and no card. Parts beyond the basics have a free allowance, and the Business plan raises it when you need more.',
  },
];
