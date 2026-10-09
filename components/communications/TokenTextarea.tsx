'use client';

import { forwardRef, useRef } from 'react';

import { cn } from '@/lib/utils/cn';

import { tokenSegments } from './templateDesign';

/**
 * A textarea that marks merge fields we can't fill in red, so a bad
 * `{{token}}` in a wall of HTML is found at a glance. A textarea can't colour
 * its own text, so a mirror sits behind it — same font, padding and wrapping,
 * scrolled in step — drawing only the marks; the text stays the textarea's.
 */
export const TokenTextarea = forwardRef<
  HTMLTextAreaElement,
  Omit<React.ComponentProps<'textarea'>, 'value' | 'onChange'> & {
    value: string;
    onChange: (value: string) => void;
    variables: readonly string[];
  }
>(function TokenTextarea({ value, onChange, variables, className, onScroll, ...props }, ref) {
  const mirror = useRef<HTMLDivElement>(null);
  // Shared by both layers, so every character lands in the same place — the
  // stable gutter included, or a scrollbar appearing would rewrap one layer only.
  const type = cn('p-3 whitespace-pre-wrap break-words [scrollbar-gutter:stable]', className);
  return (
    <div className="relative rounded-md border border-rule/60 bg-background focus-within:border-primary">
      <div ref={mirror} aria-hidden="true" className={cn(type, 'pointer-events-none absolute inset-0 overflow-hidden text-transparent')}>
        {tokenSegments(value, variables).map((segment, index) =>
          segment.unknown ? (
            <mark key={index} className="rounded-sm bg-exception/15 text-transparent underline decoration-exception decoration-wavy">
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
        {/* A trailing newline needs a character after it to take up its line. */}
        {'​'}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (mirror.current) mirror.current.scrollTop = event.currentTarget.scrollTop;
          onScroll?.(event);
        }}
        spellCheck={false}
        {...props}
        className={cn(type, 'relative block w-full resize-y bg-transparent text-foreground outline-none')}
      />
    </div>
  );
});
