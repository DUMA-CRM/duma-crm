import { BookOpen, Code, Copy, FileText, Globe, ImageIcon, Languages, Layers, Mail, Users, Zap } from '@/components/icons';
import { ContentEditorMock, FormMock } from '@/components/marketing/mocks';
import { Mark } from '@/components/marketing/sections';
import { SolutionPage, type SolutionContent, solutionMetadata } from '@/components/marketing/SolutionPage';

import { ANY_COMPARISON, ANY_SETUP_STEPS, CMS_FEATURES } from '@/lib/marketing/any-business';

/**
 * /solutions/blogs — DUMA's content system for bloggers, writers and creators.
 * Claims checked against duma-api: content types, drafts, versions and preview
 * links, review requests (submit for review / send back with changes),
 * per-content-type edit permissions, locales, own storage bucket, webhooks,
 * JSON export; newsletter sign-ups through the storefront API and forms; email
 * to opted-in readers through segments, templates and automations. The CMS is
 * headless — a site is connected to it once.
 */

const content: SolutionContent = {
  path: '/solutions/blogs',
  breadcrumb: 'Blogs and creators',
  metaTitle: 'Headless CMS for Blogs and Creators, Free to Start | DUMA',
  description:
    'A headless content system for your blog: write in DUMA, publish to your own site in every language, keep images in your own storage, collect subscribers and export everything any time. Free to start.',
  hero: {
    lead: 'A content system for',
    mark: 'your blog',
    subtitle: 'Write in DUMA, publish to your own site in every language, keep your images in your own storage — and grow a list of readers from the first post.',
    ticks: ['Free to start', 'Your own storage', 'Export any time'],
    visual: { node: <ContentEditorMock bleed={false} />, caption: 'An example blog post in the DUMA content editor.' },
  },
  teaser: {
    title: 'Turn readers into subscribers.',
    intro: (
      <p>
        A sign-up form on your site, or a form with its own link — every subscriber lands in DUMA as a contact, and your emails reach <Mark>only the people who
        opted in</Mark>.
      </p>
    ),
    visual: <FormMock />,
    caption: 'An example sign-up form, and the subscriber it becomes.',
  },
  mistakes: {
    title: 'Five things that hold a blog back',
    items: [
      { title: 'Writing into a platform you can’t leave.', body: 'Years of posts locked in one service. DUMA exports everything in the content system as one JSON document, whenever you want.' },
      { title: 'Keeping your images on someone else’s servers.', body: 'If the platform goes, so do the pictures. Connect your own Cloudflare R2 or Vercel Blob bucket and keep your media where you choose.' },
      { title: 'Publishing in one language only.', body: 'Readers abroad leave when they can’t read you. Add the languages you write in; fields that don’t change can be shared across all of them.' },
      { title: 'Publishing without a proper preview.', body: 'Typos and broken layouts go live. Share a preview link that shows a draft on your real site before anyone else sees it.' },
      { title: 'Readers you never hear from again.', body: 'A visit without a sign-up is gone. Collect subscribers with a form, and email them from the same place you write.' },
    ],
  },
  how: {
    title: 'How DUMA runs a blog',
    intro: (
      <p>
        Write, review and publish in one place, show it on <Mark>your own site, in your own design</Mark>, and keep your readers and your images in your hands.
      </p>
    ),
    cards: [
      { icon: FileText, tone: 'reference', tag: 'for writers', title: 'The editor', body: 'Posts with the fields you design, drafts and versions, a search preview, and every language you write in.', visual: <ContentEditorMock /> },
      { icon: Mail, tone: 'orders', tag: 'for readers', title: 'Subscribers and email', body: 'Sign-up forms turn readers into contacts. Email reaches only the people who opted in.', visual: <FormMock /> },
      { icon: Users, tone: 'team', tag: 'for teams', title: 'Review before it goes live', body: 'Writers submit a post for review; an editor publishes it or sends it back with requested changes. Limit who can edit each content type.' },
      { icon: Code, tone: 'action', tag: 'for your site', title: 'Delivery API and webhooks', body: 'Your site reads what you publish with a key, and a webhook tells it to rebuild the moment something changes.' },
    ],
  },
  useCases: {
    title: 'Four ways writers use DUMA',
    lead: [
      'A personal blog, a magazine with several writers, a newsletter, a site in two languages — each is one content system and a site connected to it.',
      'Start with posts. Add forms, subscribers, or a shop for your books and courses later, in the same workspace.',
    ],
    items: [
      { title: 'A personal blog', body: 'Write and publish posts to your own site, with a preview before every one goes live.' },
      { title: 'A magazine with several writers', body: 'Writers submit for review, editors publish or send back with notes, and each content type has its own editors.' },
      { title: 'A newsletter list', body: 'Collect subscribers on your site or with a form link, and email the people who opted in.' },
      { title: 'A blog in more than one language', body: 'Each post has a version in each language, and shared fields stay in step across all of them.' },
    ],
    icons: [BookOpen, Users, Mail, Languages],
  },
  explainer: {
    title: 'What a content system should do, and how to start a blog on DUMA',
    intro: (
      <p>
        A content system should let you write once and publish anywhere: your site, in your design, in every language, with your images in storage you control. And
        it shouldn’t trap you — your writing should leave with you whenever you want.
      </p>
    ),
    setupTitle: 'How to start a blog on DUMA',
    steps: ANY_SETUP_STEPS,
    metricsTitle: 'What the content system includes',
    metrics: CMS_FEATURES,
    metricIcons: [Layers, Copy, Languages, ImageIcon, Zap, Code],
    comparisonTitle: 'A blog platform, a headless CMS,',
    comparisonHighlight: 'or DUMA',
    comparisonLead: 'Three ways to run a blog. Here is what each one covers.',
    comparison: ANY_COMPARISON,
    comparisonIcons: [Globe, Code],
  },
  setupBand: { title: 'Publish your first post on DUMA.', body: 'Sign up free, switch on Content, and we’ll help you connect your site.' },
  faqTitle: 'Questions writers ask',
  faqs: [
    { question: 'Do I need a developer?', answer: 'Once. DUMA’s content system is headless, so your site is connected to it with a delivery key. After that you write and publish in DUMA.' },
    { question: 'Can I email my readers?', answer: 'Yes. Subscribers from your sign-up forms become contacts in DUMA, and email reaches only the people who opted in.' },
    { question: 'Can several people write?', answer: 'Yes. Writers can submit a post for review, editors can publish it or send it back with requested changes, and you can limit who edits each content type.' },
    { question: 'Where are my images stored?', answer: 'In DUMA by default. You can connect your own Cloudflare R2 or Vercel Blob bucket instead, and move existing files across.' },
    { question: 'Can I take my writing with me?', answer: 'Yes. You can export everything in the content system as one JSON document at any time.' },
    { question: 'What does it cost?', answer: 'Nothing to start: the free plan has no time limit and no card. The content system has a free allowance, and the Business plan raises it when you need more.' },
  ],
  closing: { title: 'The one place for your writing.', muted: 'Start free. Take it with you any time.', body: 'Get started in minutes, completely free. No card required, and we’re here to help you every step of the way.' },
};

export const metadata = solutionMetadata(content);

export default function BlogsPage() {
  return <SolutionPage content={content} />;
}
