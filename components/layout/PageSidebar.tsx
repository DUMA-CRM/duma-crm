'use client';

import { useEffect } from 'react';

import { cn } from '@/lib/utils/cn';
import { usePageSidebarStore } from '@/stores/pageSidebarStore';

/**
 * Wraps a page's right-hand panel. Inline on lg+ screens; below that it becomes
 * a full-width overlay drawer toggled from the header (or auto-opened on row
 * selection). The header stays visible, so the toggle also closes it.
 */
export function PageSidebar({ children }: { children: React.ReactNode }) {
  const { open, setPresent } = usePageSidebarStore();

  // Register with the store so the header knows to show the drawer toggle.
  useEffect(() => {
    setPresent(true);
    return () => setPresent(false);
  }, [setPresent]);

  return (
    <div
      className={cn(
        // Drawer mode: full width under the header; *:grow stretches the fixed-width panel to fill.
        // z-10 keeps it above page content but below the header (z-20), so the
        // header's dropdowns (search/tools menu, location picker) render over it.
        'fixed top-(--header-height) bottom-0 inset-x-0 z-10 flex shrink-0 bg-card *:grow',
        'transition-transform duration-300 ease-out',
        open ? 'translate-x-0' : 'translate-x-full',
        'lg:static lg:z-auto lg:translate-x-0 lg:transition-none',
      )}
    >
      {children}
    </div>
  );
}
