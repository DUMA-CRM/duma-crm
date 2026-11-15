'use client';

import { useEffect, useRef, useState } from 'react';

import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from '@/components/icons';

import { cn } from '@/lib/utils/cn';
import { type ToastItem, type ToastType, useToastStore } from '@/lib/toast';

const ICON: Record<ToastType, { icon: typeof Info; tone: string }> = {
  success: { icon: CheckCircle2, tone: 'text-success' },
  error: { icon: CircleAlert, tone: 'text-destructive' },
  warning: { icon: TriangleAlert, tone: 'text-warning' },
  info: { icon: Info, tone: 'text-info' },
};

/**
 * The one toast viewport, mounted in QueryProvider: a stack at the bottom
 * right (full width at the bottom on a phone), each toast a white card on a
 * hairline with its type's icon, the message, an optional action and a close
 * button — the marketing site's material, not a morphing pill.
 */
export function AppToaster() {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[200] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[24rem]"
    >
      {toasts.map((item) => (
        <Toast key={item.id} item={item} />
      ))}
    </section>
  );
}

function Toast({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);
  const { icon: Icon, tone } = ICON[item.type];

  // Raised again: the full time starts over.
  useEffect(() => {
    remaining.current = item.duration;
  }, [item.version, item.duration]);

  // Counts down while visible; pointing at it or focusing it holds it.
  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => dismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, dismiss, item.id, item.version]);

  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-popover py-3 pr-2 pl-3.5 text-popover-foreground shadow-lg',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200',
      )}
    >
      <Icon size={18} aria-hidden="true" className={cn('mt-px shrink-0', tone)} />
      {/* Icon, first line of text and ✕ share one centre line: the text line is 20px, the icon 18, the ✕ 28. */}
      <div className="min-w-0 flex-1">
        {item.title && <p className="text-sm leading-5 font-semibold text-heading">{item.title}</p>}
        <p className={cn('text-sm leading-5 [overflow-wrap:anywhere]', item.title ? 'mt-0.5 text-muted-foreground' : 'text-foreground')}>{item.message}</p>
        {item.button && (
          <button
            type="button"
            onClick={() => {
              item.button?.onClick();
              dismiss(item.id);
            }}
            className="mt-2 rounded-sm text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {item.button.title}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Dismiss notification"
        className="-my-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
