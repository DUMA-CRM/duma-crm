'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { DumaAgent } from '@/components/ai/DumaAgent';
import { PanelRight, RotateCcw } from '@/components/icons';

import { type TenantModuleState, getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { usePageHeaderStore } from '@/stores/pageHeaderStore';
import { usePageSidebarStore } from '@/stores/pageSidebarStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { SidebarToggle } from './SidebarToggle';
import { ThemeToggle } from './ThemeToggle';

const iconButton = 'w-9 h-9 rounded-md flex items-center justify-center hover:bg-band hover:text-foreground transition-colors';

export function Header({ moduleState }: { moduleState: readonly TenantModuleState[] }) {
  const [spinning, setSpinning] = useState(false);
  const qc = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    enabled: Boolean(tenantId),
    initialData: { modules: [...moduleState] },
    staleTime: 30_000,
  });
  const agentEnabled = modules.data.modules.some((module) => module.moduleId === 'agent' && module.status === 'enabled');
  // Only pages that render a right-hand panel get the drawer toggle.
  const { present: hasPageSidebar, toggle: togglePageSidebar, open: pageSidebarOpen } = usePageSidebarStore();

  const setSlot = usePageHeaderStore((s) => s.setSlot);
  const setBarVisible = usePageHeaderStore((s) => s.setBarVisible);
  const slotRef = useCallback((node: HTMLDivElement | null) => setSlot(node), [setSlot]);

  useEffect(() => {
    setBarVisible(true);
    return () => setBarVisible(false);
  }, [setBarVisible]);

  const handleReload = useCallback(async () => {
    setSpinning(true);
    await qc.invalidateQueries();
    setTimeout(() => setSpinning(false), 600);
  }, [qc]);

  return (
    // Card, not page: the bar carries the page's masthead, so it reads as the
    // sheet's own header lifted off the content rather than a gap above it.
    // Opaque — <main> is a separate scroll container, so nothing passes under.
    <header className="h-14 shrink-0 bg-card border-b border-divider flex items-center gap-2 md:gap-3 px-3 md:px-6 sticky top-0 z-20">
      <SidebarToggle />

      {/* The page's masthead — back, title, page actions — is portalled in here
          by EditorShell. Empty on pages that don't use it, where it just spaces
          the app tools to the right. */}
      <div ref={slotRef} className="flex min-w-0 flex-1 items-center gap-1.5 md:gap-2" />

      {/* Location scope and activity history live in the sidebar; the header
          keeps only what acts on the page in front of you. */}
      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        {agentEnabled && <DumaAgent />}

        <button onClick={handleReload} aria-label="Reload data" className={iconButton}>
          <RotateCcw size={18} aria-hidden="true" className={cn('transition-transform duration-500', spinning && 'rotate-180')} />
        </button>

        <ThemeToggle />

        {/* Page sidebar (right panel) toggle — drawer mode below lg only */}
        {hasPageSidebar && (
          <button
            onClick={togglePageSidebar}
            aria-label="Toggle page panel"
            aria-expanded={pageSidebarOpen}
            className={cn(iconButton, 'lg:hidden', pageSidebarOpen && 'bg-band text-primary')}
          >
            <PanelRight size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}
