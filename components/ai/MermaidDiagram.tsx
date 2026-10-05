'use client';

import { renderMermaidSVG } from 'beautiful-mermaid';
import { useMemo } from 'react';

import { Combine, TriangleAlert } from '@/components/icons';

export function MermaidDiagram({ source }: { source: string }) {
  const svg = useMemo(() => {
    try {
      return renderMermaidSVG(source, {
        bg: 'var(--background)',
        fg: 'var(--foreground)',
        accent: 'var(--primary)',
        muted: 'var(--muted-foreground)',
        surface: 'var(--field)',
        border: 'var(--rule)',
        transparent: true,
      });
    } catch {
      return '';
    }
  }, [source]);

  if (!svg) {
    return (
      <div className="my-3 rounded-lg border border-rule/60 bg-field px-3.5 py-3" role="status">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <TriangleAlert size={14} className="text-stock" aria-hidden="true" />
          This diagram couldn’t be drawn
        </p>
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">Show the process as text</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-band/60 p-3 font-mono leading-5">{source}</pre>
        </details>
      </div>
    );
  }

  return (
    <figure className="my-3 overflow-hidden rounded-lg border border-rule/60 bg-field" aria-label="Process diagram from Ask DUMA">
      <figcaption className="flex items-center gap-2 border-b border-rule/40 bg-band/35 px-3.5 py-2 text-label font-semibold tracking-label text-muted-foreground uppercase">
        <Combine size={13} className="text-reference" aria-hidden="true" />
        Process overview
      </figcaption>
      <div
        className="overflow-x-auto p-3.5 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:min-w-[28rem] [&_svg]:max-w-none sm:[&_svg]:min-w-0 sm:[&_svg]:max-w-full"
        // The accepted syntax is constrained before reaching this renderer;
        // beautiful-mermaid escapes labels and emits no interactive actions.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </figure>
  );
}
