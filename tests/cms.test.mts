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
  assert.deepEqual(cleanEntryData(fields, { title: 'Hi', price: '3.50', tags: [], seo: { meta: '' }, stray: 1 }), { title: 'Hi', price: 3.5 });
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
  const grouped = issuesByField([{ field: 'title', message: 'Required' }, { field: 'faq[1].q', message: 'Required' }]);
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
      { key: 'faq', label: 'FAQ', type: 'group' as const, multiple: true, fields: [{ key: 'q', label: 'Q', type: 'text' as const, required: true }] },
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
    locales: [{ code: 'en', name: 'English', isDefault: true, fallbackCode: null }, { code: 'fr', name: 'French', isDefault: false, fallbackCode: null }],
  });
  assert.match(prompt, /Base URL: https:\/\/api\.example\.com\/v1\/cms\/delivery/);
  assert.match(prompt, /Blog post — key `blog-post`, collection \(GET \/entries\/blog-post\)/);
  assert.match(prompt, /tags: select one of "news", "menu" \(list\)/);
  assert.match(prompt, /X-Duma-Signature/);
  assert.match(prompt, /fr \(French\)/);
  assert.doesNotMatch(prompt, /margin/);
  assert.doesNotMatch(prompt, /dcms_(live|prev)_[A-Za-z0-9_-]{20,}/);
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
  assert.deepEqual(cmsAttention(overview, { canManageKeys: true }).map((item) => item.kind), ['no_api_key', 'unpublished_changes', 'never_published', 'scheduled']);
  assert.equal(cmsAttention(overview, { canManageKeys: false }).some((item) => item.kind === 'no_api_key'), false);
  assert.equal(cmsAttention({ ...overview, entries: { ...overview.entries, live: 0 } }, { canManageKeys: true }).some((item) => item.kind === 'no_api_key'), false, 'no key needed before anything is live');
  assert.deepEqual(cmsAttention({ entries: { live: 1, changed: 0, draft: 0, scheduled: 0 }, activeApiKeys: 1 }, { canManageKeys: true }), []);
});

test('a pending review needs attention only from someone who can publish', async () => {
  const { cmsAttention } = await import('../lib/utils/cms.ts');
  const overview = { entries: { live: 1, changed: 0, draft: 0, scheduled: 0, review: 2 }, activeApiKeys: 1 };
  assert.deepEqual(cmsAttention(overview, { canManageKeys: false, canPublish: true }), [{ kind: 'awaiting_review', count: 2, tone: 'measured' }]);
  assert.deepEqual(cmsAttention(overview, { canManageKeys: false, canPublish: false }), []);
});
