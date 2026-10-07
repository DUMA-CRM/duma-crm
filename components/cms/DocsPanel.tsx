'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { Box, ChevronDown, Gauge, Info, KeyRound, Layers, Link2, RefreshCw, ShieldCheck, Sparkles } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { LineNav } from '@/components/line-nav';
import { CopyGlyph } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { type CmsContentType, getCmsContentTypes, getCmsLocales } from '@/lib/modules/cms/client';
import { fieldTypeLabel } from '@/lib/utils/cms';
import { buildAiPrompt, deliveryBase, exampleEntry, pascalCase, typeScriptTypes } from '@/lib/utils/cms-docs';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { RowTile } from './rows';
import { cmsKeys, copyText } from './shared';
import { useCmsAccess } from './useCmsAccess';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777';

/** The contents, in reading order and in groups — the rail shows the groups, the page reads straight through. */
const GROUPS = [
  {
    label: 'Getting started',
    sections: [
      { id: 'quickstart', label: 'Quickstart' },
      { id: 'authentication', label: 'Authentication' },
    ],
  },
  {
    label: 'Reference',
    sections: [
      { id: 'endpoints', label: 'Endpoints' },
      { id: 'querying', label: 'Querying' },
      { id: 'responses', label: 'Responses' },
      { id: 'limits', label: 'Limits & errors' },
    ],
  },
  {
    label: 'This workspace',
    sections: [
      { id: 'models', label: 'Content models' },
      { id: 'locales', label: 'Languages' },
    ],
  },
  {
    label: 'Rendering',
    sections: [
      { id: 'media', label: 'Media' },
      { id: 'rich-text', label: 'Rich text' },
      { id: 'seo', label: 'SEO block' },
    ],
  },
  {
    label: 'Integrations',
    sections: [
      { id: 'preview', label: 'Draft previews' },
      { id: 'sync', label: 'Sync' },
      { id: 'webhooks', label: 'Webhooks' },
    ],
  },
] as const;
const SECTIONS: ReadonlyArray<{ id: string; label: string }> = GROUPS.flatMap(
  (group): ReadonlyArray<{ id: string; label: string }> => group.sections,
);
const anchor = (id: string) => `cms-docs-${id}`;

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** A copy button that confirms in place for a moment. */
function CopyButton({
  text,
  label,
  variant = 'ghost',
  className,
  children,
}: {
  text: string;
  label: string;
  variant?: 'ghost' | 'outline' | 'default';
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant={variant}
      size={children ? 'sm' : 'icon-sm'}
      className={cn(!children && 'text-muted-foreground', className)}
      aria-label={children ? undefined : `Copy ${label}`}
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) setCopied(true);
        else toast('error', 'Copy failed — select the text instead.');
      }}
    >
      <CopyGlyph copied={copied} className={children ? 'size-3.5' : 'size-4'} />
      {children && (copied ? 'Copied' : children)}
    </Button>
  );
}

/** Code with its name and a copy button; several snippets of the same thing become tabs. */
function CodeBlock({ tabs }: { tabs: Array<{ label: string; code: string; language?: string }> }) {
  const [index, setIndex] = useState(0);
  const current = tabs[Math.min(index, tabs.length - 1)]!;
  return (
    <div className="overflow-hidden rounded-lg border border-rule/60 bg-control">
      <div className="flex items-center gap-1 border-b border-rule/50 py-1 pl-1.5 pr-1">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" role={tabs.length > 1 ? 'tablist' : undefined}>
          {tabs.map((tab, tabIndex) =>
            tabs.length > 1 ? (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={tabIndex === index}
                onClick={() => setIndex(tabIndex)}
                className={cn(
                  'shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                  tabIndex === index ? 'bg-band text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ) : (
              <span key={tab.label} className="truncate px-2 text-xs font-semibold text-muted-foreground">
                {tab.label}
              </span>
            ),
          )}
        </div>
        {current.language && (
          <span className="shrink-0 px-1.5 font-mono text-[0.6875rem] text-muted-foreground/80">{current.language}</span>
        )}
        <CopyButton text={current.code} label={current.label} />
      </div>
      <pre className="max-h-[28rem] overflow-auto bg-background/40 p-4 font-mono text-xs leading-5 text-foreground">{current.code}</pre>
    </div>
  );
}

function DocTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-rule/60 bg-control">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-rule/50 text-xs text-muted-foreground">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="px-4 py-2.5 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule/40 align-top">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, column) => (
                <td
                  key={column}
                  className="px-4 py-2.5 leading-relaxed text-muted-foreground first:whitespace-nowrap first:text-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const C = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-sm bg-band/70 px-1 py-0.5 font-mono text-xs text-foreground">{children}</code>
);

/** A short aside: a rule worth remembering, set apart from the reference around it. */
function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed',
        tone === 'warning' ? 'border-measured/35 bg-measured/6 text-foreground' : 'border-rule/50 bg-band/35 text-muted-foreground',
      )}
    >
      <Info
        size={15}
        className={cn('mt-0.5 shrink-0', tone === 'warning' ? 'text-measured' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function DocSection({ id, title, lead, children }: { id: string; title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <section id={anchor(id)} aria-labelledby={`${anchor(id)}-title`} className="scroll-mt-6 space-y-4">
      <div>
        <h2 id={`${anchor(id)}-title`} className="group flex items-center gap-2 text-lg font-semibold tracking-title text-foreground">
          {title}
          {/* A link straight to this section, for a colleague or an issue. */}
          <button
            type="button"
            aria-label={`Copy a link to ${title}`}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            onClick={async () => {
              const url = new URL(window.location.href);
              url.hash = anchor(id);
              if (await copyText(url.toString())) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }
            }}
          >
            {copied ? <CopyGlyph copied className="size-3.5" /> : <Link2 size={14} aria-hidden="true" />}
          </button>
        </h2>
        {lead && <p className="mt-1 max-w-[72ch] text-sm leading-relaxed text-muted-foreground">{lead}</p>}
      </div>
      {children}
    </section>
  );
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

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/**
 * The delivery API documented against this workspace: real base URL, real
 * model keys, generated TypeScript, and a one-click brief for an AI coding
 * assistant. Readable by anyone with `cms:read` — it holds no secrets.
 */
export function DocsPanel({ onOpenKeys }: { onOpenKeys?: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const { canManageKeys } = useCmsAccess();
  const typesQuery = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const localesQuery = useQuery({
    queryKey: cmsKeys.locales(tenantId),
    queryFn: () => getCmsLocales(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const [active, setActive] = useState<string>(SECTIONS[0]!.id);

  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data]);
  const locales = useMemo(() => localesQuery.data ?? [], [localesQuery.data]);
  const base = deliveryBase(API_ORIGIN);
  const sample = types.find((type) => type.kind === 'collection') ?? types[0];
  const sampleKey = sample?.key ?? 'blog-post';
  const defaultLocale = locales.find((locale) => locale.isDefault)?.code ?? 'en';
  const prompt = useMemo(() => buildAiPrompt({ apiOrigin: API_ORIGIN, types, locales }), [types, locales]);
  const tsTypes = useMemo(() => typeScriptTypes(types), [types]);

  // Highlight the section being read in the contents rail.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((record) => record.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace('cms-docs-', ''));
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    for (const section of SECTIONS) {
      const element = document.getElementById(anchor(section.id));
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [types.length]);

  const jump = (id: string) => {
    setActive(id);
    document.getElementById(anchor(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const fetchExample = `const res = await fetch(
  \`\${process.env.DUMA_CMS_URL}/entries/${sampleKey}?sort=-publishedAt&limit=10\`,
  { headers: { Authorization: \`Bearer \${process.env.DUMA_CMS_TOKEN}\` } },
);
if (!res.ok) throw new Error(\`DUMA Content \${res.status}\`);
const { data, meta } = await res.json();`;
  const curlExample = `curl "${base}/entries/${sampleKey}?sort=-publishedAt&limit=10" \\
  -H "Authorization: Bearer $DUMA_CMS_TOKEN"`;
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

  const ENDPOINTS: Array<{ path: string; returns: string }> = [
    { path: '/content-types', returns: 'The models this key can read, with their public fields' },
    { path: '/content-types/{typeKey}', returns: 'One model’s schema' },
    { path: '/locales', returns: 'Languages and their fallbacks' },
    { path: '/entries/{typeKey}', returns: 'A page of a collection’s entries' },
    { path: '/entries/{typeKey}/{idOrSlug}', returns: 'One entry, by document id or slug' },
    { path: '/singletons/{typeKey}', returns: 'A singleton’s one entry' },
    { path: '/assets/{id}', returns: 'Media metadata' },
    { path: '/sync', returns: 'What changed since a moment — for mirroring' },
    { path: '/preview/{token}', returns: 'One draft, for a shared preview link' },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      {/* ── Contents: the line rail, by group ── */}
      <nav aria-label="On this page" className="hidden lg:block">
        <div className="sticky top-6 max-h-[calc(100vh-10rem)] space-y-5 overflow-y-auto pb-6">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-label uppercase text-muted-foreground">{group.label}</p>
              <LineNav
                className="py-3.5"
                items={group.sections.map((section) => ({ title: section.label, href: `#${anchor(section.id)}` }))}
                activeHref={`#${anchor(active)}`}
                scrollActiveIntoView={false}
                onItemClick={(item, event) => {
                  event.preventDefault();
                  jump(item.href.replace('#cms-docs-', ''));
                }}
              />
            </div>
          ))}
        </div>
      </nav>

      <article className="min-w-0 max-w-4xl space-y-12">
        {/* ── The front page: what this is, its address, and the two fastest ways in ── */}
        <header className="space-y-5">
          <div>
            <p className="text-label uppercase text-muted-foreground">Developer docs</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-headline text-foreground">DUMA Content API</h1>
            <p className="mt-2 max-w-[66ch] text-sm leading-relaxed text-muted-foreground">
              A read-only REST API for your published content. Everything here is written for this workspace — its address, its models and
              its languages — so the examples work as they are.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-rule/60 bg-control py-1.5 pl-3 pr-1.5">
            <span className="rounded-sm bg-reference/12 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold text-reference">GET</span>
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{base}</code>
            <CopyButton text={base} label="base URL" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="text-primary" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">Connect a project with AI</p>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                A complete brief — endpoints, queries, your models, webhooks — to paste into Claude, Cursor or Copilot. No keys inside.
              </p>
              <CopyButton text={prompt} label="AI prompt" variant="default" className="self-start">
                Copy prompt for AI
              </CopyButton>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-rule/60 bg-control p-4">
              <div className="flex items-center gap-2.5">
                <KeyRound size={16} className="text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">Get a delivery key</p>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                {canManageKeys
                  ? 'Create one in API & webhooks. It is shown once — put it straight into your project’s environment.'
                  : 'Ask someone who manages API keys to create one for your project.'}
              </p>
              {canManageKeys && onOpenKeys ? (
                <Button variant="outline" size="sm" className="gap-1.5 self-start" onClick={onOpenKeys}>
                  <KeyRound size={14} aria-hidden="true" /> Open API keys
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="self-start" onClick={() => jump('authentication')}>
                  How keys work
                </Button>
              )}
            </div>
          </div>

          {/* Narrow screens have no rail: a jump menu instead. */}
          <Select
            ariaLabel="Jump to a section"
            className="w-full lg:hidden"
            value={active}
            onValueChange={jump}
            options={SECTIONS.map((section) => ({ value: section.id, label: section.label }))}
          />
        </header>

        <DocSection id="quickstart" title="Quickstart" lead="Three steps from nothing to content on the page.">
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              { title: 'Create a key', body: 'A delivery key reads published content.' },
              { title: 'Add it to .env', body: 'The URL and key live in the environment, never in the code.' },
              { title: 'Fetch and render', body: 'Ask for a model’s entries and render their fields.' },
            ].map((step, index) => (
              <li key={step.title} className="rounded-lg border border-rule/60 bg-control p-3.5">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <p className="mt-2.5 text-sm font-semibold text-foreground">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          <CodeBlock
            tabs={[
              { label: 'JavaScript', language: 'fetch', code: fetchExample },
              { label: 'cURL', language: 'shell', code: curlExample },
              { label: '.env', language: 'dotenv', code: `DUMA_CMS_URL=${base}\nDUMA_CMS_TOKEN=dcms_live_…` },
            ]}
          />
        </DocSection>

        <DocSection
          id="authentication"
          title="Authentication"
          lead="Every request except a media file needs a key, sent as a bearer token."
        >
          <CodeBlock
            tabs={[
              { label: 'Bearer', language: 'http', code: 'Authorization: Bearer dcms_live_…' },
              { label: 'Header', language: 'http', code: 'X-Api-Key: dcms_live_…' },
            ]}
          />
          <DocTable
            head={['Key', 'Reads', 'Where it may live']}
            rows={[
              [<C key="d">dcms_live_…</C>, 'Published content only', 'Anywhere, including a browser bundle'],
              [<C key="p">dcms_prev_…</C>, 'Drafts too, with status=draft', 'Your server only — never ship it to a browser'],
            ]}
          />
          <Note>
            A key can be limited to some models (others answer 404) and to listed websites (other browser origins get 403). Keys are shown
            once when created; revoking one takes effect within 30 seconds.
          </Note>
        </DocSection>

        <DocSection
          id="endpoints"
          title="Endpoints"
          lead={
            <>
              All are <C>GET</C> under the base URL and return JSON.
            </>
          }
        >
          <ul className="divide-y divide-rule/40 overflow-hidden rounded-lg border border-rule/60 bg-control">
            {ENDPOINTS.map((endpoint) => (
              <li key={endpoint.path} className="group flex items-center gap-3 px-3.5 py-2.5">
                <span className="shrink-0 rounded-sm bg-reference/12 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold text-reference">
                  GET
                </span>
                <span className="min-w-0 flex-1">
                  <code className="block truncate font-mono text-xs font-medium text-foreground">{endpoint.path}</code>
                  <span className="block truncate text-xs text-muted-foreground">{endpoint.returns}</span>
                </span>
                <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <CopyButton text={`${base}${endpoint.path}`} label={`${endpoint.path} URL`} />
                </span>
              </li>
            ))}
          </ul>
        </DocSection>

        <DocSection
          id="querying"
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
              [<C key="st">status</C>, 'draft returns drafts — preview keys only.', <C key="ste">status=draft</C>],
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
          id="responses"
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

        <DocSection id="limits" title="Limits & errors">
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                {
                  icon: RefreshCw,
                  title: 'Cached 30 s',
                  body: 'ETag on every answer — send If-None-Match for a 304. Previews are no-store.',
                },
                {
                  icon: Gauge,
                  title: '~600 / minute',
                  body: 'Per key. Cache on your side: fetch at build or request time, not per render.',
                },
                {
                  icon: ShieldCheck,
                  title: '30 bad keys',
                  body: 'In ten minutes from one address, and it is refused for a while. Check the key before looping.',
                },
              ] satisfies Array<{ icon: IconComponent; title: string; body: string }>
            ).map((item) => (
              <div key={item.title} className="rounded-lg border border-rule/60 bg-control p-3.5">
                <RowTile icon={item.icon} />
                <p className="mt-2.5 text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
          <DocTable
            head={['Status', 'Code', 'When']}
            rows={[
              ['400', <C key="1">invalid_filter</C>, 'A query parameter is wrong — the message says which'],
              ['401', <C key="2">unauthorized</C>, 'Missing, unknown, revoked or expired key'],
              ['403', <C key="3">missing_capability · module_disabled</C>, 'Origin not allowed for this key, or Content is switched off'],
              ['404', <C key="4">not_found</C>, 'No such entry, not published, or model outside the key’s scope'],
              ['429', <C key="5">rate_limited</C>, 'Too many requests — back off and cache'],
            ]}
          />
        </DocSection>

        <DocSection
          id="models"
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
                tabs={[
                  { label: 'TypeScript types', language: `${types.length} ${types.length === 1 ? 'model' : 'models'}`, code: tsTypes },
                ]}
              />
              <p className="text-sm text-muted-foreground">
                For example: <C>{`DumaList<${pascalCase(sampleKey)}Fields>`}</C> for a list response.
              </p>
            </>
          )}
        </DocSection>

        <DocSection
          id="locales"
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
          id="media"
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
            <C>srcset</C> is ready to use, or null when there are none. <C>focalPoint</C> marks the subject — use it as{' '}
            <C>object-position</C> when you crop. The <C>url</C> is a connected bucket’s own CDN address when the workspace stores media
            there.
          </Note>
        </DocSection>

        <DocSection
          id="rich-text"
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
          id="seo"
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
              [
                <C key="6">noIndex · noFollow</C>,
                <C key="6b">{'<meta name="robots" content="noindex, nofollow">'}</C>,
                'Leave the tag out',
              ],
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
          id="preview"
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
            The link comes from the model’s preview URL, so set one on each model. Answers are <C>no-store</C> and <C>noindex</C>; an
            expired or forged token gets <C>401</C>. Don’t cache preview responses.
          </Note>
        </DocSection>

        <DocSection
          id="sync"
          title="Sync"
          lead="Mirror content into a static site without a full rebuild: ask what changed since the last time."
        >
          <CodeBlock
            tabs={[
              {
                label: 'Request',
                language: 'shell',
                code: `curl -H "Authorization: Bearer $DUMA_CMS_TOKEN" "${base}/sync?since=2026-10-01T00:00:00Z&limit=100"`,
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

        <DocSection
          id="webhooks"
          title="Webhooks"
          lead="DUMA can POST to your site when content changes — the usual way to rebuild a static site or revalidate a cache. Add one in API & webhooks."
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
            Each request is signed. Compute <C>v1=</C>HMAC-SHA256 of <C>timestamp + &quot;.&quot; + raw body</C> with the webhook’s secret
            and compare it with <C>X-Duma-Signature</C>; reject anything older than five minutes. Answer 2xx quickly — anything else is
            retried with backoff, up to 8 times.
          </Note>
        </DocSection>
      </article>
    </div>
  );
}
