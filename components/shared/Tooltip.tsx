'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/cn';

/**
 * Hover/focus tooltip that renders to <body> so it escapes clipped/transformed
 * ancestors (e.g. the collapsed sidebar rail with `overflow-x-clip`). Currently
 * only the `right` placement is used — the arrow points left toward the trigger.
 */
export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const open = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.top + r.height / 2, left: r.right });
  };
  const close = () => setPos(null);

  return (
    <div
      ref={ref}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      className={cn('inline-flex', className)}
    >
      {children}
      {mounted &&
        pos &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: pos.top, left: pos.left + 10 }}
            className="fixed z-[60] -translate-y-1/2 pointer-events-none animate-in fade-in slide-in-from-left-1 duration-150"
          >
            <div className="relative rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background shadow-lg whitespace-nowrap">
              {/* Left-pointing arrow */}
              <span
                aria-hidden="true"
                className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 w-2 h-2 bg-foreground rotate-45"
              />
              {label}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
