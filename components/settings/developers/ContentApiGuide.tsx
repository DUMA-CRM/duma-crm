'use client';

import { useState } from 'react';

import { RowTile } from '@/components/cms/rows';
import { Box, ChevronDown, Layers } from '@/components/icons';

import type { CmsContentType, CmsLocale } from '@/lib/api/cms.service';
import { fieldTypeLabel } from '@/lib/utils/cms';
import { exampleEntry, pascalCase, typeScriptTypes } from '@/lib/utils/cms-docs';
import { cn } from '@/lib/utils/cn';

import { C, CodeBlock, DocSection, DocTable, Note } from './docs-blocks';

/** The Content API's guide, after its endpoint list: in reading order, as the rail shows it. */
export const CONTENT_GUIDE_SECTIONS = [
  { id: 'content-querying', label: 'Querying' },
  { id: 'content-responses', label: 'Responses' },
  { id: 'content-models', label: 'Content models' },
  { id: 'content-locales', label: 'Languages' },
  { id: 'content-media', label: 'Media' },
  { id: 'content-rich-text', label: 'Rich text' },
  { id: 'content-seo', label: 'SEO block' },
  { id: 'content-preview', label: 'Draft previews' },
  { id: 'content-sync', label: 'Sync' },
] as const;

/** Webhooks are sent for content changes today; they have a group of their own so other events can join them. */
export const WEBHOOK_GUIDE_SECTIONS = [{ id: 'webhooks', label: 'Content webhooks' }] as const;

interface GuideProps {
  base: string;
  types: CmsContentType[];
  locales: Array<Pick<CmsLocale, 'code' | 'name' | 'isDefault' | 'fallbackCode'>>;
}

function examplesFor({ base, types, locales }: GuideProps) {
  const sample = types.find((type) => type.kind === 'collection') ?? types[0];
  const sampleKey = sample?.key ?? 'blog-post';
  const defaultLocale = locales.find((locale) => locale.isDefault)?.code ?? 'en';
  const listResponse = JSON.stringify(
    {
      data: [sample ? exampleEntry(sample, defaultLocale) : { id: '…', type: sampleKey, fields: {} }],
      meta: { total: 42, limit: 10, offset: 0, page: 1, pages: 5, locale: defaultLocale },
    },
    null,
    2,
  );
  const verifyExample = `import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyDumaWebhook(rawBody: string, headers: Headers, secret: string): boolean {
  const timestamp = Number(headers.get('x-duma-timestamp'));
  const signature = headers.get('x-duma-signature') ?? '';
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = 'v1=' + createHmac('sha256', secret).update(\`\${timestamp}.\${rawBody}\`).digest('hex');
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}`;
  const webhookBody = JSON.stringify(
    {
      id: 'a8f0…',
      event: 'entry.published',
      createdAt: '2026-10-06T09:00:00.000Z',
      data: {
        entry: { id: '0b6f2c1e-…', entryId: '91d3…', type: sampleKey, locale: defaultLocale, slug: 'example-slug', version: 4 },
        source: 'editor',
      },
    },
    null,
    2,
  );
  const assetExample = JSON.stringify(
    {
      id: '7d9e…',
      url: `${base}/assets/7d9e…/file/hero.jpg`,
      fileName: 'hero.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 182340,
      width: 1600,
      height: 900,
      title: 'Morning bar',
      altText: 'Baristas behind a busy counter',
      focalPoint: { x: 0.42, y: 0.35 },
      renditions: [
        { width: 480, height: 270, mimeType: 'image/webp', sizeBytes: 21340, url: `${base}/assets/7d9e…/renditions/3c1a…` },
        { width: 960, height: 540, mimeType: 'image/webp', sizeBytes: 58210, url: `${base}/assets/7d9e…/renditions/9b02…` },
      ],
      srcset: `${base}/assets/7d9e…/renditions/3c1a… 480w, ${base}/assets/7d9e…/renditions/9b02… 960w, ${base}/assets/7d9e…/file/hero.jpg 1600w`,
    },
    null,
    2,
  );
  return { sampleKey, defaultLocale, listResponse, webhookBody, assetExample, verifyExample };
}

/** A model's reference: one line closed — name, key, endpoint — and its fields when opened. */
function ModelReference({ type, defaultOpen }: { type: CmsContentType; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const singleton = type.kind === 'singleton';
  const path = singleton ? `/singletons/${type.key}` : `/entries/${type.key}`;
  const fields = type.fields.filter((field) => !field.private);
  return (
    <div className="overflow-hidden rounded-lg border border-rule/60 bg-control">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <RowTile icon={singleton ? Box : Layers} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{type.name}</span>
          <span className="block truncate font-mono text-xs text-muted-foreground">GET {path}</span>
        </span>
        <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
          {fields.length} {fields.length === 1 ? 'field' : 'fields'}
        </span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="border-t border-rule/50">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-rule/40 align-top">
              {fields.map((field) => {
                const notes = [
                  field.required && 'Required',
                  field.unique && 'Unique',
                  field.options?.length ? `One of ${field.options.join(', ')}` : null,
                  field.referenceTypes?.length ? `Links to ${field.referenceTypes.join(', ')}` : null,
                  field.description,
                ].filter(Boolean);
                return (
                  <tr key={field.key}>
                    <td className="w-px whitespace-nowrap px-4 py-2">
                      <C>{field.key}</C>
                    </td>
                    <td className="w-px whitespace-nowrap px-2 py-2 text-xs text-muted-foreground">
                      {fieldTypeLabel(field.type)}
                      {field.multiple ? ' · list' : ''}
                    </td>
                    <td className="px-4 py-2 text-xs leading-relaxed text-muted-foreground">{notes.join(' · ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * The Content API beyond its endpoints: query syntax, response shapes, this
 * workspace's models as TypeScript, and how to render what comes back.
 */
export function ContentApiGuide(props: GuideProps) {
  const { base, types, locales } = props;
  const { sampleKey, listResponse, assetExample } = examplesFor(props);
  const tsTypes = typeScriptTypes(types);
  return (
    <>
      <DocSection
        id="content-querying"
        title="Querying"
        lead="Lists take every parameter below; a single entry or singleton takes locale, fallback, fields, include and status."
      >
        <DocTable
          head={['Parameter', 'Meaning', 'Example']}
          rows={[
            [
              <C key="f">filter[field][op]</C>,
              'Filter on a field or on id, slug, createdAt, updatedAt, publishedAt. Dots reach into groups.',
              <C key="fe">filter[price][lte]=5</C>,
            ],
            [
              <C key="s">sort</C>,
              'Up to three keys; a leading - sorts descending. Default: newest published first.',
              <C key="se">sort=-publishedAt,title</C>,
            ],
            [
              <C key="l">limit · page · offset</C>,
              'Page size 1–100 (default 25), then page or offset — not both.',
              <C key="le">limit=12&amp;page=2</C>,
            ],
            [<C key="fi">fields</C>, 'Return only these fields.', <C key="fie">fields=title,hero</C>],
            [<C key="i">include</C>, 'Resolve media and linked entries 0–3 levels deep (default 1).', <C key="ie">include=2</C>],
            [
              <C key="lo">locale · fallback</C>,
              'Language, and whether a missing translation falls back (default true).',
              <C key="loe">locale=fr&amp;fallback=false</C>,
            ],
            [<C key="q">q</C>, 'Full-text search over published text.', <C key="qe">q=oat latte</C>],
            [<C key="st">status</C>, 'draft returns drafts — secret keys with content:preview only.', <C key="ste">status=draft</C>],
          ]}
        />
        <h3 className="pt-2 text-sm font-semibold text-foreground">Filter operators</h3>
        <DocTable
          head={['Operator', 'Works on', 'Meaning']}
          rows={[
            [<C key="1">eq · ne</C>, 'Most fields', 'Equal / not equal. filter[field]=value means eq.'],
            [<C key="2">lt · lte · gt · gte</C>, 'Numbers, dates, system dates', 'Ranges'],
            [<C key="3">in · nin</C>, 'Text, numbers, links', 'Comma-separated list of values'],
            [<C key="4">contains · startsWith</C>, 'Text', 'Case-insensitive match'],
            [<C key="5">contains · in</C>, 'Lists (multi-choice, media, links)', 'Holds this value / holds any of these'],
            [<C key="6">exists</C>, 'Everything', 'true or false'],
          ]}
        />
        <Note>
          An unknown field, or an operator a field doesn’t support, is a 400 that names the problem — a misspelt filter never silently
          returns everything.
        </Note>
      </DocSection>

      <DocSection
        id="content-responses"
        title="Responses"
        lead={
          <>
            A list wraps entries in <C>data</C> with paging in <C>meta</C>; a single entry is <C>{'{ data: Entry }'}</C>. An entry’s{' '}
            <C>id</C> is the same in every language.
          </>
        }
      >
        <CodeBlock tabs={[{ label: `GET /entries/${sampleKey}`, language: 'JSON', code: listResponse }]} />
        <Note>
          Linked entries come back whole up to the <C>include</C> depth. Beyond it — or when the target isn’t published or readable by the
          key — a link is just <C>{'{ id }'}</C>. Private fields are never sent.
        </Note>
      </DocSection>

      <DocSection
        id="content-models"
        title="Content models"
        lead={
          types.length > 0
            ? 'Generated from this workspace and always current. Open a model for its fields; the TypeScript below is ready to paste.'
            : 'No models yet — create one in Models and it appears here.'
        }
      >
        {types.length > 0 && (
          <div className="space-y-2">
            {types.map((type, index) => (
              <ModelReference key={type.id} type={type} defaultOpen={index === 0 && types.length <= 3} />
            ))}
          </div>
        )}
        {types.length > 0 && (
          <>
            <CodeBlock
              tabs={[{ label: 'TypeScript types', language: `${types.length} ${types.length === 1 ? 'model' : 'models'}`, code: tsTypes }]}
            />
            <p className="text-sm text-muted-foreground">
              For example: <C>{`DumaList<${pascalCase(sampleKey)}Fields>`}</C> for a list response.
            </p>
          </>
        )}
      </DocSection>

      <DocSection
        id="content-locales"
        title="Languages"
        lead="Each entry is written per language. Ask for one with locale; when an entry has no translation, the request falls back along the chain to the default."
      >
        <DocTable
          head={['Code', 'Name', 'Falls back to']}
          rows={(locales.length > 0 ? locales : [{ code: 'en', name: 'English', isDefault: true, fallbackCode: null }]).map((locale) => [
            <C key="c">{locale.code}</C>,
            locale.name,
            locale.isDefault ? 'Default' : (locale.fallbackCode ?? 'The default'),
          ])}
        />
      </DocSection>

      <DocSection
        id="content-media"
        title="Media"
        lead="A resolved media field is an asset object. Its url is public, keyless and cached for a year — put it straight into an image or video element."
      >
        <CodeBlock
          tabs={[
            { label: 'Asset', language: 'JSON', code: assetExample },
            {
              label: 'Responsive image',
              language: 'HTML',
              code: `<img\n  src="{url}"\n  srcset="{srcset}"\n  sizes="(min-width: 960px) 50vw, 100vw"\n  alt="{altText}"\n  style="object-fit: cover; object-position: {focalPoint.x * 100}% {focalPoint.y * 100}%"\n/>`,
            },
          ]}
        />
        <Note>
          Always render <C>altText</C>. <C>renditions</C> are smaller WebP copies (480, 960 and 1600 px where the original is larger);{' '}
          <C>srcset</C> is ready to use, or null when there are none. <C>focalPoint</C> marks the subject — use it as <C>object-position</C>{' '}
          when you crop. The <C>url</C> is a connected bucket’s own CDN address when the workspace stores media there.
        </Note>
      </DocSection>

      <DocSection
        id="content-rich-text"
        title="Rich text"
        lead="Rich-text fields are GitHub-flavoured Markdown. Two conventions go beyond plain Markdown, and both degrade to readable text if you ignore them."
      >
        <DocTable
          head={['Written as', 'Means', 'Render it as']}
          rows={[
            [
              <C key="1">{'> [!NOTE]'}</C>,
              'A callout: NOTE, TIP, IMPORTANT, WARNING or CAUTION on the first line of a quote',
              'A highlighted box (GitHub alert syntax; remark-github-alerts and similar handle it)',
            ],
            [<C key="2">https://youtu.be/…</C>, 'A paragraph that is only a YouTube or Vimeo link', 'The provider’s embedded player'],
          ]}
        />
      </DocSection>

      <DocSection
        id="content-seo"
        title="SEO block"
        lead="Models with the SEO block carry a seo group on each entry. Render it in the page head; blank fields have a sensible fallback."
      >
        <DocTable
          head={['Field', 'Output as', 'When blank']}
          rows={[
            [<C key="1">metaTitle</C>, <C key="1b">{'<title>'}</C>, 'The entry’s title'],
            [
              <C key="2">metaDescription</C>,
              <C key="2b">{'<meta name="description">'}</C>,
              'The opening of the text, about 155 characters',
            ],
            [<C key="3">socialTitle · socialDescription</C>, <C key="3b">og:title · og:description</C>, 'The meta title and description'],
            [<C key="4">ogImage</C>, <C key="4b">og:image (+ og:image:alt)</C>, 'The entry’s first image'],
            [<C key="5">canonicalUrl</C>, <C key="5b">{'<link rel="canonical">'}</C>, 'The page’s own URL'],
            [<C key="6">noIndex · noFollow</C>, <C key="6b">{'<meta name="robots" content="noindex, nofollow">'}</C>, 'Leave the tag out'],
            [<C key="7">schemaType</C>, 'JSON-LD @type (below)', 'WebPage'],
            [<C key="8">focusKeyword · relatedKeywords</C>, 'Nothing — editorial only', '—'],
          ]}
        />
        <CodeBlock
          tabs={[
            {
              label: 'Structured data',
              language: 'HTML',
              code: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "{seo.schemaType or WebPage}",\n  "headline": "{seo.metaTitle}",\n  "description": "{seo.metaDescription}",\n  "image": "{seo.ogImage.url}",\n  "datePublished": "{publishedAt}",\n  "dateModified": "{updatedAt}"\n}\n</script>`,
            },
          ]}
        />
        <Note tone="warning">
          Don’t output the keywords as <C>{'<meta name="keywords">'}</C> — search engines ignore it. Fetch with <C>include=1</C> so{' '}
          <C>ogImage</C> arrives as an asset with its URL and alt text.
        </Note>
      </DocSection>

      <DocSection
        id="content-preview"
        title="Draft previews"
        lead="Editors can share a link to a draft on your site. It opens your page with ?duma_preview=<token>; your page reads the draft with that token — no API key, and only that one entry, until it expires."
      >
        <CodeBlock
          tabs={[
            {
              label: 'On your page',
              language: 'JavaScript',
              code: `const token = new URL(location.href).searchParams.get('duma_preview');\nconst entry = token\n  ? (await fetch(\`${base}/preview/\${token}?include=1\`).then((r) => r.json())).data\n  : await loadPublished(); // your usual delivery call`,
            },
          ]}
        />
        <Note>
          The link comes from the model’s preview URL, so set one on each model. Answers are <C>no-store</C> and <C>noindex</C>; an expired
          or forged token gets <C>401</C>. Don’t cache preview responses.
        </Note>
      </DocSection>

      <DocSection
        id="content-sync"
        title="Sync"
        lead="Mirror content into a static site without a full rebuild: ask what changed since the last time."
      >
        <CodeBlock
          tabs={[
            {
              label: 'Request',
              language: 'shell',
              code: `curl -H "Authorization: Bearer $DUMA_PUBLISHABLE_KEY" "${base}/sync?since=2026-10-01T00:00:00Z&limit=100"`,
            },
          ]}
        />
        <ol className="space-y-2 text-sm text-muted-foreground">
          {[
            <>
              The answer has <C>entries</C> (published or republished since, oldest first), <C>deletions</C> (entries unpublished or
              deleted, assets deleted) and <C>nextSince</C>.
            </>,
            <>Apply the deletions first, then upsert the entries.</>,
            <>
              Store <C>nextSince</C> for next time, and call again straight away while <C>hasMore</C> is true.
            </>,
            <>
              Omit <C>since</C> the first time to get everything published.
            </>,
          ].map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-band text-[0.6875rem] font-semibold text-foreground">
                {index + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </DocSection>
    </>
  );
}

/** Signed POSTs when content changes. */
export function WebhooksGuide(props: GuideProps) {
  const { webhookBody, verifyExample } = examplesFor(props);
  return (
    <DocSection
      id="webhooks"
      title="Webhooks"
      lead="DUMA can POST to your site when content changes — the usual way to rebuild a static site or revalidate a cache. Add one under Keys & webhooks."
    >
      <DocTable
        head={['Event', 'Sent when']}
        rows={[
          [<C key="1">entry.published</C>, 'An entry is published, by a person or a schedule'],
          [<C key="2">entry.unpublished</C>, 'An entry stops being live (also before archiving)'],
          [<C key="3">entry.deleted</C>, 'A live entry is deleted'],
          [<C key="4">asset.changed</C>, 'Media is uploaded, edited or deleted'],
          [<C key="5">ping</C>, 'The Test button'],
        ]}
      />
      <CodeBlock
        tabs={[
          { label: 'Request body', language: 'JSON', code: webhookBody },
          { label: 'Verify a signature', language: 'TypeScript · Node', code: verifyExample },
        ]}
      />
      <Note>
        Each request is signed. Compute <C>v1=</C>HMAC-SHA256 of <C>timestamp + &quot;.&quot; + raw body</C> with the webhook’s secret and
        compare it with <C>X-Duma-Signature</C>; reject anything older than five minutes. Answer 2xx quickly — anything else is retried with
        backoff, up to 8 times.
      </Note>
    </DocSection>
  );
}
