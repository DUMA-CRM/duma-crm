import { Fragment, type ReactNode } from 'react';

// Minimal, dependency-free Markdown renderer for rich support content and
// support articles. Supports: # headings (anchored), **bold**, *italic*,
// `code`, [links](url), images, - / 1. lists, > blockquotes, ``` code fences,
// | pipe tables |, --- rules, and paragraphs.

/** Stable id for a heading so articles can link to their own sections. */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ── Inline ─────────────────────────────────────────────────────────────────────

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/;
const SAFE_RESOURCE_URL = /^(https?:|\/)/i;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest.length) {
    const m = rest.match(INLINE);
    if (!m || m.index === undefined) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const token = m[0];
    const key = `${keyBase}-${i++}`;
    if (token.startsWith('`')) {
      out.push(
        <code key={key} className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono text-foreground">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      out.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('*')) {
      out.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else {
      const label = token.slice(1, token.indexOf(']'));
      const href = token.slice(token.indexOf('(') + 1, -1);
      // Only allow safe link schemes — authored content must not produce
      // javascript:/data: URLs. Unsafe links render as plain text.
      const safe = /^(https?:|mailto:|\/)/i.test(href.trim());
      const external = /^https?:/i.test(href.trim());
      out.push(
        safe ? (
          <a
            key={key}
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {label}
          </a>
        ) : (
          <span key={key}>{label}</span>
        ),
      );
    }
    rest = rest.slice(m.index + token.length);
  }
  return out;
}

// ── Blocks ─────────────────────────────────────────────────────────────────────

export function Markdown({
  content,
  className,
  variant = 'article',
}: {
  content: string;
  className?: string;
  variant?: 'article' | 'compact';
}) {
  const compact = variant === 'compact';
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const flushParagraph = (buf: string[]) => {
    if (!buf.length) return;
    blocks.push(
      <p key={`p-${key++}`} className={compact ? 'text-sm leading-6 text-foreground' : 'text-base leading-7 text-muted-foreground'}>
        {renderInline(buf.join(' '), `p-${key}`)}
      </p>,
    );
    buf.length = 0;
  };

  const para: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.trim().startsWith('```')) {
      flushParagraph(para);
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre
          key={`pre-${key++}`}
          className="overflow-x-auto rounded-sm border border-rule bg-muted px-4 py-3 text-sm leading-6 font-mono text-foreground"
        >
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Blank line → paragraph break
    if (!line.trim()) {
      flushParagraph(para);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushParagraph(para);
      blocks.push(<hr key={`hr-${key++}`} className="my-4 border-rule" />);
      i++;
      continue;
    }

    // Standalone image. Keeping it block-level gives authored screenshots the
    // space they need and avoids treating image markdown as an ordinary link.
    const image = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph(para);
      const src = image[2].trim();
      if (SAFE_RESOURCE_URL.test(src)) {
        blocks.push(
          <figure key={`img-${key++}`} className="my-5 overflow-hidden rounded-sm border border-rule bg-muted/30">
            {/* Content authors may use arbitrary approved HTTPS image hosts.
                The renderer validates the scheme; Next Image cannot safely
                predeclare every host without a custom proxy. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={image[1]} loading="lazy" className="h-auto w-full object-contain" />
            {image[1] && (
              <figcaption className="border-t border-rule px-4 py-2.5 text-sm leading-6 text-muted-foreground">{image[1]}</figcaption>
            )}
          </figure>,
        );
      }
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushParagraph(para);
      const level = h[1].length;
      const size = compact ? 'text-sm' : level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base';
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
      blocks.push(
        // The id lets an article build its own contents list.
        <Tag key={`h-${key++}`} id={headingSlug(h[2])} className={`${size} font-semibold text-foreground mt-2 scroll-mt-24`}>
          {renderInline(h[2], `h-${key}`)}
        </Tag>,
      );
      i++;
      continue;
    }

    // Pipe table: a header row, a | --- | separator, then body rows.
    if (line.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      flushParagraph(para);
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      const tableKey = key++;
      blocks.push(
        <div key={`table-${tableKey}`} className="my-5 overflow-x-auto rounded-sm border border-rule">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted">
                {head.map((cell, index) => (
                  <th key={index} className="px-4 py-2.5 text-left text-micro uppercase text-muted-foreground">
                    {renderInline(cell, `th-${tableKey}-${index}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-rule">
                  {row.map((cell, index) => (
                    <td key={index} className="px-4 py-2.5 align-top text-muted-foreground first:text-foreground first:font-medium">
                      {renderInline(cell, `td-${tableKey}-${rowIndex}-${index}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      flushParagraph(para);
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push(
        <blockquote
          key={`bq-${key++}`}
          className={`border-l border-rule pl-4 italic text-muted-foreground ${compact ? 'text-sm leading-6' : 'text-base leading-7'}`}
        >
          {renderInline(quote.join(' '), `bq-${key}`)}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      blocks.push(
        <ul
          key={`ul-${key++}`}
          className={`list-disc pl-5 space-y-1.5 ${compact ? 'text-sm leading-6 text-foreground' : 'text-base leading-7 text-muted-foreground'}`}
        >
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ul-${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      blocks.push(
        <ol
          key={`ol-${key++}`}
          className={`list-decimal pl-5 space-y-1.5 ${compact ? 'text-sm leading-6 text-foreground' : 'text-base leading-7 text-muted-foreground'}`}
        >
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ol-${key}-${idx}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph text
    para.push(line);
    i++;
  }
  flushParagraph(para);

  return (
    <div className={`${compact ? '[&>*+*]:mt-3' : ''} ${className ?? ''}`}>
      {blocks.map((b, idx) => (
        <Fragment key={idx}>{b}</Fragment>
      ))}
    </div>
  );
}
