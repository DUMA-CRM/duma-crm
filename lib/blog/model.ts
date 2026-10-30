// Relative, with .ts: scripts/create-blog-model.mts imports this file under plain Node.
import { SEO_FIELD } from '../utils/cms-seo.ts';

import type { CmsFieldDefinition } from '@/lib/api/cms.service';

/**
 * The blog's content model in DUMA's own CMS — the marketing site reads posts
 * from the internal workspace through the public blog API. Admin → Content
 * creates this model; the setup script remains available for manual use.
 */

export const BLOG_TYPE_KEY = 'blog-post';

/** Legacy cache tag retained for signed CMS webhook integrations; blog reads now bypass caching. */
export const BLOG_TAG = 'blog';

/**
 * Categories, as the editor picks them — shown as a label on cards and posts
 * (there are no category pages). Add one here and the model's options follow.
 */
export const BLOG_CATEGORIES = [
  { label: 'Guides' },
  { label: 'Cafés and restaurants' },
  { label: 'Retail and online stores' },
  { label: 'Pricing and comparisons' },
  { label: 'DUMA news' },
] as const;

export type BlogCategoryLabel = (typeof BLOG_CATEGORIES)[number]['label'];

/** The person behind every post, for the byline on the post page and its structured data. */
export const BLOG_AUTHOR = { name: 'Marian Dudych', jobTitle: 'Founder of DUMA', path: '/about', photo: '/marketing/team/marian.jpg' } as const;

export const BLOG_MODEL: { key: string; name: string; description: string; kind: 'collection'; titleField: string; fields: CmsFieldDefinition[] } = {
  key: BLOG_TYPE_KEY,
  name: 'Blog post',
  description: 'Posts for the DUMA blog at duma-business.com/blog.',
  kind: 'collection',
  titleField: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 120, description: 'The headline on the page. Aim for under 60 characters so search shows it whole.' },
    { key: 'slug', label: 'Slug', type: 'slug', required: true, unique: true, slugSource: 'title', description: 'The address: duma-business.com/blog/your-slug. Don’t change it once published.' },
    {
      key: 'excerpt',
      label: 'Excerpt',
      type: 'longText',
      required: true,
      maxLength: 300,
      description: 'One or two sentences for the blog cards — and the search description when SEO is left blank. 140–160 characters is ideal.',
    },
    { key: 'category', label: 'Category', type: 'select', required: true, options: BLOG_CATEGORIES.map((c) => c.label) },
    { key: 'cover', label: 'Cover image', type: 'media', mediaGroups: ['image'], description: '1600 × 900 or larger. Always fill in its alt text.' },
    {
      key: 'tldr',
      label: 'TL;DR',
      type: 'longText',
      maxLength: 800,
      description: 'The answer in a few sentences, shown above the post. Search and AI assistants quote it first, so state the facts plainly.',
    },
    { key: 'body', label: 'Body', type: 'richText', required: true, description: 'Use ## and ### headings — they build the table of contents.' },
    {
      key: 'faq',
      label: 'Questions',
      type: 'group',
      multiple: true,
      description: 'Questions readers search for, answered in full. Shown at the end of the post and as FAQ structured data.',
      fields: [
        { key: 'question', label: 'Question', type: 'text', required: true, maxLength: 200 },
        { key: 'answer', label: 'Answer', type: 'longText', required: true, maxLength: 1500 },
      ],
    },
    SEO_FIELD,
  ],
};
