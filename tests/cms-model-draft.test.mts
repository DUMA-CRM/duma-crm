import assert from 'node:assert/strict';
import test from 'node:test';

const { normaliseModelDraft, resolveFieldType, builtInReason, uniqueModelName, mergeDraftFields } =
  await import('../lib/utils/cms-model-draft.ts');
const { fieldListProblems } = await import('../lib/utils/cms.ts');

test('common type names map to the CMS types; nonsense is dropped', () => {
  assert.equal(resolveFieldType('richText'), 'richText');
  assert.equal(resolveFieldType('Markdown'), 'richText');
  assert.equal(resolveFieldType('image'), 'media');
  assert.equal(resolveFieldType('dropdown'), 'select');
  assert.equal(resolveFieldType('price'), 'number');
  assert.equal(resolveFieldType('hologram'), null);
});

test('a described model becomes fields the editor accepts', () => {
  const draft = normaliseModelDraft(
    {
      name: 'Menu special',
      description: 'A dish on the specials board',
      kind: 'collection',
      titleField: 'Name',
      seo: true,
      fields: [
        { label: 'Name', type: 'string', required: true },
        { label: 'URL', type: 'slug' },
        { label: 'Price', type: 'price', min: 0 },
        { label: 'Photo', type: 'image' },
        { label: 'Allergens', type: 'select', multiple: true, options: ['Gluten', 'Milk', 'Milk', ''] },
        { label: 'Mood', type: 'select', options: [] },
        { label: 'Chef', type: 'reference', referenceTypes: ['author', 'ghost'] },
        {
          label: 'Nutrition',
          type: 'group',
          fields: [
            { label: 'Calories', type: 'number', integer: true },
            { label: 'Inner', type: 'group', fields: [] },
          ],
        },
        { label: 'Second slug', type: 'slug' },
        { label: 'Name', type: 'text' },
        { label: 'Bad', type: 'hologram' },
      ],
    },
    { referenceKeys: ['author'] },
  )!;
  assert.equal(draft.name, 'Menu special');
  assert.equal(draft.titleField, 'name');
  assert.equal(draft.seo, true);
  const byLabel = Object.fromEntries(draft.fields.map((field) => [field.label, field]));
  assert.equal(byLabel.URL!.type, 'slug');
  assert.equal(byLabel.URL!.slugSource, 'name');
  assert.equal(byLabel.Price!.type, 'number');
  assert.deepEqual(byLabel.Photo!.mediaGroups, ['image']);
  assert.deepEqual(byLabel.Allergens!.options, ['Gluten', 'Milk']);
  assert.equal(byLabel.Mood!.type, 'text', 'a choice without options becomes text');
  assert.deepEqual(byLabel.Chef!.referenceTypes, ['author']);
  assert.equal(byLabel.Nutrition!.fields!.length, 1, 'groups nest one level only');
  assert.equal(draft.fields.filter((field) => field.type === 'slug').length, 1);
  assert.equal(draft.fields.filter((field) => field.label === 'Name').length, 1, 'a repeated label is left out');
  assert.ok(draft.skipped.some((entry) => entry.label === 'Name'));
  assert.deepEqual(fieldListProblems(draft.fields), []);
});

test('a field the model already has is not added again', () => {
  const draft = normaliseModelDraft(
    {
      fields: [
        { label: 'Title', type: 'text' },
        { label: 'Summary', type: 'longText' },
      ],
    },
    { existingKeys: ['title'], referenceKeys: [] },
  )!;
  assert.deepEqual(
    draft.fields.map((field) => field.key),
    ['summary'],
  );
  assert.deepEqual(
    draft.skipped.map((entry) => entry.label),
    ['Title'],
  );
});

test('fields the entry already has built in are left out, with the reason', () => {
  const draft = normaliseModelDraft(
    {
      seo: true,
      fields: [
        { label: 'Title', type: 'text' },
        { label: 'Publish date', type: 'dateTime' },
        { label: 'Published at', type: 'dateTime' },
        { label: 'Expiry date', type: 'date' },
        { label: 'Status', type: 'select', options: ['Draft', 'Live'] },
        { label: 'Last updated', type: 'date' },
        { label: 'Meta description', type: 'longText' },
        { label: 'Event date', type: 'date' },
        { label: 'Available until', type: 'date' },
      ],
    },
    { referenceKeys: [] },
  )!;
  assert.deepEqual(
    draft.fields.map((field) => field.label),
    ['Title', 'Event date', 'Available until'],
  );
  assert.equal(draft.skipped.length, 6);
  assert.match(draft.skipped[0]!.reason, /Schedule/);
});

test('SEO-ish fields stay when the model has no SEO block', () => {
  assert.equal(builtInReason('Meta description', false), null);
  assert.match(builtInReason('Meta description', true)!, /SEO/);
  assert.equal(builtInReason('Opening date', true), null);
});

test('a taken model name gets the next free number', () => {
  assert.equal(uniqueModelName('Blog post', ['FAQ']), 'Blog post');
  assert.equal(uniqueModelName('Blog post', ['blog post']), 'Blog post 2');
  assert.equal(uniqueModelName('Blog post', ['Blog post', 'Blog post 2']), 'Blog post 3');
});

test('nothing usable comes back as null', () => {
  assert.equal(normaliseModelDraft({ fields: [] }, { referenceKeys: [] }), null);
  assert.equal(normaliseModelDraft({ fields: [{ label: 'X', type: 'hologram' }] }, { referenceKeys: [] }), null);
  assert.equal(normaliseModelDraft('nope', { referenceKeys: [] }), null);
});

test('an unrelated request is judged on its own and marked as such', () => {
  const draft = normaliseModelDraft(
    {
      related: false,
      name: 'Team member',
      fields: [
        { label: 'Name', type: 'text' },
        { label: 'Role', type: 'text' },
      ],
    },
    { existingKeys: ['name', 'body'], referenceKeys: [] },
  )!;
  assert.equal(draft.related, false);
  assert.deepEqual(
    draft.fields.map((field) => field.key),
    ['name', 'role'],
    'overlaps with the old model are not skipped',
  );
  assert.equal(normaliseModelDraft({ fields: [{ label: 'Tags', type: 'text' }] }, { referenceKeys: [] })!.related, true);
});

test('a draft replaces the fields, or adds only what is new under free keys', () => {
  const seo = { key: 'seo', label: 'SEO & sharing', type: 'group' as const, fields: [] };
  const current = [
    { key: 'title', label: 'Title', type: 'text' as const },
    { key: 'role', label: 'Body', type: 'richText' as const },
  ];
  const draft = {
    seo: true,
    fields: [
      { key: 'title', label: 'title', type: 'text' as const },
      { key: 'role', label: 'Role', type: 'text' as const },
    ],
  };
  const replaced = mergeDraftFields(current, draft, 'replace', seo);
  assert.deepEqual(
    replaced.fields.map((field) => field.key),
    ['title', 'role', 'seo'],
  );
  assert.equal(replaced.added, 2);
  const added = mergeDraftFields(current, draft, 'add', seo);
  assert.deepEqual(
    added.fields.map((field) => field.key),
    ['title', 'role', 'role2', 'seo'],
  );
  assert.equal(added.added, 1);
});
