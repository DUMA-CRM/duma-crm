'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { cmsKeys } from '@/components/cms/shared';
import { ArrowLeft } from '@/components/icons';
import { LineNav } from '@/components/line-nav';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { API_KEY_SCOPES, PUBLIC_APIS, type PublicApiId, SCOPES, apiBase, isContentApi, publicApi } from '@/lib/developers/api-reference';
import { getCmsContentTypes, getCmsLocales } from '@/lib/modules/cms/client';
import { buildAiPrompt } from '@/lib/utils/cms-docs';
import { buildStorefrontPrompt } from '@/lib/utils/storefront-docs';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { CONTENT_GUIDE_SECTIONS, ContentApiGuide, WEBHOOK_GUIDE_SECTIONS, WebhooksGuide } from './ContentApiGuide';
import { MANAGE_GUIDE_SECTIONS, ManageApiGuide } from './ManageApiGuide';
import { MCP_GUIDE_SECTIONS, McpGuide } from './McpGuide';
import { STORE_GUIDE_SECTIONS, StoreApiGuide } from './StoreApiGuide';
import { API_ORIGIN, C, CodeBlock, DocCopyButton, DocSection, DocTable, EndpointList, Note, anchor } from './docs-blocks';
import { CopyRow } from './rows';
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
  manage: MANAGE_GUIDE_SECTIONS,
  store: STORE_GUIDE_SECTIONS,
};

/**
 * Settings → Developers → API reference: every public API documented against
 * this workspace — real base URLs, real models, one key — rendered here, in
 * DUMA's own sections, rather than in an embedded explorer. Built from the
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
  const apis = PUBLIC_APIS.filter((api) => !isContentApi(api.id) || access.canReadContent);
  const groups: Group[] = [
    GETTING_STARTED,
    ...apis.map((api) => ({
      label: api.name,
      sections: [{ id: `${api.id}-endpoints`, label: 'Endpoints' }, ...(GUIDE_SECTIONS[api.id] ?? [])],
    })),
    { label: 'AI assistants', sections: MCP_GUIDE_SECTIONS },
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
    // Contents on the left, kept in view; the reference in DUMA's own sections beside it.
    <SettingsTabBody
      narrowAside
      stickyAside
      asideLeft
      aside={
        <SettingsSection className="hidden lg:block" bodyClassName="pt-4">
          <Link
            href="/settings/developers"
            className="-mx-2 mb-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-foreground hover:bg-band/50"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Keys &amp; webhooks
          </Link>
          <nav aria-label="On this page" className="max-h-[calc(100vh-16rem)] space-y-4 overflow-y-auto">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-label uppercase text-muted-foreground">{group.label}</p>
                <LineNav
                  className="py-2.5"
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
      }
    >
      {/* Narrow screens have no rail: the way back and a jump menu instead. */}
      <div className="flex items-center gap-2 lg:hidden">
        <Button asChild variant="outline" size="icon-sm" aria-label="Back to keys and webhooks">
          <Link href="/settings/developers">
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
        <Select
          ariaLabel="Jump to a section"
          className="min-w-0 flex-1"
          value={active}
          onValueChange={jump}
          options={groups.flatMap((group) =>
            group.sections.map((section) => ({ value: section.id, label: `${group.label} · ${section.label}` })),
          )}
        />
      </div>

      <DocSection
        id="quickstart"
        title="Quickstart"
        lead="Make a key, put it in your environment, and send it as a bearer token. Everything here uses this workspace’s addresses, so the examples work as they are."
      >
        <CodeBlock tabs={quickstartTabs} />
      </DocSection>

      <DocSection
        id="authentication"
        title="Authentication"
        lead="Every API takes the same workspace key, sent as a bearer token. What a key may do is its permissions."
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
            [<C key="p">dk_pub_…</C>, 'Read published content and the catalogue', 'Anywhere, including a browser'],
            [<C key="s">dk_sec_…</C>, 'Whatever its permissions allow', 'Your server only'],
          ]}
        />
        <details>
          <summary className="cursor-pointer text-sm font-medium text-foreground">Every permission</summary>
          <div className="mt-3">
            <DocTable
              head={['Permission', 'Lets a key', 'Publishable']}
              rows={API_KEY_SCOPES.map((scope) => [
                <C key={scope}>{scope}</C>,
                `${SCOPES[scope].label} — ${SCOPES[scope].detail.toLowerCase()}`,
                SCOPES[scope].publishable ? 'Yes' : 'Secret only',
              ])}
            />
          </div>
        </details>
      </DocSection>

      <DocSection
        id="limits"
        title="Limits & errors"
        lead="About 600 requests a minute per key. Cache on your side — content answers carry an ETag for a 304."
      >
        <DocTable
          head={['Status', 'Code', 'When']}
          rows={[
            ['400', <C key="1">invalid_filter · validation_failed</C>, 'A parameter or body is wrong — the message says which'],
            ['401', <C key="2">unauthorized</C>, 'Missing, unknown, revoked or expired key'],
            [
              '403',
              <C key="3">missing_capability · module_disabled</C>,
              'The key lacks the permission, the website isn’t allowed, or the module is off',
            ],
            ['404', <C key="4">not_found</C>, 'No such thing, not published, or outside the key’s content types'],
            ['429', <C key="5">rate_limited</C>, 'Too many requests — back off and cache'],
          ]}
        />
      </DocSection>

      {apis.map((api) => {
        const base = apiBase(API_ORIGIN, api);
        return (
          <Fragment key={api.id}>
            <DocSection id={`${api.id}-endpoints`} title={api.name} lead={api.summary}>
              <CopyRow label="Base URL" value={base} />
              <EndpointList base={base} endpoints={api.endpoints} />
            </DocSection>
            {api.id === 'content' ? (
              <ContentApiGuide base={contentBase} types={types} locales={locales} />
            ) : api.id === 'manage' ? (
              <ManageApiGuide base={base} />
            ) : api.id === 'store' ? (
              <StoreApiGuide base={storeBase} />
            ) : null}
          </Fragment>
        );
      })}

      {access.canReadContent && <WebhooksGuide base={contentBase} types={types} locales={locales} />}

      <McpGuide
        briefs={
          <>
            {access.canReadContent && (
              <DocCopyButton text={contentPrompt} label="Content API brief" variant="outline">
                Copy Content brief
              </DocCopyButton>
            )}
            <DocCopyButton text={storePrompt} label="Store API brief" variant="outline">
              Copy Store brief
            </DocCopyButton>
          </>
        }
      />

      {!access.canReadContent && access.contentOn === false && (
        <Note>The Content API is documented here once the Content module is switched on, in Settings → Modules.</Note>
      )}
    </SettingsTabBody>
  );
}
