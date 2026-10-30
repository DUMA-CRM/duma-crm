import Link from 'next/link';

import { Check, Info } from '@/components/icons';
import { TableOfContents } from '@/components/marketing/blog/ReadingAids';
import { CodeBlock } from '@/components/marketing/CodeBlock';
import { SideSignUpCard } from '@/components/marketing/SideSignUpCard';
import { NumberDot } from '@/components/marketing/solution';

import { API_ORIGIN, type DocEndpoint, type DocField } from '@/lib/marketing/developers';
import { cn } from '@/lib/utils/cn';

/**
 * The pieces the developer docs pages are built from, after seline.com/api:
 * the page frame with its "On this page" rail, the sign-up card, parameter
 * lists, inline code and coloured JSON.
 */

export const prose = 'text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]';

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-[4px] border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-1 py-px font-mono text-[0.8125rem] text-foreground">
      {children}
    </code>
  );
}

/** Text with `backtick` spans rendered as inline code — the way the endpoint notes are written. */
export function Ticks({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(`[^`]+`)/g)
        .map((part, index) =>
          part.startsWith('`') && part.endsWith('`') ? (
            <InlineCode key={index}>{part.slice(1, -1)}</InlineCode>
          ) : (
            <span key={index}>{part}</span>
          ),
        )}
    </>
  );
}

export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-20 text-xl font-semibold tracking-display text-[var(--mkt-heading)]">
      {children}
    </h2>
  );
}

/** Seline's small grey note with a square marker. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2.5 text-sm text-[var(--mkt-ink-2)]">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/**
 * A guide's opening, in the marketing site's voice: a large headline with its
 * key phrase under the green highlighter, one paragraph, the actions and a
 * row of ticked facts. The rest of the page stays docs-sized.
 */
export function DocsHero({
  id,
  lead,
  mark,
  actions,
  facts,
  children,
}: {
  id?: string;
  lead: string;
  mark: string;
  actions: React.ReactNode;
  facts: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <header className="pb-4">
      <h1
        id={id}
        className="scroll-mt-20 text-[2.4rem] leading-[1.1] font-semibold tracking-display text-pretty text-[var(--mkt-heading)] sm:text-5xl"
      >
        {lead} <span className="mkt-mark mkt-mark-green rounded-md px-2">{mark}</span>
      </h1>
      <p className="mt-5 max-w-[44rem] text-pretty text-lg leading-relaxed text-[var(--mkt-ink-2)]">{children}</p>
      <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
      <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--mkt-ink-2)]">
        {facts.map((fact) => (
          <span key={fact} className="flex items-center gap-1.5">
            <Check className="size-4 text-primary" aria-hidden="true" />
            {fact}
          </span>
        ))}
      </p>
    </header>
  );
}

/** One numbered step in an <ol>: the marketing site's green number, a hairline down to the next. */
export function SetupStep({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative flex gap-4 pb-10 last:pb-0">
      <span aria-hidden="true" className="absolute top-8 bottom-1 left-3 w-px bg-[var(--mkt-line)] [li:last-child_&]:hidden" />
      <NumberDot n={number} />
      <div className="min-w-0 flex-1">
        <h3 className="text-[1.0625rem] font-semibold text-[var(--mkt-heading)]">
          <span className="sr-only">Step {number}: </span>
          {title}
        </h3>
        {children}
      </div>
    </li>
  );
}

/** Every docs page: the article, and beside it the "On this page" rail. */
export function DocsPage({ toc, children }: { toc: { href: string; label: string; indent?: boolean }[]; children: React.ReactNode }) {
  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_13rem]">
      <article className="min-w-0">{children}</article>
      {/* The blog post's rail: the contents follow your scroll, the shared sign-up card under them. */}
      <aside className="hidden xl:sticky xl:top-8 xl:block xl:self-start" aria-label="On this page">
        <div className="flex flex-col gap-8">
          <TableOfContents
            title="On this page"
            fold={toc.length}
            headings={toc.map((item) => ({ id: item.href.slice(1), text: item.label, depth: item.indent ? 3 : 2 }))}
          />
          <SideSignUpCard body="Store, content and management APIs — one workspace key." className="mt-6" />
        </div>
      </aside>
    </div>
  );
}

/**
 * Parameters as Seline lists them — name, type, a red requirement, then the
 * description and allowed values — in a .mkt-card. Required fields come
 * first; the optional ones follow under a small label, never folded away, so
 * every parameter is on the page and findable.
 */
export function FieldList({ fields }: { fields: DocField[] }) {
  const required = fields.filter((field) => field.required);
  const optional = fields.filter((field) => !field.required);
  return (
    <div className="mkt-card mt-4 overflow-hidden">
      {required.length > 0 && <FieldRows fields={required} />}
      {required.length > 0 && optional.length > 0 && (
        <p className="border-y border-[var(--mkt-line)] bg-[color-mix(in_oklab,var(--mkt-ground)_70%,var(--mkt-card))] px-5 py-2 text-[11px] font-medium tracking-[0.06em] text-[var(--mkt-ink-3)] uppercase">
          Optional
        </p>
      )}
      {optional.length > 0 && <FieldRows fields={optional} />}
    </div>
  );
}

function FieldRows({ fields }: { fields: DocField[] }) {
  return (
    <dl className="divide-y divide-[var(--mkt-line)]">
      {fields.map((field) => (
        <div key={field.name} className="px-5 py-4">
          <dt className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <code className="font-mono text-[0.875rem] font-semibold text-foreground">{field.name}</code>
            <span className="text-xs text-[var(--mkt-ink-3)]">{field.type}</span>
            {field.required && <span className="text-xs text-destructive">Required</span>}
            {field.default && <span className="text-xs text-[var(--mkt-ink-3)]">Default {field.default}</span>}
          </dt>
          {field.description && (
            <dd className="mt-1.5 text-pretty text-sm leading-relaxed text-[var(--mkt-ink-2)]">
              <Ticks text={field.description} />
            </dd>
          )}
          {field.values && field.values.length > 0 && (
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {field.values.map((value) => (
                <InlineCode key={value}>{value}</InlineCode>
              ))}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/** JSON with Seline's colouring: keys in ink, strings red, numbers and booleans blue. */
export function JsonHighlight({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  const parts = text.split(/("(?:\\.|[^"\\])*"(?:\s*:)?|\b-?\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (/^".*"\s*:$/.test(part)) return <span key={index}>{part}</span>;
        if (part.startsWith('"'))
          return (
            <span key={index} className="text-[#c2410c]">
              {part}
            </span>
          );
        if (/^(-?\d|true|false|null)/.test(part))
          return (
            <span key={index} className="text-[#1d4ed8]">
              {part}
            </span>
          );
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

/** The cURL and JavaScript for one endpoint, with the right kind of key and an example body. */
export function requestTabs(endpoint: DocEndpoint) {
  const url = `${API_ORIGIN}${endpoint.fullPath}`;
  const key = endpoint.publishable ? 'dk_pub_…' : 'dk_sec_…';
  const body =
    endpoint.exampleBody !== undefined ? JSON.stringify(endpoint.exampleBody, null, 2) : endpoint.bodyFields.length > 0 ? '{ … }' : null;
  const curl = [
    `curl -X ${endpoint.method} "${url}"`,
    endpoint.scope ? `  -H "Authorization: Bearer ${key}"` : null,
    body ? `  -H "Content-Type: application/json"` : null,
    body ? `  -d '${body}'` : null,
  ]
    .filter(Boolean)
    .join(' \\\n');
  const js = [
    `const response = await fetch('${url}', {`,
    `  method: '${endpoint.method}',`,
    `  headers: {`,
    endpoint.scope ? `    Authorization: 'Bearer ${key}',` : null,
    body ? `    'Content-Type': 'application/json',` : null,
    `  },`,
    body ? `  body: JSON.stringify(${body.replace(/\n/g, '\n  ')}),` : null,
    `});`,
    `if (!response.ok) {`,
    `  throw new Error(\`Request failed: \${response.status}\`);`,
    `}`,
    `const data = response.status === 204 ? null : await response.json();`,
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { id: 'curl', label: 'cURL', code: curl },
    { id: 'js', label: 'JavaScript', code: js },
  ];
}

export function ResponseBlock({ endpoint }: { endpoint: DocEndpoint }) {
  if (endpoint.exampleResponse !== undefined) {
    return (
      <CodeBlock
        label={`Response${endpoint.successStatus ? ` · ${endpoint.successStatus}` : ''}`}
        code={JSON.stringify(endpoint.exampleResponse, null, 2)}
      >
        <JsonHighlight value={endpoint.exampleResponse} />
      </CodeBlock>
    );
  }
  if (endpoint.responses?.length) {
    return (
      <div className="mkt-card overflow-hidden">
        <ul className="divide-y divide-[var(--mkt-line)] text-sm">
          {endpoint.responses.map((response) => (
            <li key={response.status} className="flex items-baseline gap-4 px-5 py-3">
              <span
                className={cn(
                  'flex w-12 shrink-0 items-center gap-1.5 font-mono text-[13px] font-semibold',
                  response.status.startsWith('2') ? 'text-success' : response.status.startsWith('4') || response.status.startsWith('5') ? 'text-destructive' : 'text-[var(--mkt-ink-2)]',
                )}
              >
                {response.status}
              </span>
              <span className="text-[var(--mkt-ink-2)]">{response.description}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
}

export function EndpointLink({ endpoint }: { endpoint: DocEndpoint }) {
  return (
    <Link href={`/developers/${endpoint.slug}`} className="text-primary hover:underline">
      {endpoint.title}
    </Link>
  );
}
