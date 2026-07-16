import { Fragment, type ReactNode } from 'react';

// Minimal, dependency-free Markdown renderer for course descriptions.
// Supports: # headings, **bold**, *italic*, `code`, [links](url), - / 1. lists,
// > blockquotes, ``` code fences, --- rules, and paragraphs.

// ── Inline ─────────────────────────────────────────────────────────────────────

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/;

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
      out.push(
        safe ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
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

export function Markdown({ content, className }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const flushParagraph = (buf: string[]) => {
    if (!buf.length) return;
    blocks.push(
      <p key={`p-${key++}`} className="text-sm leading-relaxed text-muted-foreground">
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
          className="overflow-x-auto rounded-xl border border-border bg-muted px-4 py-3 text-xs font-mono text-foreground"
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
      blocks.push(<hr key={`hr-${key++}`} className="my-4 border-border" />);
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushParagraph(para);
      const level = h[1].length;
      const size = level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base';
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
      blocks.push(
        <Tag key={`h-${key++}`} className={`${size} font-semibold text-foreground mt-2`}>
          {renderInline(h[2], `h-${key}`)}
        </Tag>,
      );
      i++;
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      flushParagraph(para);
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push(
        <blockquote key={`bq-${key++}`} className="border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
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
        <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
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
        <ol key={`ol-${key++}`} className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
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
    <div className={className}>
      {blocks.map((b, idx) => (
        <Fragment key={idx}>{b}</Fragment>
      ))}
    </div>
  );
}
