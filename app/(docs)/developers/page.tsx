import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowRight, ArrowUpRight, FileText, KeyRound, Settings, ShieldCheck, ShoppingBag } from '@/components/icons';
import { CodeBlock } from '@/components/marketing/CodeBlock';
import { DocsHero, DocsPage, H2, InlineCode, prose } from '@/components/marketing/docs/parts';
import { ScopeTable } from '@/components/marketing/docs/ScopeTable';
import { SecondaryButton } from '@/components/marketing/sections';
import { buttonVariants } from '@/components/ui/button';

import { API_ORIGIN, RATE_LIMITS, docApis, docEndpoints, docScopes } from '@/lib/marketing/developers';
import { marketingMetadata } from '@/lib/marketing/metadata';

export const metadata: Metadata = marketingMetadata({
  title: 'Public API Overview — DUMA API',
  description:
    'The DUMA public API: the Store API for products, baskets and orders, the Content API for your website, and the management APIs — one workspace key, scoped. Authentication, base URL and rate limits.',
  path: '/developers',
});

const TOC = [
  { href: '#overview', label: 'Overview' },
  { href: '#authentication', label: 'Authentication' },
  { href: '#publishable-key', label: 'Publishable key', indent: true },
  { href: '#secret-key', label: 'Secret key', indent: true },
  { href: '#base-url', label: 'Base URL' },
  { href: '#apis', label: 'APIs' },
  { href: '#rate-limiting', label: 'Rate limiting' },
  { href: '#scopes', label: 'Scopes' },
];

const KEYS = [
  {
    id: 'publishable-key',
    icon: KeyRound,
    title: 'Publishable key',
    prefix: 'dk_pub_…',
    where: 'Browser or app',
    body: 'Safe in a browser or an app. It can only hold read scopes — products, categories and published content.',
  },
  {
    id: 'secret-key',
    icon: ShieldCheck,
    title: 'Secret key',
    prefix: 'dk_sec_…',
    where: 'Server only',
    body: 'For your server only. Orders, newsletter sign-ups, drafts and every management operation need one. A key never gets more than the person who created it could do in DUMA themselves.',
  },
];

/** /developers — the API overview: the MCP page's hero over a docs-sized guide. Every endpoint has its own page. */
export default function DevelopersOverviewPage() {
  const endpoints = docEndpoints();
  const firstOf = (apiId: string) => endpoints.find((e) => e.api === apiId)!;

  return (
    <DocsPage toc={TOC}>
      <DocsHero
        id="overview"
        lead="Build with"
        mark="DUMA."
        facts={[`${endpoints.length} endpoints`, 'HTTPS and JSON', 'One scoped key']}
        actions={
          <>
            <Link href="/settings/developers" className={buttonVariants({ size: 'touch' })}>
              Create an API key <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <SecondaryButton href="/developers/mcp">Connect an AI assistant</SecondaryButton>
          </>
        }
      >
        Connect your storefront, publish content and manage your workspace. One API key, scoped to what your integration needs. Plain HTTPS
        and JSON.
      </DocsHero>

      <section className="pt-12" aria-labelledby="authentication">
        <H2 id="authentication">Authentication</H2>
        <p className={`${prose} mt-3`}>
          Authenticated endpoints accept a workspace API key, as a bearer token in the <InlineCode>Authorization</InlineCode> header (or in{' '}
          <InlineCode>X-Api-Key</InlineCode>
          ):
        </p>
        <CodeBlock
          className="mt-4"
          label="Request"
          code={`curl ${API_ORIGIN}/v1/store/products \\\n  -H "Authorization: Bearer dk_pub_…"`}
        />
        <p className={`${prose} mt-4`}>
          Create keys in DUMA under <strong className="text-foreground">Settings → Developers</strong>. There are two kinds:
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {KEYS.map(({ icon: Icon, ...key }) => (
            <article key={key.id} className="mkt-card flex flex-col px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <Icon className="size-6 text-primary" aria-hidden="true" />
                <span className="mkt-tag">{key.where}</span>
              </div>
              <h3 id={key.id} className="mt-3 flex flex-wrap items-center gap-2 scroll-mt-20 text-xl font-semibold tracking-display">
                {key.title} <InlineCode>{key.prefix}</InlineCode>
              </h3>
              <p className="mt-2 text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">{key.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pt-12" aria-labelledby="base-url">
        <H2 id="base-url">Base URL</H2>
        <p className={`${prose} mt-3`}>All API requests are made to:</p>
        <CodeBlock className="mt-4" label="Base URL" code={API_ORIGIN} />
      </section>

      <section className="pt-12" aria-labelledby="apis">
        <H2 id="apis">APIs</H2>
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {docApis().map((api) => {
            const Icon = api.id === 'store' ? ShoppingBag : api.id === 'content' ? FileText : Settings;
            return (
              <li key={api.id}>
                <Link
                  href={`/developers/${firstOf(api.id).slug}`}
                  className="mkt-card group flex h-full gap-4 px-5 py-5 transition-colors hover:border-[color-mix(in_oklab,var(--ink)_22%,transparent)]"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--mkt-ground)] text-primary">
                    <Icon className="size-[1.125rem]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-semibold text-[var(--mkt-heading)] group-hover:text-primary">
                      {api.name}
                      <ArrowUpRight className="size-4 text-[var(--mkt-ink-3)] group-hover:text-primary" aria-hidden="true" />
                    </span>
                    <code className="mt-1 block font-mono text-[0.8125rem] text-[var(--mkt-ink-2)]">{api.basePath}</code>
                    <span className="mt-2 block text-pretty text-sm leading-relaxed text-[var(--mkt-ink-2)]">{api.summary}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="pt-12" aria-labelledby="rate-limiting">
        <H2 id="rate-limiting">Rate limiting</H2>
        <p className={`${prose} mt-3`}>Requests are rate-limited per key to keep things fair.</p>
        <ul className="mkt-card mt-5 divide-y divide-[var(--mkt-line)]">
          {RATE_LIMITS.map((limit) => (
            <li key={limit.api} className="flex items-baseline justify-between gap-4 px-5 py-3 text-[0.9375rem]">
              <span className="text-[var(--mkt-heading)]">{limit.api}</span>
              <span className="text-[var(--mkt-ink-2)]">
                <span className="font-semibold text-foreground">{limit.perMinute}</span> requests / min per key
              </span>
            </li>
          ))}
        </ul>
        <p className={`${prose} mt-4`}>
          If you go over, you’ll receive a <InlineCode>429 Too Many Requests</InlineCode> response.
        </p>
      </section>

      <section className="pt-12 pb-10" aria-labelledby="scopes">
        <H2 id="scopes">Scopes</H2>
        <p className={`${prose} mt-3`}>A key can only call endpoints its scopes allow. Each endpoint page names the scope it needs.</p>
        <ScopeTable scopes={docScopes()} />
      </section>
    </DocsPage>
  );
}
