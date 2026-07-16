import { cn } from '@/lib/utils/cn';

import { PageSidebar } from './PageSidebar';

interface PageLayoutProps {
  eyebrow?: string;
  title: string;
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
  if (sidebar || fullHeight) {
    return (
      <div className="flex -m-4 md:-m-8 h-[calc(100vh-var(--header-height))]">
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className={cn('px-4 pt-5 md:px-8 md:pt-8 pb-4 shrink-0', headerBorder && 'border-b border-border')}>
            {eyebrow && <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">{eyebrow}</p>}
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-4 md:mb-5">{title}</h1>
            {headerSlot}
          </div>
          <div className={cn('flex-1 min-h-0 overflow-auto px-4 md:px-8 pt-6', className)}>{children}</div>
        </div>
        {sidebar && <PageSidebar>{sidebar}</PageSidebar>}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div>
        {eyebrow && <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">{eyebrow}</p>}
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">{title}</h1>
        {headerSlot && <div className="mt-5">{headerSlot}</div>}
      </div>
      {children}
    </div>
  );
}
