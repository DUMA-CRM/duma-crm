'use client';

import { useQuery } from '@tanstack/react-query';
import { type Token, type Tokens, marked } from 'marked';
import { Fragment, type ReactNode, createContext, useContext, useMemo } from 'react';

import { AlertCircle, AlertTriangle, type IconComponent, Info, Megaphone, Play } from '@/components/icons';

import { getCmsAssets } from '@/lib/modules/cms/client';
import { safeHref, safeImageSrc } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { type CalloutKind, calloutKind, videoEmbed } from '@/lib/utils/markdown-edit';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { assetPreviewSrc, assetSrc, cmsKeys } from './shared';

// ---------------------------------------------------------------------------
// Full GitHub-flavoured Markdown preview for rich-text fields.
//
// `marked` only tokenises; every token is rendered here as a React element.
// Nothing reaches dangerouslySetInnerHTML, so tenant-written content cannot
// run script inside the CRM: raw HTML is shown as text, and links and images
// pass the same allow-list the delivery docs tell websites to use.
//
// The shared `components/shared/Markdown` stays the small renderer for support
// articles and the agent; this one is for content that will be published.
// ---------------------------------------------------------------------------

const lexer = (markdown: string) => marked.lexer(markdown, { gfm: true, breaks: false });

function inline(tokens: readonly Token[] | undefined, key: string): ReactNode {
  if (!tokens) return null;
  return tokens.map((token, index) => <Fragment key={`${key}-${index}`}>{inlineToken(token, `${key}-${index}`)}</Fragment>);
}

function inlineToken(token: Token, key: string): ReactNode {
  switch (token.type) {
    case 'text': {
      const text = token as Tokens.Text;
      return text.tokens ? inline(text.tokens, key) : text.text;
    }
    case 'escape':
      return (token as Tokens.Escape).text;
    case 'strong':
      return <strong className="font-semibold text-foreground">{inline((token as Tokens.Strong).tokens, key)}</strong>;
    case 'em':
      return <em>{inline((token as Tokens.Em).tokens, key)}</em>;
    case 'del':
      return <del className="text-muted-foreground">{inline((token as Tokens.Del).tokens, key)}</del>;
    case 'codespan':
      return (
        <code className="rounded-sm bg-band px-1 py-0.5 font-mono text-[0.9em] text-foreground">{(token as Tokens.Codespan).text}</code>
      );
    case 'br':
      return <br />;
    case 'link': {
      const link = token as Tokens.Link;
      const href = safeHref(link.href);
      const children = inline(link.tokens, key);
      if (!href)
        return (
          <span className="underline decoration-exception decoration-dotted" title="Unsafe link — it will not be clickable">
            {children}
          </span>
        );
      const external = /^https?:/i.test(href);
      return (
        <a
          href={href}
          title={link.title ?? undefined}
          className="font-medium text-reference underline decoration-1 underline-offset-2 hover:decoration-2"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {children}
        </a>
      );
    }
    case 'image': {
      const image = token as Tokens.Image;
      const src = safeImageSrc(image.href);
      if (!src) return <span className="text-xs text-exception">[image not shown: {image.text || 'unsafe source'}]</span>;
      return <PreviewImage key={key} src={src} alt={image.text} title={image.title ?? undefined} />;
    }
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={(token as Tokens.Checkbox).checked}
          readOnly
          disabled
          className="mr-1.5 align-middle"
          aria-label={(token as Tokens.Checkbox).checked ? 'Done' : 'Not done'}
        />
      );
    case 'html':
      // Raw HTML is shown, never interpreted.
      return <code className="font-mono text-[0.9em] text-muted-foreground">{(token as Tokens.HTML).text}</code>;
    default:
      return 'raw' in token ? String(token.raw) : null;
  }
}

const HEADING_CLASS: Record<number, string> = {
  1: 'mt-6 text-2xl font-semibold tracking-title first:mt-0',
  2: 'mt-6 border-b border-rule/50 pb-1 text-xl font-semibold tracking-title first:mt-0',
  3: 'mt-5 text-lg font-semibold first:mt-0',
  4: 'mt-4 text-base font-semibold first:mt-0',
  5: 'mt-4 text-sm font-semibold first:mt-0',
  6: 'mt-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground first:mt-0',
};

function blocks(tokens: readonly Token[], key: string): ReactNode {
  return tokens.map((token, index) => <Fragment key={`${key}-${index}`}>{block(token, `${key}-${index}`)}</Fragment>);
}

function block(token: Token, key: string): ReactNode {
  switch (token.type) {
    case 'space':
    case 'def':
      return null;
    case 'checkbox':
      // In a task list item the checkbox arrives as a block token of its own.
      return inlineToken(token, key);
    case 'heading': {
      const heading = token as Tokens.Heading;
      const Tag = `h${heading.depth}` as 'h1';
      return <Tag className={cn('text-foreground', HEADING_CLASS[heading.depth])}>{inline(heading.tokens, key)}</Tag>;
    }
    case 'paragraph': {
      const paragraph = token as Tokens.Paragraph;
      // A paragraph that is only a YouTube/Vimeo URL is a video, as on most site generators.
      const video = videoEmbed(paragraph.text);
      if (video) return <VideoCard key={key} provider={video.provider} url={video.url} />;
      return <p className="my-3 leading-7 first:mt-0 last:mb-0">{inline(paragraph.tokens, key)}</p>;
    }
    case 'text': {
      // Block-level text: the content of a tight list item.
      const text = token as Tokens.Text;
      return text.tokens ? inline(text.tokens, key) : text.text;
    }
    case 'hr':
      return <hr className="my-6 border-rule/60" />;
    case 'blockquote': {
      const quote = token as Tokens.Blockquote;
      const [first = '', ...rest] = quote.text.split('\n');
      const kind = calloutKind(first);
      if (kind) return <Callout key={key} kind={kind} body={blocks(lexer(rest.join('\n')), `${key}-c`)} />;
      return <blockquote className="my-4 border-l-2 border-primary/50 pl-4 text-muted-foreground">{blocks(quote.tokens, key)}</blockquote>;
    }
    case 'code': {
      const code = token as Tokens.Code;
      return (
        <div className="my-4 overflow-hidden rounded-md border border-rule/60 bg-band/50">
          {code.lang && <div className="border-b border-rule/50 px-3 py-1 font-mono text-xs text-muted-foreground">{code.lang}</div>}
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-5 text-foreground">
            <code>{code.text}</code>
          </pre>
        </div>
      );
    }
    case 'list': {
      const list = token as Tokens.List;
      const isTask = list.items.some((item) => item.task);
      const listClass = cn(
        'my-3 space-y-1 pl-6',
        isTask && 'list-none pl-1',
        !isTask && (list.ordered ? 'list-decimal' : 'list-disc'),
        'marker:text-muted-foreground',
      );
      const items = list.items.map((item, index) => (
        <li
          key={`${key}-${index}`}
          className={cn('leading-7', item.task && 'flex items-baseline gap-0', item.task && item.checked && 'text-muted-foreground')}
        >
          <span className={cn(item.task && 'flex-1', list.loose && '[&>p]:my-2')}>{blocks(item.tokens, `${key}-${index}`)}</span>
        </li>
      ));
      return list.ordered ? (
        <ol className={listClass} start={typeof list.start === 'number' && list.start !== 1 ? list.start : undefined}>
          {items}
        </ol>
      ) : (
        <ul className={listClass}>{items}</ul>
      );
    }
    case 'table': {
      const table = token as Tokens.Table;
      const align = (index: number) => {
        const value = table.align[index];
        return value === 'center' ? 'text-center' : value === 'right' ? 'text-right' : 'text-left';
      };
      return (
        <div className="my-4 overflow-x-auto rounded-md border border-rule/60">
          <table className="w-full text-sm">
            <thead className="border-b border-rule/60 bg-band/50">
              <tr>
                {table.header.map((cell, index) => (
                  <th key={index} className={cn('px-3 py-2 font-semibold text-foreground', align(index))}>
                    {inline(cell.tokens, `${key}-h${index}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/40">
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td key={index} className={cn('px-3 py-2', align(index))}>
                      {inline(cell.tokens, `${key}-${rowIndex}-${index}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'html':
      // Raw HTML blocks are shown as source, never rendered.
      return (
        <pre className="my-3 overflow-x-auto rounded-md border border-dashed border-rule/70 p-2.5 font-mono text-xs text-muted-foreground">
          {(token as Tokens.HTML).text}
        </pre>
      );
    default:
      return 'tokens' in token && Array.isArray(token.tokens) ? inline(token.tokens as Token[], key) : null;
  }
}

/** Renders Markdown exactly as the rich-text field will be read — GFM, safely. */
/** Image URLs in the text that point at a public bucket — the ones the CSP would refuse. */
function foreignImageUrls(tokens: readonly Token[]): string[] {
  const found = new Set<string>();
  marked.walkTokens(tokens as Token[], (token) => {
    if (token.type !== 'image') return;
    const href = (token as Tokens.Image).href;
    if (/^https?:\/\//i.test(href) && assetSrc(href) === href) found.add(href);
  });
  return [...found].slice(0, 20);
}

/** Bucket URL → the asset behind it, so the preview can load it through `/be`. */
const ImageResolver = createContext<Map<string, { id: string; updatedAt: string }>>(new Map());

function PreviewImage({ src, alt, title }: { src: string; alt: string; title?: string }) {
  const resolved = useContext(ImageResolver).get(src);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- author-supplied media, not a static asset
    <img
      src={resolved ? assetPreviewSrc(resolved) : assetSrc(src)}
      alt={alt}
      title={title}
      loading="lazy"
      className="my-2 inline-block max-h-96 max-w-full rounded-md border border-rule/50"
    />
  );
}

export function RichTextPreview({ markdown, className }: { markdown: string; className?: string }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const tokens = useMemo(() => lexer(markdown), [markdown]);
  // Images on a connected bucket's own domain are refused by this app's CSP;
  // look up which assets they are and show them through the API instead.
  const urls = useMemo(() => foreignImageUrls(tokens), [tokens]);
  const lookup = useQuery({
    queryKey: cmsKeys.assets(tenantId, { urls }),
    queryFn: () => getCmsAssets({ urls: urls.join(',') }, tenantId ?? undefined),
    enabled: !!tenantId && urls.length > 0,
    staleTime: 60_000,
  });
  const resolver = useMemo(() => {
    const map = new Map<string, { id: string; updatedAt: string }>();
    for (const asset of lookup.data?.data ?? []) map.set(asset.url, asset);
    return map;
  }, [lookup.data]);
  return (
    <ImageResolver.Provider value={resolver}>
      <div className={cn('text-sm text-foreground/90 [overflow-wrap:anywhere]', className)}>{blocks(tokens, 'md')}</div>
    </ImageResolver.Provider>
  );
}

const CALLOUTS: Record<CalloutKind, { label: string; icon: IconComponent; tone: string }> = {
  NOTE: { label: 'Note', icon: Info, tone: 'border-reference/40 bg-reference/6 [--callout:var(--reference)]' },
  TIP: { label: 'Tip', icon: Megaphone, tone: 'border-momentum/40 bg-momentum/6 [--callout:var(--momentum)]' },
  IMPORTANT: { label: 'Important', icon: AlertCircle, tone: 'border-primary/40 bg-primary/6 [--callout:var(--primary)]' },
  WARNING: { label: 'Warning', icon: AlertTriangle, tone: 'border-measured/40 bg-measured/6 [--callout:var(--measured)]' },
  CAUTION: { label: 'Caution', icon: AlertTriangle, tone: 'border-exception/40 bg-exception/6 [--callout:var(--exception)]' },
};

/** GitHub's `> [!NOTE]` alerts: a hairline box in the kind's role colour, its name and icon leading. */
function Callout({ kind, body }: { kind: CalloutKind; body: ReactNode }) {
  const meta = CALLOUTS[kind];
  return (
    <aside className={cn('my-4 rounded-md border px-4 py-3', meta.tone)} aria-label={meta.label}>
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--callout)]">
        <meta.icon size={15} aria-hidden="true" /> {meta.label}
      </p>
      <div className="text-sm text-foreground [&>*:last-child]:mb-0">{body}</div>
    </aside>
  );
}

/**
 * A video stands in as a card: the CRM's CSP allows no third-party frames or
 * images, and the preview should not call YouTube on every keystroke. The
 * website embeds the real player from the same URL.
 */
function VideoCard({ provider, url }: { provider: 'youtube' | 'vimeo'; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="my-4 flex items-center gap-3 rounded-md border border-rule/60 bg-band/50 px-4 py-3 no-underline hover:border-rule"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
        <Play size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{provider === 'youtube' ? 'YouTube video' : 'Vimeo video'}</span>
        <span className="block truncate text-xs text-muted-foreground">{url}</span>
      </span>
    </a>
  );
}
