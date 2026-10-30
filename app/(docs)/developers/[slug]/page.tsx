import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft, ArrowRight, KeyRound, ShieldCheck, TriangleAlert } from '@/components/icons';
import { CodeBlock, CopyIconButton } from '@/components/marketing/CodeBlock';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MethodLabel } from '@/components/marketing/docs/DocsSidebar';
import { DocsPage, FieldList, H2, InlineCode, Note, ResponseBlock, Ticks, prose, requestTabs } from '@/components/marketing/docs/parts';

import { API_ORIGIN, type DocEndpoint, docEndpoint, docEndpoints } from '@/lib/marketing/developers';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema } from '@/lib/marketing/schema';
import { cn } from '@/lib/utils/cn';

/** One page per public endpoint, all built ahead of time; any other slug is a 404. */
export function generateStaticParams() {
  return docEndpoints().map((endpoint) => ({ slug: endpoint.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const endpoint = docEndpoint((await params).slug);
  if (!endpoint) return {};
  return marketingMetadata({
    title: `${endpoint.title} — ${endpoint.apiName} — DUMA API`,
    description: `${endpoint.method} ${endpoint.fullPath}. ${endpoint.description}`.slice(0, 300),
    path: `/developers/${endpoint.slug}`,
  });
}

// Written out in full so Tailwind sees every class — the sidebar's method colours, as a tint.
const METHOD_TINT: Record<string, string> = {
  GET: 'bg-success/10',
  POST: 'bg-reference/10',
  PUT: 'bg-stock/10',
  PATCH: 'bg-stock/10',
  DELETE: 'bg-destructive/10',
};

/** The previous or next endpoint in the sidebar's order, as a card. */
function PagerLink({ endpoint, direction }: { endpoint: DocEndpoint; direction: 'previous' | 'next' }) {
  const next = direction === 'next';
  return (
    <Link
      href={`/developers/${endpoint.slug}`}
      className={cn(
        'mkt-card group flex flex-col gap-1 px-5 py-4 transition-colors hover:border-[color-mix(in_oklab,var(--ink)_22%,transparent)]',
        next && 'sm:col-start-2 sm:items-end sm:text-right',
      )}
    >
      <span className="flex items-center gap-1.5 text-xs text-[var(--mkt-ink-3)]">
        {!next && <ArrowLeft className="size-3.5" aria-hidden="true" />}
        {next ? 'Next' : 'Previous'}
        {next && <ArrowRight className="size-3.5" aria-hidden="true" />}
      </span>
      <span className="flex items-baseline gap-2 font-medium text-[var(--mkt-heading)] group-hover:text-primary">
        <MethodLabel method={endpoint.method} />
        {endpoint.title}
      </span>
    </Link>
  );
}

/** An endpoint reference: the docs hero's grammar at reference size, then example, parameters and response. */
export default async function EndpointPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const endpoint = docEndpoint(slug);
  if (!endpoint) notFound();

  const all = docEndpoints();
  const index = all.findIndex((e) => e.slug === endpoint.slug);
  const previous = all[index - 1];
  const next = all[index + 1];
  const hasParams = endpoint.pathParams.length + endpoint.queryParams.length + endpoint.bodyFields.length > 0;
  const hasResponse = endpoint.exampleResponse !== undefined || Boolean(endpoint.responses?.length);

  const toc = [
    { href: '#endpoint', label: endpoint.title },
    { href: '#example', label: 'Request example' },
    ...(endpoint.pathParams.length ? [{ href: '#path-parameters', label: 'Path parameters' }] : []),
    ...(endpoint.queryParams.length ? [{ href: '#query-parameters', label: 'Query parameters' }] : []),
    ...(endpoint.bodyFields.length ? [{ href: '#body', label: 'Request body' }] : []),
    ...(hasResponse ? [{ href: '#response', label: 'Response' }] : []),
  ];

  const facts = [
    endpoint.scope
      ? { icon: KeyRound, text: <InlineCode>{endpoint.scope}</InlineCode> }
      : { icon: KeyRound, text: 'No key needed — the link itself is the permission' },
    ...(endpoint.scope ? [{ icon: ShieldCheck, text: endpoint.publishable ? 'Publishable or secret key' : 'Secret key only' }] : []),
    ...(endpoint.destructive ? [{ icon: TriangleAlert, text: 'Cannot be undone', danger: true }] : []),
  ];

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Public API', path: '/developers' },
          { name: endpoint.title, path: `/developers/${endpoint.slug}` },
        ])}
      />
      <DocsPage toc={toc}>
        <header>
          <h1
            id="endpoint"
            className="scroll-mt-20 text-[2rem] leading-[1.15] font-semibold tracking-display text-pretty text-[var(--mkt-heading)] sm:text-4xl"
          >
            {endpoint.title}
          </h1>
          <p className={`${prose} mt-4 max-w-[44rem] text-[1.0625rem]`}>
            <Ticks text={endpoint.description} />
          </p>

          <div className="mkt-card mt-6 flex items-stretch overflow-hidden">
            <span className={cn('grid place-items-center border-r border-[var(--mkt-line)] px-3.5', METHOD_TINT[endpoint.method])}>
              <MethodLabel method={endpoint.method} className="text-[11px]" />
            </span>
            <code className="min-w-0 flex-1 overflow-x-auto px-3.5 py-3 font-mono text-[0.8125rem] whitespace-nowrap">
              <span className="text-[var(--mkt-ink-3)]">{API_ORIGIN}</span>
              {endpoint.fullPath}
            </code>
            <span className="flex items-center pr-1.5">
              <CopyIconButton text={`${API_ORIGIN}${endpoint.fullPath}`} label="URL" />
            </span>
          </div>

          <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--mkt-ink-2)]">
            {facts.map(({ icon: Icon, text, danger }, i) => (
              <span key={i} className={cn('flex items-center gap-1.5', danger && 'text-destructive')}>
                <Icon className={cn('size-4', danger ? 'text-destructive' : 'text-primary')} aria-hidden="true" />
                {text}
              </span>
            ))}
          </p>

          {endpoint.notes.length > 0 && (
            <div className="mt-5 flex flex-col gap-2">
              {endpoint.notes.map((note) => (
                <Note key={note}>
                  <Ticks text={note} />
                </Note>
              ))}
            </div>
          )}
        </header>

        <section className="pt-12" aria-labelledby="example">
          <H2 id="example">Request example</H2>
          <CodeBlock className="mt-4" label="Example request" tabs={requestTabs(endpoint)} />
        </section>

        {endpoint.pathParams.length > 0 && (
          <section className="pt-12" aria-labelledby="path-parameters">
            <H2 id="path-parameters">Path parameters</H2>
            <FieldList fields={endpoint.pathParams} />
          </section>
        )}
        {endpoint.queryParams.length > 0 && (
          <section className="pt-12" aria-labelledby="query-parameters">
            <H2 id="query-parameters">Query parameters</H2>
            <FieldList fields={endpoint.queryParams} />
          </section>
        )}
        {endpoint.bodyFields.length > 0 && (
          <section className="pt-12" aria-labelledby="body">
            <H2 id="body">Request body</H2>
            <p className={`${prose} mt-3`}>
              JSON, sent with <InlineCode>Content-Type: application/json</InlineCode>.
            </p>
            <FieldList fields={endpoint.bodyFields} />
          </section>
        )}
        {!hasParams && <p className={`${prose} pt-8`}>This endpoint takes no parameters.</p>}

        {hasResponse && (
          <section className="pt-12" aria-labelledby="response">
            <H2 id="response">Response</H2>
            <div className="mt-4">
              <ResponseBlock endpoint={endpoint} />
            </div>
          </section>
        )}

        {(previous || next) && (
          <nav aria-label="More endpoints" className="mt-16 grid gap-4 border-t border-[var(--mkt-line)] pt-8 pb-10 sm:grid-cols-2">
            {previous && <PagerLink endpoint={previous} direction="previous" />}
            {next && <PagerLink endpoint={next} direction="next" />}
          </nav>
        )}
      </DocsPage>
    </>
  );
}
