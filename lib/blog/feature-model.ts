// Relative, with .ts, like lib/blog/model.ts, so a setup script can import it under plain Node.
import { SEO_FIELD } from '../utils/cms-seo.ts';

import type { CmsFieldDefinition } from '@/lib/api/cms.service';

/**
 * The model for /features/[slug] pages in DUMA's own CMS. Like blog posts,
 * they are written in the internal workspace (Admin → Content) and read
 * through the public blog API, which serves exactly this type and blog-post.
 * A page renders with the blog post layout; its slug must be a module's slug
 * (lib/marketing/site.ts MODULES), or the route answers 404.
 */

export const FEATURE_TYPE_KEY = 'feature-page';

export const FEATURE_MODEL: { key: string; name: string; description: string; kind: 'collection'; titleField: string; fields: CmsFieldDefinition[] } = {
  key: FEATURE_TYPE_KEY,
  name: 'Feature page',
  description: 'One page per part of DUMA, at duma-business.com/features/{slug}.',
  kind: 'collection',
  titleField: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 120, description: 'The headline on the page, e.g. “An EPOS till that keeps selling offline”.' },
    {
      key: 'slug',
      label: 'Slug',
      type: 'slug',
      required: true,
      unique: true,
      description: 'The part of DUMA this page is about, exactly as it is named in the product: pos, products-catalog, staff-scheduling, inventory… Any other slug is not shown.',
    },
    {
      key: 'excerpt',
      label: 'Summary',
      type: 'longText',
      required: true,
      maxLength: 300,
      description: 'One or two sentences — the search description when SEO is left blank. 140–160 characters is ideal.',
    },
    { key: 'cover', label: 'Screenshot', type: 'media', mediaGroups: ['image'], description: 'The product screen this page is about, 1600 × 900 or larger. Always fill in its alt text.' },
    {
      key: 'tldr',
      label: 'TL;DR',
      type: 'longText',
      maxLength: 800,
      description: 'What this part does, in a few sentences, shown above the page. Search and AI assistants quote it first.',
    },
    { key: 'body', label: 'Body', type: 'richText', required: true, description: 'Use ## and ### headings — they build the table of contents.' },
    {
      key: 'faq',
      label: 'Questions',
      type: 'group',
      multiple: true,
      description: 'Questions people ask about this part, answered in full. Shown at the end and as FAQ structured data.',
      fields: [
        { key: 'question', label: 'Question', type: 'text', required: true, maxLength: 200 },
        { key: 'answer', label: 'Answer', type: 'longText', required: true, maxLength: 1500 },
      ],
    },
    SEO_FIELD,
  ],
};
