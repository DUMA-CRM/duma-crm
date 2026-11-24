import { BookOpen, ClipboardList, Code, Download, FileText, FolderOpen, Lock, NotebookPen, Users } from '@/components/icons';
import { ContentEditorMock, FormMock, StorefrontApiMock } from '@/components/marketing/mocks';
import { PageLink } from '@/components/marketing/RelatedLinks';
import type { SolutionContent } from '@/components/marketing/SolutionPage';

import { AUDIENCE_LINKS, type ComparisonOption, type ListItem } from '@/lib/marketing/solutions';

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
 * Blogging is /solutions/blogs' subject (its CMS words live there), so the
 * content system is one card here and links there. Forms have their own public
 * link and need no site.
 */

const ANY_USE_CASES: readonly ListItem[] = [
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

const ANY_SETUP_STEPS: readonly ListItem[] = [
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
const ANY_FEATURES: readonly ListItem[] = [
  { title: 'Forms with their own link', body: 'Required questions, formats and options, and questions that only show when an earlier answer calls for them.' },
  { title: 'Responses that become customers', body: 'A respondent is matched to an existing customer by email, or added as a new one, so you know who sent each answer.' },
  { title: 'Close a form, or cap it', body: 'Stop taking responses on a date or after a number of them, and export every response as a CSV file.' },
  { title: 'Shared notes and folders', body: 'Private notes, and shared folders where you choose who reads and who edits. Tags, links between notes and full history.' },
  { title: 'Notes in Google Drive', body: 'Connect Google Drive and DUMA keeps a copy of your notes there, synced one way, for anyone who works in Docs.' },
  { title: 'An API and MCP server', body: 'Scoped workspace keys for the Store, Content and management APIs, and an MCP server for an AI assistant.' },
];

/** Three ways to collect enquiries and keep a team's know-how — categories, not named products. */
const ANY_COMPARISON: readonly ComparisonOption[] = [
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

const ANY_FAQS: { question: string; answer: string }[] = [
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

export const ANY_BUSINESS: SolutionContent = {
  path: '/solutions/any-business',
  slug: 'any',
  breadcrumb: 'Any business',
  metaTitle: 'Form Builder, Team Notes and an API, Free to Start | DUMA',
  description:
    'Use one part of DUMA on its own: forms whose responses become customers, shared notes for your team, and an API and MCP server. Free to start, no card.',
  hero: {
    lead: 'Use just the part',
    mark: 'you need',
    subtitle:
      'A form builder whose responses become customers, shared notes for your team, and an API and MCP server for your data. Each works on its own — and grows into the rest of DUMA when you’re ready.',
    narrowSubtitle: true,
    ticks: ['Free to start', 'No card needed', 'No website needed'],
    visual: { node: <FormMock />, caption: 'An example waiting-list form, and the customer it becomes.' },
  },
  how: {
    title: 'Start with one part.',
    note: false,
    cards: [
      { icon: ClipboardList, tone: 'orders', tag: 'no website needed', title: 'Forms', body: 'Build an enquiry, feedback or waiting-list form and share its link. Every response becomes a customer.', visual: <FormMock /> },
      {
        icon: BookOpen,
        tone: 'team',
        tag: 'for teams',
        title: 'Notes',
        body: 'Checklists, how-tos and policies in private notes and shared folders — searchable, and synced one way to Google Drive if you use it.',
      },
      { icon: Code, tone: 'action', tag: 'for developers', title: 'API and MCP', body: 'Read and write your DUMA data from your own code with a scoped key, or from an AI assistant through the MCP server.', visual: <StorefrontApiMock /> },
      {
        icon: FileText,
        tone: 'reference',
        tag: 'for websites',
        title: 'Content',
        body: (
          <>
            A headless content system for the pages and posts on your own site. Writing a blog? See{' '}
            <PageLink path={AUDIENCE_LINKS.blogs.path}>DUMA’s content system for blogs and creators</PageLink>.
          </>
        ),
        visual: <ContentEditorMock />,
      },
    ],
  },
  useCases: {
    title: 'Four ways people use one part of DUMA',
    lead: ['A business collecting enquiries, a new place building a waiting list, a team that needs one handbook, a developer who wants the data in their own tools.'],
    items: ANY_USE_CASES,
    icons: [ClipboardList, Users, BookOpen, Code],
  },
  explainer: {
    title: 'What forms, notes and an API should do for a small business',
    intro: (
      <p>
        A form should put the person who filled it in on your customer list, not in a spreadsheet. Notes should be where the team already looks. And your data
        should be yours to reach from your own tools, with a key that can only do what you allow.
      </p>
    ),
    setupTitle: 'How to start with one part of DUMA',
    steps: ANY_SETUP_STEPS,
    metricsTitle: 'What forms, notes and the API include',
    metrics: ANY_FEATURES,
    /** One per ANY_FEATURES entry, in order: forms, customers, close or cap, notes, Drive, API. */
    metricIcons: [ClipboardList, Users, Lock, FolderOpen, Download, Code],
    comparisonTitle: 'A form tool, a notes app,',
    comparisonHighlight: 'or DUMA',
    comparison: ANY_COMPARISON,
    /** Form tool, notes app — DUMA's own entry shows the logo instead. */
    comparisonIcons: [ClipboardList, NotebookPen],
  },
  setupBand: { title: 'Start with one part, today.', body: 'Sign up free, switch on what you need, and we’ll help you set it up.' },
  faqTitle: 'Questions people ask',
  faqs: ANY_FAQS,
  closing: { title: 'The one place for whatever you run.' },
  related: {
    audiences: [AUDIENCE_LINKS.blogs, AUDIENCE_LINKS.cafes, AUDIENCE_LINKS.shops],
    extra: [
      { path: '/developers', label: 'The DUMA public API reference' },
      { path: '/developers/mcp', label: 'Connect an AI assistant through the MCP server' },
    ],
  },
};
