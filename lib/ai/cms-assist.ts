// ---------------------------------------------------------------------------
// Writing help for Content: alt text from an image, a meta description, a
// summary, a translation. Prompts and output clean-up live here, pure and
// tested; the provider call is lib/ai/cms-assist.server.ts. Every result is a
// suggestion the editor accepts or ignores — nothing is saved or published.
// ---------------------------------------------------------------------------

export const ASSIST_TASKS = ['alt-text', 'meta-description', 'summary', 'translate', 'seo', 'model'] as const;
export type AssistTask = (typeof ASSIST_TASKS)[number];

type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export interface AssistMessage {
  role: 'system' | 'user';
  content: string | Part[];
}

const SYSTEM =
  'You write web copy for a café business. Plain, specific, British English unless asked otherwise. ' +
  'Never invent facts, prices, dates or claims that are not in the material given. Reply with the requested text only — no preamble, no quotes, no Markdown fences.';

/** Long inputs are cut, not refused: the opening of a post carries what a description needs. */
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

export function assistMessages(
  task: AssistTask,
  input: {
    title?: string;
    text?: string;
    imageDataUrl?: string;
    fields?: Record<string, string>;
    from?: string;
    to?: string;
    kind?: string;
    site?: string;
  },
): AssistMessage[] {
  if (task === 'seo') {
    return [
      {
        role: 'system',
        content:
          `${SYSTEM} You write search and social metadata following Google's guidance: titles name the page's subject specifically and fit a result; ` +
          'descriptions are one or two complete sentences that summarise the page and give a reason to click; no keyword stuffing, no clickbait, no ALL CAPS, no emoji.',
      },
      {
        role: 'user',
        content:
          'Return a JSON object with exactly these keys and nothing else:\n' +
          '- "focusKeyword": the 1–4 word phrase someone would search to find this page\n' +
          '- "relatedKeywords": 3–5 other phrases people search for this, as an array of strings\n' +
          '- "metaTitle": 30–60 characters, includes the focus keyword near the start' +
          (input.site ? `, may end with " | ${clip(input.site, 30)}" if it fits` : '') +
          '\n- "metaDescription": 120–155 characters, one or two complete sentences, includes the focus keyword, ends with a full stop\n' +
          '- "socialTitle": up to 70 characters, friendlier than the meta title, for a shared link\n' +
          '- "socialDescription": up to 150 characters, one warm sentence that makes someone tap the shared link\n' +
          `- "schemaType": the best fit from ${['WebPage', 'Article', 'BlogPosting', 'NewsArticle', 'Event', 'Product', 'Menu', 'Recipe', 'FAQPage', 'LocalBusiness'].join(', ')}\n\n` +
          (input.kind ? `Page type: ${clip(input.kind, 60)}\n` : '') +
          `Current title: "${clip(input.title ?? '', 150)}"\n\nPage text:\n${clip(input.text ?? '', 6000)}`,
      },
    ];
  }
  if (task === 'alt-text') {
    return [
      { role: 'system', content: `${SYSTEM} You describe images for screen readers.` },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Write alt text for this image: one sentence, under 125 characters, describing what matters to someone who cannot see it. ' +
              'Do not start with "Image of" or "Picture of".' +
              (input.title ? ` It appears with: "${clip(input.title, 120)}".` : ''),
          },
          { type: 'image_url', image_url: { url: input.imageDataUrl ?? '' } },
        ],
      },
    ];
  }
  if (task === 'meta-description') {
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `Write a search-result description for this page: one or two sentences, 120–155 characters, that make a reader want to click. Title: "${clip(input.title ?? '', 150)}".\n\nPage text:\n${clip(input.text ?? '', 6000)}`,
      },
    ];
  }
  if (task === 'summary') {
    return [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Summarise this in two or three sentences for a listing page.\n\n${clip(input.text ?? '', 8000)}` },
    ];
  }
  return [
    {
      role: 'system',
      content: `${SYSTEM} You translate. Keep Markdown, links, image syntax, URLs, product names and placeholders exactly as they are.`,
    },
    {
      role: 'user',
      content:
        `Translate each value of this JSON object from ${input.from ?? 'the source language'} to ${input.to}. ` +
        'Return a JSON object with exactly the same keys and nothing else.\n\n' +
        JSON.stringify(input.fields ?? {}),
    },
  ];
}

/** A model's reply as the editor wants it: unquoted, unfenced, one line where one is expected. */
export function cleanAssistText(task: Exclude<AssistTask, 'translate'>, raw: string): string {
  let text = raw
    .trim()
    .replace(/^```[a-z]*\n?|```$/g, '')
    .trim();
  text = text
    .replace(/^(alt text|description|summary)\s*:\s*/i, '')
    .replace(/^["“']([\s\S]*)["”']$/, '$1')
    .trim();
  if (task !== 'summary') text = text.replace(/\s+/g, ' ');
  if (task === 'alt-text')
    text = text
      .replace(/^(an? )?(image|picture|photo) of /i, (match) => (/^an? /i.test(match) ? '' : ''))
      .replace(/^./, (c) => c.toUpperCase());
  return text;
}

/** The translated object, keeping only the keys asked for and only string values. */
export function parseTranslation(raw: string, keys: readonly string[]): Record<string, string> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const key of keys) if (typeof parsed[key] === 'string') out[key] = parsed[key] as string;
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** The SEO task's JSON reply, cleaned and fitted to the limits; null when unreadable. */
export interface SeoSuggestion {
  focusKeyword: string;
  relatedKeywords: string[];
  metaTitle: string;
  metaDescription: string;
  socialTitle: string;
  socialDescription: string;
  schemaType: string;
}

/** The SEO task's JSON reply, cleaned; null when the title or description is missing. */
export function parseSeoSuggestion(raw: string, schemaTypes: readonly string[] = []): SeoSuggestion | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const text = (value: unknown) =>
      typeof value === 'string'
        ? value
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^["“'](.*)["”']$/, '$1')
            .trim()
        : '';
    const metaTitle = text(parsed.metaTitle);
    const metaDescription = text(parsed.metaDescription);
    if (!metaTitle || !metaDescription) return null;
    const related = Array.isArray(parsed.relatedKeywords) ? parsed.relatedKeywords : text(parsed.relatedKeywords).split(',');
    const schemaType = text(parsed.schemaType);
    return {
      focusKeyword: text(parsed.focusKeyword).toLowerCase(),
      relatedKeywords: related
        .map((keyword) => text(keyword).toLowerCase())
        .filter(Boolean)
        .slice(0, 5),
      metaTitle,
      metaDescription,
      socialTitle: text(parsed.socialTitle),
      socialDescription: text(parsed.socialDescription),
      // Only a type the block offers; anything else is dropped, not guessed at.
      schemaType: schemaTypes.length === 0 || schemaTypes.includes(schemaType) ? schemaType : '',
    };
  } catch {
    return null;
  }
}

/** The field palette as the model is told it: type, then what it is for. */
export const MODEL_FIELD_GUIDE = [
  'text — one line: titles, names',
  'longText — plain paragraphs',
  'richText — formatted body text (Markdown)',
  'slug — URL id made from the title (at most one, top level)',
  'email, url — an address',
  'number — with optional min, max, integer',
  'boolean — yes / no',
  'date, dateTime — a day, or a moment',
  'select — one or several (multiple) from "options"',
  'color, location — a colour, a map point',
  'media — images, video, documents (mediaGroups: image, video, audio, document; multiple for a gallery)',
  'reference — link to entries of another model (referenceTypes: model keys; multiple for several)',
  'group — nested "fields" (multiple to repeat, e.g. FAQ items); no groups or slugs inside',
];

/**
 * Describe-a-model: from what the person wants to a content model, built only
 * from the CMS's own field types and the models that already exist. The reply
 * is cleaned by normaliseModelDraft before the editor sees it.
 */
export function modelMessages(input: {
  prompt: string;
  existingFields: Array<{ label: string; type: string }>;
  models: Array<{ key: string; name: string }>;
  name?: string;
}): AssistMessage[] {
  const adding = input.existingFields.length > 0;
  return [
    {
      role: 'system',
      content:
        'You design content models for a café business’s website CMS. Use only these field types:\n' +
        MODEL_FIELD_GUIDE.map((line) => `- ${line}`).join('\n') +
        '\nEvery entry already has these built in — never add a field for them: draft/published status; scheduled publish and unpublish dates; ' +
        'created and updated times and who made them; language versions; version history; and, when "seo" is true, the SEO & sharing block ' +
        '(meta title and description, keywords, social title, description and image, canonical URL, no-index). ' +
        'A date field is only for something the content itself is about — an event’s start, an offer’s last day — never for when the entry goes live. ' +
        'Never repeat a field, and never add one the model already has.' +
        '\nPrefer few, clearly named fields over many. Labels are short and in plain English. Mark required only what every entry must have. ' +
        'Reply with JSON only — no prose, no Markdown fences.',
    },
    {
      role: 'user',
      content:
        `What they want: ${clip(input.prompt, 1500)}\n\n` +
        (input.models.length > 0
          ? `Existing models a reference can point to (key — name): ${input.models.map((model) => `${model.key} — ${model.name}`).join('; ')}\n`
          : 'There are no other models to reference.\n') +
        (adding
          ? `This model (“${clip(input.name ?? '', 80)}”) already has: ${input.existingFields.map((field) => `${field.label} (${field.type})`).join(', ')}. ` +
            'First decide "related": true if what they want belongs in this model (more detail for the same kind of content) — then suggest only fields it is missing; ' +
            'false if it is a different kind of content (team members on a blog post model) — then give the complete field set for that content, as for a new model, with its own "name".\n'
          : '') +
        '\nReturn: {"name": string, "description": one sentence for the people writing entries, "kind": "collection" or "singleton", ' +
        '"titleField": the label of the field entries are named by, "seo": true if each entry is a page on the site, ' +
        (adding ? '"related": true or false, ' : '') +
        '"fields": [{"label", "type", "required"?, "multiple"?, "options"?, "mediaGroups"?, "referenceTypes"?, "min"?, "max"?, "integer"?, "maxLength"?, "description"?, "fields"?}]}',
    },
  ];
}

/** The model JSON from a reply that may carry prose or fences around it. */
export function parseModelReply(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}
