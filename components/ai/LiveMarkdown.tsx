'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { Markdown } from '@/components/shared/Markdown';

import { splitAgentContent } from '@/lib/ai/mermaid-content';

// beautiful-mermaid and its layout engine are hundreds of KB; they load only
// when an answer actually contains a diagram block.
const MermaidDiagram = dynamic(() => import('@/components/ai/MermaidDiagram').then((module) => module.MermaidDiagram), {
  ssr: false,
  loading: () => <div className="my-3 min-h-24 rounded-lg border border-border bg-field" aria-busy="true" />,
});

/**
 * `active` fakes a typewriter for a message that arrived all at once.
 *
 * Genuinely streamed text does not need it — pass neither `active` nor
 * `onDone` and this is a plain Markdown render that grows as `content` does.
 */
export function LiveMarkdown({ content, active, onDone }: { content: string; active?: boolean; onDone?: () => void }) {
  const [visible, setVisible] = useState(() => (active ? 0 : content.length));
  const blocks = splitAgentContent(content.slice(0, visible));

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedTimer = window.setTimeout(() => {
        setVisible(content.length);
        onDone?.();
      }, 0);
      return () => window.clearTimeout(reducedTimer);
    }
    const timer = window.setInterval(() => {
      setVisible((current) => {
        const next = Math.min(content.length, current + 3);
        if (next === content.length) {
          window.clearInterval(timer);
          if (onDone) window.setTimeout(onDone, 0);
        }
        return next;
      });
    }, 16);
    return () => window.clearInterval(timer);
  }, [active, content, onDone]);

  return (
    <div className="relative">
      {blocks.map((block, index) =>
        block.kind === 'mermaid' ? (
          <MermaidDiagram key={`diagram-${index}-${block.source}`} source={block.source} />
        ) : (
          <Markdown key={`markdown-${index}`} content={block.content} variant="compact" />
        ),
      )}
      {active && visible < content.length ? (
        <span
          className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-text-bottom motion-reduce:hidden"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
