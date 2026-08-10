import { cn } from '@/lib/utils/cn';

import { PageSidebar } from './PageSidebar';

interface PageLayoutProps {
  eyebrow?: string;
  /** Omit (along with eyebrow/headerSlot) for chrome-less pages like the KDS. */
  title?: string;
  /** Content rendered in the header block, below the title (e.g. search bar, tabs). */
  headerSlot?: React.ReactNode;
  /** Fixed right panel. When provided, switches to full-bleed split layout. */
  sidebar?: React.ReactNode;
  /** Show border below the header. Defaults to true when sidebar is present. */
  headerBorder?: boolean;
  /** Fill the viewport height with a sticky header and scrollable body — same structure as the sidebar variant but without a sidebar. */
  fullHeight?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({ eyebrow, title, headerSlot, sidebar, headerBorder = true, fullHeight, children, className }: PageLayoutProps) {
  const hasHeader = Boolean(eyebrow || title || headerSlot);

  if (sidebar || fullHeight) {
    // dvh, not vh: on a shop tablet 100vh includes the browser chrome, which
    // pushed the bottom of the KDS queue and the POS keypad out of view.
    return (
      <div className="flex -m-4 md:-m-8 h-[calc(100dvh-var(--header-height))]">
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {hasHeader && (
            <div className={cn('px-4 pt-5 md:px-8 md:pt-8 shrink-0', headerSlot ? 'pb-4' : 'pb-2', headerBorder && 'border-b border-rule')}>
              {/* The masthead: what sheet this is, then what it is called. */}
              {eyebrow && <p className="text-xs font-semibold text-muted-foreground mb-1.5">{eyebrow}</p>}
              {/* The title only needs a bottom margin when a header slot sits under it */}
              {title && (
                <h1 className={cn('text-2xl font-semibold tracking-headline text-foreground md:text-3xl', headerSlot && 'mb-3 md:mb-4')}>
                  {title}
                </h1>
              )}
              {headerSlot}
            </div>
          )}
          <div className={cn('flex-1 min-h-0 overflow-auto px-4 md:px-8 pt-6', headerSlot ? 'pt-4' : 'pt-2', className)}>{children}</div>
        </div>
        {sidebar && <PageSidebar>{sidebar}</PageSidebar>}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {hasHeader && (
        <div>
          {eyebrow && <p className="text-xs font-semibold text-muted-foreground mb-1.5">{eyebrow}</p>}
          {title && <h1 className="text-2xl font-semibold tracking-headline text-foreground md:text-3xl">{title}</h1>}
          {headerSlot && <div className={cn((eyebrow || title) && 'mt-5')}>{headerSlot}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
