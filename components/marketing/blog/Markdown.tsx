import Link from 'next/link';
import { type Token, type Tokens, marked } from 'marked';
import { Fragment, type ReactNode } from 'react';

import { headingIds, inlineText } from '@/lib/utils/blog';
import { safeHref, safeImageSrc } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { type CalloutKind, calloutKind, videoEmbed } from '@/lib/utils/markdown-edit';

/**
 * A blog post's body — the CMS's GitHub-flavoured Markdown — as semantic HTML,
 * on the server. It reads the same syntax the CMS editor's preview does
 * (components/cms/RichTextPreview.tsx): `> [!TIP]` callouts, a paragraph that
 * is only a YouTube or Vimeo link becomes the video, task lists and tables.
 *
 * Raw HTML is shown as text and never interpreted, and links and images pass
 * the same safety checks as the editor — a post can't inject script.
 * Headings get the anchors extractHeadings() gives the table of contents.
 */

const CALLOUT: Record<CalloutKind, { label: string; className: string }> = {
  NOTE: { label: 'Note', className: 'border-reference/40 bg-reference/5' },
  TIP: { label: 'Tip', className: 'border-success/40 bg-success-highlight' },
  IMPORTANT: { label: 'Important', className: 'border-primary/40 bg-primary/5' },
  WARNING: { label: 'Warning', className: 'border-stock/50 bg-stock/10' },
  CAUTION: { label: 'Caution', className: 'border-destructive/40 bg-destructive/5' },
};

function inline(tokens: readonly Token[] | undefined, key: string): ReactNode {
  return (tokens ?? []).map((token, index) => <Fragment key={`${key}-${index}`}>{inlineToken(token, `${key}-${index}`)}</Fragment>);
}

function inlineToken(token: Token, key: string): ReactNode {
  switch (token.type) {
    case 'text': {
      const text = token as Tokens.Text;
      return text.tokens?.length ? inline(text.tokens, key) : text.text;
    }
    case 'escape':
      return (token as Tokens.Escape).text;
    case 'strong':
      return <strong className="font-semibold text-foreground">{inline((token as Tokens.Strong).tokens, key)}</strong>;
    case 'em':
      return <em>{inline((token as Tokens.Em).tokens, key)}</em>;
    case 'del':
      return <del>{inline((token as Tokens.Del).tokens, key)}</del>;
    case 'codespan':
      return <code className="rounded-[4px] border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-1 py-px font-mono text-[0.85em] text-foreground">{(token as Tokens.Codespan).text}</code>;
    case 'br':
      return <br />;
    case 'link': {
      const link = token as Tokens.Link;
      const href = safeHref(link.href);
      const children = inline(link.tokens, key);
      if (!href) return children;
      const className = 'font-medium text-primary underline decoration-1 underline-offset-2 hover:decoration-2';
      if (/^https?:/i.test(href))
        return (
          <a href={href} title={link.title ?? undefined} className={className} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      return (
        <Link href={href} title={link.title ?? undefined} className={className}>
          {children}
        </Link>
      );
    }
    case 'image': {
      const image = token as Tokens.Image;
      const src = safeImageSrc(image.href);
      if (!src) return null;
      // eslint-disable-next-line @next/next/no-img-element -- a body image has no known size; a figure keeps it responsive.
      return <img src={src} alt={image.text} title={image.title ?? undefined} loading="lazy" decoding="async" className="rounded-[10px] border border-[var(--mkt-line)]" />;
    }
    case 'checkbox':
      return <input type="checkbox" checked={(token as Tokens.Checkbox).checked} readOnly disabled className="mr-2 align-middle" />;
    case 'html':
      return (token as Tokens.HTML).text;
    default:
      return 'raw' in token ? String(token.raw) : null;
  }
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const id = headingIds();

  const blocks = (tokens: readonly Token[], key: string): ReactNode =>
    tokens.map((token, index) => <Fragment key={`${key}-${index}`}>{block(token, `${key}-${index}`)}</Fragment>);

  function block(token: Token, key: string): ReactNode {
    switch (token.type) {
      case 'space':
      case 'def':
        return null;
      case 'heading': {
        const heading = token as Tokens.Heading;
        const anchor = id(inlineText(heading.tokens, heading.text));
        const children = inline(heading.tokens, key);
        // The post's title is the page's only h1, so a # heading in the body is set as an h2.
        if (heading.depth <= 2)
          return (
            <h2 id={anchor} className="mt-12 scroll-mt-24 text-2xl leading-snug font-semibold tracking-display text-[var(--mkt-heading)] first:mt-0">
              {children}
            </h2>
          );
        if (heading.depth === 3)
          return (
            <h3 id={anchor} className="mt-9 scroll-mt-24 text-xl font-semibold text-[var(--mkt-heading)]">
              {children}
            </h3>
          );
        return (
          <h4 id={anchor} className="mt-7 scroll-mt-24 text-lg font-semibold text-[var(--mkt-heading)]">
            {children}
          </h4>
        );
      }
      case 'paragraph': {
        const paragraph = token as Tokens.Paragraph;
        const only = paragraph.tokens.length === 1 ? paragraph.tokens[0] : null;
        // A paragraph that is just a video link becomes the video.
        const url = only?.type === 'link' ? (only as Tokens.Link).href : /^https?:\/\/\S+$/.test(paragraph.text.trim()) ? paragraph.text.trim() : null;
        const video = url ? videoEmbed(url) : null;
        if (video) {
          const src = video.provider === 'youtube' ? `https://www.youtube-nocookie.com/embed/${video.id}` : `https://player.vimeo.com/video/${video.id}`;
          return (
            <div className="mt-6 aspect-video overflow-hidden rounded-[10px] border border-[var(--mkt-line)] bg-black">
              <iframe src={src} title="Embedded video" loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen className="size-full" />
            </div>
          );
        }
        // A paragraph that is just an image is a figure, captioned by the image's title.
        if (only?.type === 'image') {
          const image = only as Tokens.Image;
          return (
            <figure className="mt-7">
              {inlineToken(image, key)}
              {image.title && <figcaption className="mt-2.5 text-center text-sm text-[var(--mkt-ink-2)]">{image.title}</figcaption>}
            </figure>
          );
        }
        return <p className="mt-5 first:mt-0">{inline(paragraph.tokens, key)}</p>;
      }
      case 'text': {
        const text = token as Tokens.Text;
        return text.tokens?.length ? inline(text.tokens, key) : text.text;
      }
      case 'hr':
        return <hr className="my-10 border-[var(--mkt-line)]" />;
      case 'blockquote': {
        const quote = token as Tokens.Blockquote;
        const firstLine = quote.text.split('\n')[0] ?? '';
        const kind = calloutKind(firstLine);
        if (kind) {
          const rest = marked.lexer(quote.text.split('\n').slice(1).join('\n'));
          return (
            <aside className={cn('mt-6 rounded-[10px] border px-5 py-4', CALLOUT[kind].className)} aria-label={CALLOUT[kind].label}>
              <p className="text-xs font-semibold tracking-[0.06em] text-foreground uppercase">{CALLOUT[kind].label}</p>
              <div className="mt-1.5 [&>p:first-child]:mt-0">{blocks(rest, key)}</div>
            </aside>
          );
        }
        return <blockquote className="mt-6 border-l-2 border-primary/50 pl-5 text-foreground italic">{blocks(quote.tokens, key)}</blockquote>;
      }
      case 'code': {
        const code = token as Tokens.Code;
        return (
          <pre className="mt-6 overflow-x-auto rounded-[8px] border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-4 py-3.5 font-mono text-[13px] leading-relaxed text-foreground">
            <code>{code.text}</code>
          </pre>
        );
      }
      case 'list': {
        const list = token as Tokens.List;
        const items = list.items.map((item, index) => (
          <li key={`${key}-${index}`} className={cn('pl-1.5', item.task && 'list-none')}>
            {blocks(item.tokens, `${key}-${index}`)}
          </li>
        ));
        return list.ordered ? (
          <ol start={typeof list.start === 'number' ? list.start : undefined} className="mt-5 flex list-decimal flex-col gap-2 pl-6 marker:font-semibold marker:text-[var(--mkt-ink-2)]">
            {items}
          </ol>
        ) : (
          <ul className="mt-5 flex list-disc flex-col gap-2 pl-6 marker:text-[var(--mkt-ink-3)]">{items}</ul>
        );
      }
      case 'table': {
        const table = token as Tokens.Table;
        const align = (index: number) => (table.align[index] === 'right' ? 'text-right' : table.align[index] === 'center' ? 'text-center' : 'text-left');
        return (
          <div className="mt-6 overflow-x-auto rounded-[8px] border border-[var(--mkt-line)] bg-[var(--mkt-card)]">
            <table className="w-full text-[0.9375rem]">
              <thead className="border-b border-[var(--mkt-line)] text-[13px] text-[var(--mkt-ink-2)]">
                <tr>
                  {table.header.map((cell, index) => (
                    <th key={index} scope="col" className={cn('px-4 py-2.5 font-semibold', align(index))}>
                      {inline(cell.tokens, `${key}-h${index}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--mkt-line)]">
                {table.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} className={cn('px-4 py-2.5', align(c))}>
                        {inline(cell.tokens, `${key}-${r}-${c}`)}
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
        // Raw HTML is shown, never interpreted.
        return <p className="mt-5 font-mono text-sm text-[var(--mkt-ink-2)]">{(token as Tokens.HTML).text}</p>;
      default:
        return 'raw' in token ? <p className="mt-5">{String(token.raw)}</p> : null;
    }
  }

  return <div className={cn('text-[1.0625rem] leading-[1.75] text-[var(--mkt-ink-2)]', className)}>{blocks(marked.lexer(source), 'md')}</div>;
}
