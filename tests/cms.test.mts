import assert from 'node:assert/strict';
import test from 'node:test';

const {
  cleanEntryData,
  entryStatusMeta,
  fieldKeyFromLabel,
  fieldListProblems,
  formatBytes,
  issuesByField,
  moveItem,
  newField,
  previewUrlFor,
  sameEntryData,
  slugify,
  typeKeyFromName,
  uniqueKey,
} = await import('../lib/utils/cms.ts');

test('field keys come from labels as camelCase', () => {
  assert.equal(fieldKeyFromLabel('Hero image'), 'heroImage');
  assert.equal(fieldKeyFromLabel('  Café menu – PDF '), 'cafeMenuPdf');
  assert.equal(fieldKeyFromLabel('2 for 1'), 'field2For1');
  assert.equal(fieldKeyFromLabel('!!!'), '');
});

test('type keys and slugs are URL-safe', () => {
  assert.equal(typeKeyFromName('Blog post'), 'blog-post');
  assert.equal(typeKeyFromName('2026 offers'), 'type-2026-offers');
  assert.equal(slugify('Fish & Chips — Friday!'), 'fish-and-chips-friday');
});

test('new fields get unique keys and sensible defaults', () => {
  assert.equal(uniqueKey('title', ['title', 'title2']), 'title3');
  const siblings = [{ key: 'title', label: 'Title', type: 'text' as const }];
  const slug = newField('slug', 'Slug', siblings);
  assert.deepEqual([slug.slugSource, slug.required, slug.unique], ['title', true, true]);
  assert.deepEqual(newField('select', 'Size', []).options, ['Option 1']);
  assert.equal(newField('text', 'Title', siblings).key, 'title2');
});

test('moveItem reorders without mutating, and ignores impossible moves', () => {
  const list = ['a', 'b', 'c'];
  assert.deepEqual(moveItem(list, 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(moveItem(list, 0, 9), ['a', 'b', 'c']);
  assert.deepEqual(list, ['a', 'b', 'c']);
});

test('model problems are found before the API is asked', () => {
  const problems = fieldListProblems([
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'title', label: 'Again', type: 'text' },
    { key: 'size', label: 'Size', type: 'select', options: [] },
    { key: 'bad key', label: 'Bad', type: 'text' },
    { key: 'faq', label: 'FAQ', type: 'group', fields: [{ key: 'q', label: 'Q', type: 'select' }] },
  ]);
  assert.ok(problems.some((problem) => problem.includes('share the key')));
  assert.ok(problems.some((problem) => problem.includes('Size') && problem.includes('choice')));
  assert.ok(problems.some((problem) => problem.includes('Bad')));
  assert.ok(problems.some((problem) => problem.startsWith('FAQ →')));
});

test('editor blanks are not saved, numbers are numbers, groups are cleaned', () => {
  const fields = [
    { key: 'title', label: 'T', type: 'text' as const },
    { key: 'price', label: 'P', type: 'number' as const },
    { key: 'tags', label: 'Tags', type: 'select' as const, multiple: true, options: ['a'] },
    { key: 'seo', label: 'SEO', type: 'group' as const, fields: [{ key: 'meta', label: 'M', type: 'text' as const }] },
  ];
  assert.deepEqual(cleanEntryData(fields, { title: 'Hi', price: '3.50', tags: [], seo: { meta: '' }, stray: 1 }), {
    title: 'Hi',
    price: 3.5,
  });
  assert.equal(sameEntryData(fields, { title: 'Hi', tags: [] }, { title: 'Hi' }), true);
  assert.equal(sameEntryData(fields, { title: 'Hi' }, { title: 'Ho' }), false);
});

test('status meta explains each state', () => {
  assert.equal(entryStatusMeta('changed').variant, 'warning');
  assert.equal(entryStatusMeta('draft').label, 'Draft');
});

test('preview URLs expand placeholders and refuse a missing slug', () => {
  const entry = { slug: 'oat-latte', documentId: 'doc-1', locale: 'en-GB', id: 'e1' };
  assert.equal(previewUrlFor('https://cafe.example/menu/{slug}?l={locale}', entry), 'https://cafe.example/menu/oat-latte?l=en-GB');
  assert.equal(previewUrlFor('https://cafe.example/menu/{slug}', { ...entry, slug: null }), null);
  assert.equal(previewUrlFor(null, entry), null);
});

test('API issues group under their top-level field', () => {
  const grouped = issuesByField([
    { field: 'title', message: 'Required' },
    { field: 'faq[1].q', message: 'Required' },
  ]);
  assert.deepEqual(grouped.get('title'), ['Required']);
  assert.deepEqual(grouped.get('faq'), ['[1].q: Required']);
});

test('formatBytes', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(25 * 1024 * 1024), '25 MB');
});

const { fallbackChain, localeDisplayName } = await import('../lib/utils/cms.ts');

test('fallback chain follows fallbacks to the default and survives cycles', () => {
  const locales = [
    { code: 'en', isDefault: true, fallbackCode: null },
    { code: 'fr', isDefault: false, fallbackCode: null },
    { code: 'fr-CA', isDefault: false, fallbackCode: 'fr' },
    { code: 'a', isDefault: false, fallbackCode: 'b' },
    { code: 'b', isDefault: false, fallbackCode: 'a' },
  ];
  assert.deepEqual(fallbackChain('fr-CA', locales), ['fr-CA', 'fr', 'en']);
  assert.deepEqual(fallbackChain('en', locales), ['en']);
  assert.deepEqual(fallbackChain('a', locales), ['a', 'b', 'en']);
});

test('locale names come from the platform, and junk gets none', () => {
  assert.equal(localeDisplayName('fr'), 'French');
  assert.equal(localeDisplayName('fr-CA'), 'Canadian French');
  assert.equal(localeDisplayName('EN_gb'), '');
  assert.equal(localeDisplayName(''), '');
});

const { buildAiPrompt, exampleEntry, pascalCase, typeScriptTypes } = await import('../lib/utils/cms-docs.ts');

const docsTypes = [
  {
    key: 'blog-post',
    name: 'Blog post',
    kind: 'collection' as const,
    description: null,
    fields: [
      { key: 'title', label: 'Title', type: 'text' as const, required: true },
      { key: 'slug', label: 'Slug', type: 'slug' as const, required: true },
      { key: 'tags', label: 'Tags', type: 'select' as const, multiple: true, options: ['news', 'menu'] },
      { key: 'author', label: 'Author', type: 'reference' as const, referenceTypes: ['author'] },
      { key: 'hero', label: 'Hero', type: 'media' as const },
      { key: 'margin', label: 'Margin', type: 'number' as const, private: true },
      {
        key: 'faq',
        label: 'FAQ',
        type: 'group' as const,
        multiple: true,
        fields: [{ key: 'q', label: 'Q', type: 'text' as const, required: true }],
      },
    ],
  },
];

test('generated TypeScript follows the model and hides private fields', () => {
  const ts = typeScriptTypes(docsTypes);
  assert.equal(pascalCase('blog-post'), 'BlogPost');
  assert.match(ts, /export interface BlogPostFields \{/);
  assert.match(ts, /title: string;/);
  assert.match(ts, /tags\?: Array<"news" \| "menu">;/);
  assert.match(ts, /author\?: DumaLink<AuthorFields>;/);
  assert.match(ts, /hero\?: DumaAsset;/);
  assert.match(ts, /faq\?: \{\n\s+q: string;\n\s+\}\[\];/);
  assert.doesNotMatch(ts, /margin/);
});

test('example entries omit private fields', () => {
  const entry = exampleEntry(docsTypes[0]!) as { fields: Record<string, unknown>; slug: string };
  assert.equal(entry.slug, 'example-slug');
  assert.equal('margin' in entry.fields, false);
  assert.deepEqual(entry.fields.tags, ['news']);
});

test('the AI prompt is complete, specific to the workspace, and holds no key', () => {
  const prompt = buildAiPrompt({
    apiOrigin: 'https://api.example.com/',
    types: docsTypes,
    locales: [
      { code: 'en', name: 'English', isDefault: true, fallbackCode: null },
      { code: 'fr', name: 'French', isDefault: false, fallbackCode: null },
    ],
  });
  assert.match(prompt, /Base URL: https:\/\/api\.example\.com\/v1\/cms\/delivery/);
  assert.match(prompt, /Blog post — key `blog-post`, collection \(GET \/entries\/blog-post\)/);
  assert.match(prompt, /tags: select one of "news", "menu" \(list\)/);
  assert.match(prompt, /X-Duma-Signature/);
  assert.match(prompt, /fr \(French\)/);
  assert.doesNotMatch(prompt, /margin/);
  assert.doesNotMatch(prompt, /dcms_(live|prev)_[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(prompt, /dk_(pub|sec)_[A-Za-z0-9_-]{20,}/);
  // One workspace key for every API, created in one place.
  assert.match(prompt, /DUMA_PUBLISHABLE_KEY=dk_pub_…/);
  assert.match(prompt, /Settings → Developers/);
  assert.doesNotMatch(prompt, /API & webhooks/);
});

const { isoToLocalParts, localPartsToIso } = await import('../lib/utils/cms.ts');

test('date and time parts round-trip through an ISO instant in local time', () => {
  const iso = localPartsToIso('2026-10-06', '14:30');
  assert.ok(iso);
  assert.deepEqual(isoToLocalParts(iso), { date: '2026-10-06', time: '14:30' });
  assert.deepEqual(isoToLocalParts(localPartsToIso('2026-10-06', '')), { date: '2026-10-06', time: '09:00' });
  assert.equal(localPartsToIso('', '10:00'), null);
  assert.deepEqual(isoToLocalParts(null), { date: '', time: '' });
});

test('a scheduled publish time is wall-clock time at the business, not on the device', () => {
  // Scheduling 09:00 from anywhere means 09:00 in Kyiv for a Kyiv workspace.
  assert.equal(localPartsToIso('2026-10-06', '09:00', 'Europe/Kyiv'), '2026-10-06T06:00:00.000Z');
  assert.deepEqual(isoToLocalParts('2026-10-06T06:00:00.000Z', 'Europe/Kyiv'), { date: '2026-10-06', time: '09:00' });
});

const { safeHref, safeImageSrc } = await import('../lib/utils/cms.ts');

test('preview links and images refuse script and data URLs', () => {
  assert.equal(safeHref('https://duma.example/a'), 'https://duma.example/a');
  assert.equal(safeHref('mailto:hi@example.com'), 'mailto:hi@example.com');
  assert.equal(safeHref('/menu#coffee'), '/menu#coffee');
  assert.equal(safeHref('#top'), '#top');
  assert.equal(safeHref('javascript:alert(1)'), null);
  assert.equal(safeHref(' JavaScript:alert(1)'), null);
  assert.equal(safeHref('data:text/html,<b>x</b>'), null);
  assert.equal(safeHref('//evil.example'), null);
  assert.equal(safeImageSrc('https://cdn.example/a.png'), 'https://cdn.example/a.png');
  assert.equal(safeImageSrc('data:image/png;base64,AAAA'), null);
  assert.equal(safeImageSrc('javascript:alert(1)'), null);
});

const { cmsAttention } = await import('../lib/utils/cms.ts');

test('the overview attention list is worst first and respects who can act', () => {
  const overview = { entries: { live: 3, changed: 2, draft: 1, scheduled: 1 }, activeApiKeys: 0 };
  assert.deepEqual(
    cmsAttention(overview, { canManageKeys: true }).map((item) => item.kind),
    ['no_api_key', 'unpublished_changes', 'never_published', 'scheduled'],
  );
  assert.equal(
    cmsAttention(overview, { canManageKeys: false }).some((item) => item.kind === 'no_api_key'),
    false,
  );
  assert.equal(
    cmsAttention({ ...overview, entries: { ...overview.entries, live: 0 } }, { canManageKeys: true }).some(
      (item) => item.kind === 'no_api_key',
    ),
    false,
    'no key needed before anything is live',
  );
  assert.deepEqual(
    cmsAttention({ entries: { live: 1, changed: 0, draft: 0, scheduled: 0 }, activeApiKeys: 1 }, { canManageKeys: true }),
    [],
  );
});

test('a pending review needs attention only from someone who can publish', async () => {
  const { cmsAttention } = await import('../lib/utils/cms.ts');
  const overview = { entries: { live: 1, changed: 0, draft: 0, scheduled: 0, review: 2 }, activeApiKeys: 1 };
  assert.deepEqual(cmsAttention(overview, { canManageKeys: false, canPublish: true }), [
    { kind: 'awaiting_review', count: 2, tone: 'measured' },
  ]);
  assert.deepEqual(cmsAttention(overview, { canManageKeys: false, canPublish: false }), []);
});

test('a clip length reads like a player', async () => {
  const { formatClipLength, isVideo } = await import('../lib/utils/cms.ts');
  assert.equal(formatClipLength(7.4), '0:07');
  assert.equal(formatClipLength(125), '2:05');
  assert.equal(formatClipLength(3723), '1:02:03');
  assert.equal(formatClipLength(Number.NaN), '');
  assert.equal(formatClipLength(Number.POSITIVE_INFINITY), '');
  assert.equal(isVideo('video/mp4'), true);
  assert.equal(isVideo('image/png'), false);
});

test('translationCoverage: a language’s versions out of every entry, in words', async () => {
  const { translationCoverage } = await import('../lib/utils/cms.ts');
  assert.deepEqual(translationCoverage(0, 0), { percent: 0, label: 'No entries yet' });
  assert.deepEqual(translationCoverage(20, 20), { percent: 100, label: 'All 20' });
  assert.deepEqual(translationCoverage(12, 20), { percent: 60, label: '12 of 20' });
  assert.deepEqual(translationCoverage(0, 20), { percent: 0, label: '0 of 20' });
  // Nearly done is not done; barely started is not nothing.
  assert.equal(translationCoverage(999, 1000).percent, 99);
  assert.equal(translationCoverage(1, 1000).percent, 1);
});

test('resolvedTitleKey: the chosen title field, else the first short text', async () => {
  const { resolvedTitleKey } = await import('../lib/utils/cms.ts');
  const fields = [
    { key: 'hero', label: 'Hero', type: 'media' },
    { key: 'headline', label: 'Headline', type: 'text' },
    { key: 'name', label: 'Name', type: 'text' },
  ] as const;
  assert.equal(resolvedTitleKey([...fields], 'name'), 'name');
  assert.equal(resolvedTitleKey([...fields], ''), 'headline');
  assert.equal(resolvedTitleKey([...fields], 'gone'), 'headline');
  assert.equal(resolvedTitleKey([{ key: 'hero', label: 'Hero', type: 'media' }], null), null);
});

test('fieldRules: a field’s rules in a few words', async () => {
  const { fieldRules } = await import('../lib/utils/cms.ts');
  assert.deepEqual(fieldRules({ key: 'title', label: 'Title', type: 'text', required: true, maxLength: 80 }), ['Required', 'Up to 80 characters']);
  assert.deepEqual(fieldRules({ key: 'n', label: 'N', type: 'number', integer: true, min: 0, max: 10 }), ['Whole numbers', '0–10']);
  assert.deepEqual(fieldRules({ key: 'g', label: 'G', type: 'media', multiple: true, maxItems: 5, private: true }), ['List', 'Up to 5 items', 'Private']);
  assert.deepEqual(fieldRules({ key: 'b', label: 'B', type: 'boolean' }), []);
});

test('duplicateField: a copy beside it with a free key', async () => {
  const { duplicateField } = await import('../lib/utils/cms.ts');
  const hero = { key: 'heroImage', label: 'Hero image', type: 'media' as const, required: true };
  const copy = duplicateField(hero, [hero, { key: 'heroImageCopy', label: 'x', type: 'text' as const }]);
  assert.equal(copy.label, 'Hero image copy');
  assert.equal(copy.key, 'heroImageCopy2');
  assert.equal(copy.required, true);
});

test('relabelField: the key follows the label only while new and untouched', async () => {
  const { relabelField } = await import('../lib/utils/cms.ts');
  const fresh = { key: 'heroImage', label: 'Hero image', type: 'media' as const };
  assert.equal(relabelField(fresh, 'Cover photo', [fresh], new Set()).key, 'coverPhoto');
  // Saved: entries already use the key.
  assert.equal(relabelField(fresh, 'Cover photo', [fresh], new Set(['heroImage'])).key, 'heroImage');
  // Typed by hand: no longer the label's key.
  const typed = { key: 'img', label: 'Hero image', type: 'media' as const };
  assert.equal(relabelField(typed, 'Cover photo', [typed], new Set()).key, 'img');
  // Stays clear of a sibling's key.
  const other = { key: 'coverPhoto', label: 'Cover photo', type: 'text' as const };
  assert.equal(relabelField(fresh, 'Cover photo', [fresh, other], new Set()).key, 'coverPhoto2');
});

test('requiredMissing: required fields still empty, blanks of every shape', async () => {
  const { requiredMissing } = await import('../lib/utils/cms.ts');
  const fields = [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'tags', label: 'Tags', type: 'select', multiple: true, required: true },
    { key: 'hero', label: 'Hero', type: 'group', required: true, fields: [{ key: 'alt', label: 'Alt', type: 'text' }] },
    { key: 'live', label: 'Live', type: 'boolean', required: true },
    { key: 'note', label: 'Note', type: 'text' },
  ] as const;
  const keys = (data: Record<string, unknown>) => requiredMissing([...fields] as never, data).map((field) => field.key);
  assert.deepEqual(keys({ title: '  ', tags: [], hero: { alt: '' } }), ['title', 'tags', 'hero']);
  assert.deepEqual(keys({ title: 'Hello', tags: ['a'], hero: { alt: 'x' } }), []);
  // A yes/no is always answered; an optional field never counts.
  assert.deepEqual(keys({ title: 'Hello', tags: ['a'], hero: { alt: 'x' }, live: false, note: '' }), []);
});

test('fieldValueInWords: what a row shows for a value', async () => {
  const { fieldValueInWords } = await import('../lib/utils/cms.ts');
  assert.equal(fieldValueInWords({ key: 't', label: 'T', type: 'longText' }, '  Two\n lines '), 'Two lines');
  assert.equal(fieldValueInWords({ key: 't', label: 'T', type: 'text' }, '   '), null);
  assert.equal(fieldValueInWords({ key: 'i', label: 'I', type: 'media' }, 'asset-1'), 'Added');
  assert.equal(fieldValueInWords({ key: 'i', label: 'I', type: 'media', multiple: true }, ['a', 'b']), '2 files');
  assert.equal(fieldValueInWords({ key: 's', label: 'S', type: 'select', multiple: true }, ['Vegan', 'Hot']), 'Vegan, Hot');
  assert.equal(fieldValueInWords({ key: 'b', label: 'B', type: 'boolean' }, false), 'No');
  assert.equal(fieldValueInWords({ key: 'n', label: 'N', type: 'number' }, undefined), null);
});

test('fieldValueInWords: every field type reads in words', async () => {
  const { fieldValueInWords } = await import('../lib/utils/cms.ts');
  assert.equal(fieldValueInWords({ key: 'b', label: 'B', type: 'richText' }, '## Hello **there**\n- one'), 'Hello there one');
  assert.equal(fieldValueInWords({ key: 'd', label: 'D', type: 'date' }, '2026-10-22'), '22 Oct 2026');
  assert.equal(fieldValueInWords({ key: 'r', label: 'R', type: 'reference' }, 'abc'), 'Linked');
  assert.equal(fieldValueInWords({ key: 'r', label: 'R', type: 'reference', multiple: true }, ['a', 'b']), '2 links');
  assert.equal(fieldValueInWords({ key: 'g', label: 'G', type: 'group', multiple: true }, [{}, {}, {}]), '3 items');
  const group = { key: 'g', label: 'G', type: 'group' as const, fields: [{ key: 'a', label: 'A', type: 'text' as const }, { key: 'b', label: 'B', type: 'text' as const }] };
  assert.equal(fieldValueInWords(group, { a: 'x', b: '' }), '1 of 2 filled');
  assert.equal(fieldValueInWords(group, { a: '', b: '' }), null);
  assert.equal(fieldValueInWords({ key: 'l', label: 'L', type: 'location' }, { lat: 51.5, lng: -0.12 }), '51.5000, -0.1200');
  assert.equal(fieldValueInWords({ key: 'i', label: 'I', type: 'media', multiple: true }, ['a', 'b']), '2 files');
});

test('lastTextChange: the latest save or restore — not a publish', async () => {
  const { lastTextChange } = await import('../lib/utils/cms.ts');
  assert.equal(
    lastTextChange([
      { action: 'saved', createdAt: '2026-10-01T09:00:00Z' },
      { action: 'published', createdAt: '2026-10-05T09:00:00Z' },
      { action: 'restored', createdAt: '2026-10-03T09:00:00Z' },
    ]),
    '2026-10-03T09:00:00Z',
  );
  assert.equal(lastTextChange([{ action: 'published', createdAt: '2026-10-05T09:00:00Z' }]), null);
});

test('translationDrift: which language versions have fallen behind', async () => {
  const { translationDrift } = await import('../lib/utils/cms.ts');
  const en = { id: 'en', locale: 'en', status: 'changed' as const, changedAt: '2026-10-20T10:00:00Z' };
  const fr = { id: 'fr', locale: 'fr', status: 'published' as const, changedAt: '2026-10-10T10:00:00Z' };
  const uk = { id: 'uk', locale: 'uk', status: 'draft' as const, changedAt: '2026-10-21T10:00:00Z' };
  const de = { id: 'de', locale: 'de', status: 'archived' as const, changedAt: '2026-01-01T10:00:00Z' };
  assert.deepEqual(translationDrift('en', [en, fr, uk, de], 'en'), { kind: 'translations-older', behind: [fr] });
  assert.deepEqual(translationDrift('fr', [en, fr, uk], 'en'), { kind: 'source-newer', source: en });
  assert.equal(translationDrift('uk', [en, fr, uk], 'en'), null);
  assert.equal(translationDrift('en', [en, { ...fr, changedAt: null }], 'en'), null);
  assert.equal(translationDrift('en', [en], 'en'), null);
});
