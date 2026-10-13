'use client';

import { FIELD_TYPES } from '@/lib/utils/cms';

import { C, CodeBlock, DocSection, DocTable, Note } from './docs-blocks';

/** The Content Management API's guide, after its endpoint list: in reading order, as the rail shows it. */
export const MANAGE_GUIDE_SECTIONS = [
  { id: 'manage-models', label: 'Create a model' },
  { id: 'manage-entries', label: 'Create an entry' },
] as const;

const json = (value: unknown) => JSON.stringify(value, null, 2);

const MODEL_EXAMPLE = {
  key: 'blog-post',
  name: 'Blog post',
  kind: 'collection',
  titleField: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 120 },
    { key: 'slug', label: 'Slug', type: 'slug', required: true, unique: true, slugSource: 'title' },
    { key: 'body', label: 'Body', type: 'richText' },
    { key: 'hero', label: 'Hero image', type: 'media', mediaGroups: ['image'] },
    { key: 'tags', label: 'Tags', type: 'select', multiple: true, options: ['news', 'menu'] },
  ],
};

const ENTRY_EXAMPLE = {
  locale: 'en',
  data: { title: 'Autumn menu is here', slug: 'autumn-menu', body: '## New this week\n\nPumpkin spice, but **better**.', tags: ['menu'] },
};

/** Writing through the API: models, and entries that wait for an editor. */
export function ManageApiGuide({ base }: { base: string }) {
  return (
    <>
      <DocSection
        id="manage-models"
        title="Create a model"
        lead={
          <>
            Secret key with <C>content:models</C>. The same rules as the model editor: a key starting with a letter, up to 100 fields,
            groups two levels deep. A key in use is <C>409</C>; an invalid field is <C>422</C> naming it.
          </>
        }
      >
        <CodeBlock
          tabs={[
            { label: 'POST /content-types', language: 'JSON', code: json(MODEL_EXAMPLE) },
            {
              label: 'cURL',
              language: 'shell',
              code: `curl -X POST "${base}/content-types" \\\n  -H "Authorization: Bearer $DUMA_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d @model.json`,
            },
          ]}
        />
        <DocTable
          head={['Field type', 'Holds']}
          rows={FIELD_TYPES.map((entry) => [<C key={entry.type}>{entry.type}</C>, `${entry.label} — ${entry.description.toLowerCase()}`])}
        />
        <Note>
          <C>multiple</C> makes a list of <C>select</C>, <C>media</C>, <C>reference</C> or <C>group</C>. <C>options</C> are a choice’s
          values, <C>referenceTypes</C> the models a reference may link to, <C>fields</C> a group’s own fields, <C>slugSource</C> the field
          a slug is made from. <C>private</C> fields are never delivered.
        </Note>
      </DocSection>

      <DocSection
        id="manage-entries"
        title="Create an entry"
        lead={
          <>
            Secret key with <C>content:write</C>. Fetch the model first (<C>GET /content-types/{'{typeKey}'}</C> on the Content API) to know
            its field keys.
          </>
        }
      >
        <CodeBlock
          tabs={[
            { label: 'POST /entries/blog-post', language: 'JSON', code: json(ENTRY_EXAMPLE) },
            {
              label: 'Another language',
              language: 'JSON',
              code: json({ locale: 'fr', documentId: '0b6f2c1e-…', data: { title: 'Le menu d’automne', slug: 'menu-automne' } }),
            },
          ]}
        />
        <Note tone="warning">
          An entry is always created as a <strong>draft</strong>. Nothing goes live until an editor publishes it in DUMA — the API has no
          publish call. A slug or unique value already in use is <C>409</C>; data that doesn’t fit the model is <C>422</C> with an{' '}
          <C>issues</C> list. A key limited to some models can only write those (others are <C>404</C>), and a model whose editing is
          limited to some roles refuses keys with <C>403</C>.
        </Note>
      </DocSection>
    </>
  );
}
