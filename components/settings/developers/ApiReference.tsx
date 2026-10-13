'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { RowTile } from '@/components/cms/rows';
import { cmsKeys } from '@/components/cms/shared';
import { Gauge, KeyRound, Plug, RefreshCw, ShieldCheck, Sparkles } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { LineNav } from '@/components/line-nav';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { API_KEY_SCOPES, PUBLIC_APIS, type PublicApi, type PublicApiId, SCOPES, apiBase, publicApi } from '@/lib/developers/api-reference';
import { getCmsContentTypes, getCmsLocales } from '@/lib/modules/cms/client';
import { buildAiPrompt } from '@/lib/utils/cms-docs';
import { buildStorefrontPrompt } from '@/lib/utils/storefront-docs';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { CONTENT_GUIDE_SECTIONS, ContentApiGuide, WEBHOOK_GUIDE_SECTIONS, WebhooksGuide } from './ContentApiGuide';
import { DevelopersNav } from './DevelopersNav';
import { MCP_GUIDE_SECTIONS, McpGuide } from './McpGuide';
import { STORE_GUIDE_SECTIONS, StoreApiGuide } from './StoreApiGuide';
import { API_ORIGIN, C, CodeBlock, DocCopyButton, DocSection, DocTable, EndpointList, MethodBadge, Note, anchor } from './docs-blocks';
import { useDeveloperAccess } from './useDeveloperAccess';

type Section = { id: string; label: string };
type Group = { label: string; sections: readonly Section[] };

const GETTING_STARTED: Group = {
  label: 'Getting started',
  sections: [
    { id: 'quickstart', label: 'Quickstart' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'limits', label: 'Limits & errors' },
  ],
};

/** Each API's prose after its endpoint list. A new API without one still gets its endpoints documented. */
const GUIDE_SECTIONS: Partial<Record<PublicApiId, readonly Section[]>> = {
  content: CONTENT_GUIDE_SECTIONS,
  store: STORE_GUIDE_SECTIONS,
};

/**
 * Settings → Developers → API reference: every public API documented against
 * this workspace — real base URLs, real models, one key. Built from the
 * registry in lib/developers/api-reference.ts, so a new endpoint is one row there.
 */
export function ApiReference() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const access = useDeveloperAccess();
  const typesQuery = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId && access.canReadContent,
  });
  const localesQuery = useQuery({
    queryKey: cmsKeys.locales(tenantId),
    queryFn: () => getCmsLocales(tenantId ?? undefined),
    enabled: !!tenantId && access.canReadContent,
  });
  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data]);
  const locales = useMemo(() => localesQuery.data ?? [], [localesQuery.data]);

  // Content is documented only where it can answer: the module on, and its models readable.
  const apis = PUBLIC_APIS.filter((api) => api.id !== 'content' || access.canReadContent);
  const groups: Group[] = [
    GETTING_STARTED,
    { label: 'AI assistants', sections: MCP_GUIDE_SECTIONS },
    ...apis.map((api) => ({
      label: api.name,
      sections: [{ id: `${api.id}-endpoints`, label: 'Endpoints' }, ...(GUIDE_SECTIONS[api.id] ?? [])],
    })),
    ...(access.canReadContent ? [{ label: 'Webhooks', sections: WEBHOOK_GUIDE_SECTIONS }] : []),
  ];
  const sections = groups.flatMap((group) => group.sections);
  const [active, setActive] = useState<string>(GETTING_STARTED.sections[0]!.id);

  const contentBase = apiBase(API_ORIGIN, publicApi('content'));
  const storeBase = apiBase(API_ORIGIN, publicApi('store'));
  const contentPrompt = useMemo(() => buildAiPrompt({ apiOrigin: API_ORIGIN, types, locales }), [types, locales]);
  const storePrompt = useMemo(() => buildStorefrontPrompt(API_ORIGIN), []);

  // Highlight the section being read in the contents rail.
  const sectionIds = sections.map((section) => section.id).join(',');
  useEffect(() => {
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((record) => record.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id.replace(anchor(''), ''));
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    for (const id of sectionIds.split(',')) {
      const element = document.getElementById(anchor(id));
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [sectionIds, types.length]);

  const jump = (id: string) => {
    setActive(id);
    document.getElementById(anchor(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const sampleKey = (types.find((type) => type.kind === 'collection') ?? types[0])?.key ?? 'blog-post';
  const quickstartTabs = [
    ...(access.canReadContent
      ? [
          {
            label: 'Content',
            language: 'fetch',
            code: `const res = await fetch(\n  \`\${process.env.DUMA_CMS_URL}/entries/${sampleKey}?sort=-publishedAt&limit=10\`,\n  { headers: { Authorization: \`Bearer \${process.env.DUMA_PUBLISHABLE_KEY}\` } },\n);\nif (!res.ok) throw new Error(\`DUMA \${res.status}\`);\nconst { data, meta } = await res.json();`,
          },
        ]
      : []),
    {
      label: 'Store',
      language: 'fetch',
      code: `const res = await fetch(\`\${process.env.DUMA_STORE_URL}/products?limit=24\`, {\n  headers: { Authorization: \`Bearer \${process.env.DUMA_PUBLISHABLE_KEY}\` },\n});\nconst { data } = await res.json();`,
    },
    {
      label: '.env',
      language: 'dotenv',
      code: [
        ...(access.canReadContent ? [`DUMA_CMS_URL=${contentBase}`] : []),
        `DUMA_STORE_URL=${storeBase}`,
        'DUMA_PUBLISHABLE_KEY=dk_pub_…   # safe in a browser: reads content and the catalogue',
        'DUMA_SECRET_KEY=dk_sec_…        # your server only: drafts, orders, sign-ups',
      ].join('\n'),
    },
  ];

  return (
    // The same frame as Keys & webhooks: a left sidebar opening with the view
    // switch — here holding the contents instead of the base URLs — then the page.
    <SettingsTabBody
      narrowAside
      stickyAside
      asideLeft
      aside={
        <>
          <DevelopersNav className="hidden lg:flex" />
          <SettingsSection title="On this page" className="hidden lg:block">
            <nav aria-label="On this page" className="max-h-[calc(100vh-16rem)] space-y-5 overflow-y-auto">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="text-label uppercase text-muted-foreground">{group.label}</p>
                  <LineNav
                    className="py-3.5"
                    items={group.sections.map((section) => ({ title: section.label, href: `#${anchor(section.id)}` }))}
                    activeHref={`#${anchor(active)}`}
                    scrollActiveIntoView={false}
                    onItemClick={(item, event) => {
                      event.preventDefault();
                      jump(item.href.replace(`#${anchor('')}`, ''));
                    }}
                  />
                </div>
              ))}
            </nav>
          </SettingsSection>
        </>
      }
    >
      <article className="min-w-0 space-y-12">
        {/* ── The front page: what this is, where it lives, and the two fastest ways in ── */}
        <header className="space-y-5">
          <DevelopersNav className="lg:hidden" />
          <div>
            <p className="text-label uppercase text-muted-foreground">Developer docs</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-headline text-foreground">DUMA API</h1>
            <p className="mt-2 max-w-[66ch] text-sm leading-relaxed text-muted-foreground">
              REST APIs for your own website or app, all opened by one workspace key. Everything here is written for this workspace — its
              addresses, its models and its languages — so the examples work as they are.
            </p>
          </div>

          <ul className="space-y-2">
            {apis.map((api) => (
              <BaseUrlRow key={api.id} api={api} />
            ))}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="text-primary" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">Connect a project with AI</p>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                Copy a brief for each API — endpoints, rules, errors, your models — into Claude, Cursor or Copilot, or connect the assistant
                to DUMA with MCP so it reads them itself. No keys inside.
              </p>
              <div className="flex flex-wrap gap-2">
                {access.canReadContent && (
                  <DocCopyButton text={contentPrompt} label="Content API prompt" variant="default">
                    Content brief
                  </DocCopyButton>
                )}
                <DocCopyButton text={storePrompt} label="Store API prompt" variant={access.canReadContent ? 'outline' : 'default'}>
                  Store brief
                </DocCopyButton>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => jump('mcp')}>
                  <Plug size={14} aria-hidden="true" /> Connect with MCP
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-rule/60 bg-control p-4">
              <div className="flex items-center gap-2.5">
                <KeyRound size={16} className="text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-semibold text-foreground">Get an API key</p>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                One key per website or app; its scopes decide which APIs it opens. It is shown once — put it straight into the project’s
                environment.
              </p>
              <Button asChild variant="outline" size="sm" className="gap-1.5 self-start">
                <Link href="/settings/developers">
                  <KeyRound size={14} aria-hidden="true" /> Open API keys
                </Link>
              </Button>
            </div>
          </div>

          {/* Narrow screens have no rail: a jump menu instead. */}
          <Select
            ariaLabel="Jump to a section"
            className="w-full lg:hidden"
            value={active}
            onValueChange={jump}
            options={groups.flatMap((group) =>
              group.sections.map((section) => ({ value: section.id, label: `${group.label} · ${section.label}` })),
            )}
          />
        </header>

        <DocSection id="quickstart" title="Quickstart" lead="Three steps from nothing to data on the page.">
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              { title: 'Create a key', body: 'Pick what it may do. A publishable key reads; a secret key also writes.' },
              { title: 'Add it to .env', body: 'The URLs and keys live in the environment, never in the code.' },
              { title: 'Call an API', body: 'Send the key as a bearer token and render what comes back.' },
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
          <CodeBlock tabs={quickstartTabs} />
        </DocSection>

        <DocSection
          id="authentication"
          title="Authentication"
          lead="Every API takes the same workspace key, sent as a bearer token. What a key may do is its scopes."
        >
          <CodeBlock
            tabs={[
              { label: 'Bearer', language: 'http', code: 'Authorization: Bearer dk_pub_…' },
              { label: 'Header', language: 'http', code: 'X-Api-Key: dk_pub_…' },
            ]}
          />
          <DocTable
            head={['Key', 'Can', 'Where it may live']}
            rows={[
              [<C key="p">dk_pub_…</C>, 'Read published content and the catalogue', 'Anywhere, including a browser bundle'],
              [
                <C key="s">dk_sec_…</C>,
                'Anything its scopes allow — drafts, orders, sign-ups',
                'Your server only — never ship it to a browser',
              ],
            ]}
          />
          <DocTable
            head={['Scope', 'Lets a key', 'Publishable']}
            rows={API_KEY_SCOPES.map((scope) => [
              <C key={scope}>{scope}</C>,
              `${SCOPES[scope].label} — ${SCOPES[scope].detail.toLowerCase()}`,
              SCOPES[scope].publishable ? 'Yes' : 'Secret only',
            ])}
          />
          <Note>
            A key can also be limited to some content models (others answer 404) and to listed websites (other browser origins get 403).
            Keys are shown once when created; revoking one takes effect within 30 seconds. Content keys made before keys were unified (
            <C>dcms_live_…</C>, <C>dcms_prev_…</C>) keep working for the Content API until they are revoked.
          </Note>
        </DocSection>

        <DocSection id="limits" title="Limits & errors">
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                {
                  icon: RefreshCw,
                  title: 'Cache on your side',
                  body: 'Content answers carry an ETag — send If-None-Match for a 304. Cache the catalogue for 30–60 s.',
                },
                { icon: Gauge, title: '~600 / minute', body: 'Per key. Fetch at build or request time, not per render.' },
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
              ['400', <C key="1">invalid_filter · validation_failed</C>, 'A parameter or body is wrong — the message says which'],
              ['401', <C key="2">unauthorized</C>, 'Missing, unknown, revoked or expired key'],
              [
                '403',
                <C key="3">missing_capability · module_disabled</C>,
                'The key lacks the scope (the answer names it), the website isn’t allowed, or the module is off',
              ],
              ['404', <C key="4">not_found</C>, 'No such thing, not published, or outside the key’s content models'],
              ['429', <C key="5">rate_limited</C>, 'Too many requests — back off and cache'],
            ]}
          />
        </DocSection>

        <McpGuide />

        {apis.map((api) => (
          <ApiSections key={api.id} api={api}>
            {api.id === 'content' ? (
              <ContentApiGuide base={contentBase} types={types} locales={locales} />
            ) : api.id === 'store' ? (
              <StoreApiGuide base={storeBase} />
            ) : null}
          </ApiSections>
        ))}

        {access.canReadContent && <WebhooksGuide base={contentBase} types={types} locales={locales} />}

        {!access.canReadContent && access.contentOn === false && (
          <Note>The Content API is documented here once the Content module is switched on, in Settings → Modules.</Note>
        )}
      </article>
    </SettingsTabBody>
  );
}

/** An API's endpoint list, then its guide. */
function ApiSections({ api, children }: { api: PublicApi; children: React.ReactNode }) {
  const base = apiBase(API_ORIGIN, api);
  return (
    <>
      <DocSection
        id={`${api.id}-endpoints`}
        title={`${api.name} endpoints`}
        lead={
          <>
            {api.summary} Under <C>{base}</C>; each needs a key with the scope shown.
          </>
        }
      >
        <EndpointList base={base} endpoints={api.endpoints} />
      </DocSection>
      {children}
    </>
  );
}

function BaseUrlRow({ api }: { api: PublicApi }) {
  const base = apiBase(API_ORIGIN, api);
  const methods = [...new Set(api.endpoints.map((endpoint) => endpoint.method))];
  return (
    <li className="flex items-center gap-2 rounded-lg border border-rule/60 bg-control py-1.5 pl-3 pr-1.5">
      <span className="w-24 shrink-0 text-xs font-semibold text-foreground">{api.name}</span>
      <span className="hidden shrink-0 gap-1 sm:flex">
        {methods.map((method) => (
          <MethodBadge key={method} method={method} />
        ))}
      </span>
      <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{base}</code>
      <DocCopyButton text={base} label={`${api.name} base URL`} />
    </li>
  );
}
