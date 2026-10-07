import type { CmsFieldDefinition } from '@/lib/api/cms.service';

// ---------------------------------------------------------------------------
// The SEO block: one group field a model can add in a click, and the rules
// for what a search result and a social card would show — including the
// fallbacks a site should use when a field is left empty.
// ---------------------------------------------------------------------------

export const SEO_FIELD_KEY = 'seo';

export const SEO_FIELD: CmsFieldDefinition = {
  key: SEO_FIELD_KEY,
  label: 'SEO & sharing',
  type: 'group',
  description: 'What search engines and social networks show. Leave blank to use the title and the start of the text.',
  fields: [
    {
      key: 'focusKeyword',
      label: 'Focus keyword',
      type: 'text',
      maxLength: 80,
      description: 'The phrase someone would search to find this page. Used to check the title and description — not published as a tag.',
    },
    {
      key: 'relatedKeywords',
      label: 'Related keywords',
      type: 'text',
      maxLength: 300,
      description: 'Comma separated. For writers and writing help; search engines ignore meta keywords, so sites should not output them.',
    },
    { key: 'metaTitle', label: 'Meta title', type: 'text', maxLength: 70 },
    { key: 'metaDescription', label: 'Meta description', type: 'longText', maxLength: 200 },
    {
      key: 'socialTitle',
      label: 'Social title',
      type: 'text',
      maxLength: 90,
      description: 'For shared links (og:title). Blank uses the meta title.',
    },
    {
      key: 'socialDescription',
      label: 'Social description',
      type: 'longText',
      maxLength: 200,
      description: 'A short, friendly line for shared links (og:description). Blank uses the meta description.',
    },
    { key: 'ogImage', label: 'Social image', type: 'media', mediaGroups: ['image'], description: '1200 × 630 works everywhere.' },
    {
      key: 'schemaType',
      label: 'Content type for search',
      type: 'select',
      options: ['WebPage', 'Article', 'BlogPosting', 'NewsArticle', 'Event', 'Product', 'Menu', 'Recipe', 'FAQPage', 'LocalBusiness'],
      description: 'Lets the site add structured data (JSON-LD) so search can show rich results.',
    },
    {
      key: 'canonicalUrl',
      label: 'Canonical URL',
      type: 'url',
      description: 'The page’s own full https address — or, for a copy, the original’s.',
    },
    { key: 'noIndex', label: 'Hide from search engines', type: 'boolean' },
    { key: 'noFollow', label: 'Don’t follow links on this page', type: 'boolean' },
  ],
};

/** schema.org types a café's site actually publishes; the site maps each to JSON-LD. */
export const SEO_SCHEMA_TYPES = SEO_FIELD.fields!.find((field) => field.key === 'schemaType')!.options as readonly string[];

/** Sub-fields the full SEO block has that this model's block lacks — what "Update SEO block" adds. */
export function missingSeoFields(fields: readonly CmsFieldDefinition[]): CmsFieldDefinition[] {
  const block = fields.find((field) => field.key === SEO_FIELD_KEY && field.type === 'group');
  if (!block) return [];
  const have = new Set((block.fields ?? []).map((field) => field.key));
  return (SEO_FIELD.fields ?? []).filter((field) => !have.has(field.key));
}

/**
 * The model's fields with its SEO block brought up to date: missing sub-fields
 * added in the standard order; what the model already had (and any change to
 * it) kept as it is, and its own extra sub-fields kept at the end.
 */
export function withFullSeoBlock(fields: readonly CmsFieldDefinition[]): CmsFieldDefinition[] {
  return fields.map((field) => {
    if (field.key !== SEO_FIELD_KEY || field.type !== 'group') return field;
    const own = new Map((field.fields ?? []).map((sub) => [sub.key, sub]));
    const standard = (SEO_FIELD.fields ?? []).map((sub) => own.get(sub.key) ?? sub);
    const extras = (field.fields ?? []).filter((sub) => !(SEO_FIELD.fields ?? []).some((std) => std.key === sub.key));
    return { ...field, fields: [...standard, ...extras] };
  });
}

export const hasSeoBlock = (fields: readonly CmsFieldDefinition[]) =>
  fields.some((field) => field.key === SEO_FIELD_KEY && field.type === 'group');

/** Where Google cuts a title and a description on a desktop result, in characters (approximate). */
export const SERP_TITLE_MAX = 60;
export const SERP_DESCRIPTION_MAX = 160;
export const SERP_DESCRIPTION_MIN = 70;

/** Markdown to the plain text a description would show: no syntax, links as their words, one line. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi, '')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cut at a word boundary with an ellipsis, as a result page does. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const blockHas = (fields: readonly CmsFieldDefinition[], key: string) =>
  fields.some((field) => field.key === SEO_FIELD_KEY && (field.fields ?? []).some((sub) => sub.key === key));

export interface SeoSnapshot {
  title: string;
  titleFromFallback: boolean;
  description: string;
  descriptionFromFallback: boolean;
  imageId: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  noFollow: boolean;
  focusKeyword: string;
  relatedKeywords: string[];
  /** For shared links: the SEO block's social values, else the search ones. */
  socialTitle: string;
  socialDescription: string;
  schemaType: string;
  /** Whether this model's block has the field — checks only ask for what can be filled. */
  supports: { focusKeyword: boolean; schemaType: boolean; socialDescription: boolean };
  warnings: string[];
}

/**
 * What a search result would show for this entry: the SEO block's values,
 * else the entry's title and the opening of its first long text — and what is
 * worth fixing (too long, too short, missing).
 */
export function seoSnapshot(fields: readonly CmsFieldDefinition[], titleField: string | null, data: Record<string, unknown>): SeoSnapshot {
  const seo = (data[SEO_FIELD_KEY] && typeof data[SEO_FIELD_KEY] === 'object' ? data[SEO_FIELD_KEY] : {}) as Record<string, unknown>;
  const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

  const ownTitle = str(seo.metaTitle);
  const fallbackTitle = titleField ? str(data[titleField]) : '';
  const ownDescription = str(seo.metaDescription);
  const textField = fields.find((field) => (field.type === 'richText' || field.type === 'longText') && str(data[field.key]));
  const fallbackDescription = textField ? truncate(plainText(str(data[textField.key])), SERP_DESCRIPTION_MAX) : '';
  const firstImage = fields.find((field) => field.type === 'media' && field.key !== SEO_FIELD_KEY && data[field.key]);
  const imageValue = seo.ogImage ?? (firstImage ? data[firstImage.key] : null);
  const imageId = Array.isArray(imageValue)
    ? ((imageValue[0] as string | undefined) ?? null)
    : typeof imageValue === 'string'
      ? imageValue
      : null;

  const title = ownTitle || fallbackTitle;
  const description = ownDescription || fallbackDescription;
  const warnings: string[] = [];
  if (!title) warnings.push('No title — add a meta title or fill in the entry’s title.');
  else if (title.length > SERP_TITLE_MAX)
    warnings.push(`The title is ${title.length} characters; results cut it after about ${SERP_TITLE_MAX}.`);
  if (!description) warnings.push('No description — search engines will pick text from the page themselves.');
  else if (ownDescription && ownDescription.length > SERP_DESCRIPTION_MAX)
    warnings.push(`The description is ${ownDescription.length} characters; results cut it after about ${SERP_DESCRIPTION_MAX}.`);
  else if (ownDescription && ownDescription.length < SERP_DESCRIPTION_MIN)
    warnings.push('The description is short — aim for one or two full sentences.');
  if (!imageId) warnings.push('No image — shared links will show without a picture.');

  return {
    title,
    titleFromFallback: !ownTitle && Boolean(fallbackTitle),
    description,
    descriptionFromFallback: !ownDescription && Boolean(fallbackDescription),
    imageId,
    canonicalUrl: str(seo.canonicalUrl) || null,
    noIndex: seo.noIndex === true,
    noFollow: seo.noFollow === true,
    focusKeyword: str(seo.focusKeyword),
    relatedKeywords: str(seo.relatedKeywords)
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean),
    socialTitle: str(seo.socialTitle) || title,
    socialDescription: str(seo.socialDescription) || description,
    schemaType: str(seo.schemaType),
    supports: {
      focusKeyword: blockHas(fields, 'focusKeyword'),
      schemaType: blockHas(fields, 'schemaType'),
      socialDescription: blockHas(fields, 'socialDescription'),
    },
    warnings,
  };
}

// ─── Best-practice checks ────────────────────────────────────────────────────

export const TITLE_MIN = 30;
export const DESCRIPTION_IDEAL_MAX = 155;
export const DESCRIPTION_IDEAL_MIN = 120;

export interface SeoCheck {
  id:
    | 'focus-keyword'
    | 'title-length'
    | 'title-keyword'
    | 'description-length'
    | 'description-keyword'
    | 'description-sentence'
    | 'social-description'
    | 'image'
    | 'image-alt'
    | 'structured-data'
    | 'canonical'
    | 'indexable';
  label: string;
  ok: boolean;
  /** What to do about it, when not ok. */
  fix?: string;
}

const mentions = (text: string, keyword: string) => Boolean(keyword) && text.toLowerCase().includes(keyword.toLowerCase());

/**
 * What a page should get right for search and sharing (Google's published
 * guidance and common practice): a title that fits a result and names the
 * subject, a description of one or two complete sentences that fits, a
 * social image with alt text, an absolute canonical, and not hidden by
 * mistake. The keyword checks run only when a focus keyword is known.
 */
export function seoChecklist(snapshot: SeoSnapshot, options: { keyword?: string; imageAlt?: string | null } = {}): SeoCheck[] {
  const keyword = (options.keyword?.trim() || snapshot.focusKeyword || '').trim();
  const title = snapshot.title;
  const description = snapshot.description;
  const checks: SeoCheck[] = [
    {
      id: 'title-length',
      label: `Title is ${TITLE_MIN}–${SERP_TITLE_MAX} characters`,
      ok: title.length >= TITLE_MIN && title.length <= SERP_TITLE_MAX,
      fix: !title
        ? 'Add a title.'
        : title.length < TITLE_MIN
          ? 'Make the title more descriptive.'
          : 'Shorten the title so results don’t cut it.',
    },
    {
      id: 'description-length',
      label: `Description is ${DESCRIPTION_IDEAL_MIN}–${DESCRIPTION_IDEAL_MAX} characters`,
      ok: description.length >= DESCRIPTION_IDEAL_MIN && description.length <= DESCRIPTION_IDEAL_MAX,
      fix: !description
        ? 'Add a description.'
        : description.length < DESCRIPTION_IDEAL_MIN
          ? 'Say a little more — one or two full sentences.'
          : 'Shorten it so results don’t cut it.',
    },
    {
      id: 'description-sentence',
      label: 'Description ends as a full sentence',
      ok: /[.!?]["”’)]?$/.test(description.trim()),
      fix: 'End the description with a full stop rather than mid-thought.',
    },
    { id: 'image', label: 'Has a social image', ok: Boolean(snapshot.imageId), fix: 'Pick an image so shared links show a picture.' },
  ];
  if (snapshot.supports?.focusKeyword) {
    checks.unshift({
      id: 'focus-keyword',
      label: 'Has a focus keyword',
      ok: Boolean(keyword),
      fix: 'Set the phrase people search for — the other checks use it.',
    });
  }
  if (snapshot.supports?.socialDescription && snapshot.socialDescription !== description) {
    checks.push({
      id: 'social-description',
      label: 'Social description is under 200 characters',
      ok: snapshot.socialDescription.length > 0 && snapshot.socialDescription.length <= 200,
      fix: 'Keep the social description to a line or two.',
    });
  }
  if (snapshot.supports?.schemaType) {
    checks.push({
      id: 'structured-data',
      label: 'Has a content type for search',
      ok: Boolean(snapshot.schemaType),
      fix: 'Pick what this page is (Article, Event, Menu…) so the site can add rich results.',
    });
  }
  if (snapshot.imageId) {
    checks.push({
      id: 'image-alt',
      label: 'Social image has alt text',
      ok: Boolean(options.imageAlt?.trim()),
      fix: 'Add alt text to the image in Media.',
    });
  }
  if (keyword) {
    checks.splice(1, 0, {
      id: 'title-keyword',
      label: `Title mentions “${keyword}”`,
      ok: mentions(title, keyword),
      fix: 'Work the main topic into the title.',
    });
    checks.splice(3, 0, {
      id: 'description-keyword',
      label: `Description mentions “${keyword}”`,
      ok: mentions(description, keyword),
      fix: 'Mention the main topic in the description.',
    });
  }
  if (snapshot.canonicalUrl) {
    checks.push({
      id: 'canonical',
      label: 'Canonical URL is a full https address',
      ok: /^https:\/\/[^\s]+$/i.test(snapshot.canonicalUrl),
      fix: 'Use the full https:// address of the page.',
    });
  }
  checks.push({
    id: 'indexable',
    label: 'Visible to search engines',
    ok: !snapshot.noIndex,
    fix: '“Hide from search engines” is on — turn it off unless that’s intended.',
  });
  return checks.map((check) => (check.ok ? { ...check, fix: undefined } : check));
}

/** A title that fits a result: whole words, no trailing separator, never cut mid-word. */
export function fitTitle(value: string, max = SERP_TITLE_MAX): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : text.slice(0, max)).replace(/[\s\-–—|:,]+$/, '');
}

/**
 * A description that fits: the longest run of whole sentences within the
 * limit; failing that, whole words ending in a full stop.
 */
export function fitDescription(value: string, max = DESCRIPTION_IDEAL_MAX): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const sentences = text.match(/[^.!?]+[.!?]+["”’)]?\s*/g) ?? [];
  let fitted = '';
  for (const sentence of sentences) {
    if ((fitted + sentence).trim().length > max) break;
    fitted += sentence;
  }
  if (fitted.trim().length >= DESCRIPTION_IDEAL_MIN * 0.6) return fitted.trim();
  const words = fitTitle(text, max - 1).replace(/[,;:\s]+$/, '');
  return `${words}.`;
}
