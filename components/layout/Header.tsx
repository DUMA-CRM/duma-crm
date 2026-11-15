'use client';

import { useCallback, useEffect } from 'react';

import { DumaAgent } from '@/components/ai/DumaAgent';
import { PanelRight } from '@/components/icons';

import { useWorkspaceModules } from '@/lib/hooks/useWorkspaceContext';
import { usePageHeaderStore } from '@/stores/pageHeaderStore';
import { usePageSidebarStore } from '@/stores/pageSidebarStore';

import { AccountMenu } from './AccountMenu';
import { HeaderIconButton } from './HeaderIconButton';
import { SidebarToggle } from './SidebarToggle';

export function Header() {
  // Ask DUMA works in a workspace; DUMA Admin has none, so it has no assistant.
  const agentEnabled = useWorkspaceModules()?.some((module) => module.moduleId === 'agent' && module.status === 'enabled') ?? false;
  // Only pages that render a right-hand panel get the drawer toggle.
  const { present: hasPageSidebar, toggle: togglePageSidebar, open: pageSidebarOpen } = usePageSidebarStore();

  const setSlot = usePageHeaderStore((s) => s.setSlot);
  const setBarVisible = usePageHeaderStore((s) => s.setBarVisible);
  const slotRef = useCallback((node: HTMLDivElement | null) => setSlot(node), [setSlot]);

  useEffect(() => {
    setBarVisible(true);
    return () => setBarVisible(false);
  }, [setBarVisible]);

  return (
    // On the page colour behind a hairline, like the marketing header and the
    // light sidebar beside it. Opaque — <main> is a separate scroll container,
    // so nothing passes under.
    <header className="h-14 shrink-0 bg-field border-b border-border flex items-center gap-2 md:gap-3 px-3 md:px-6 sticky top-0 z-20">
      <SidebarToggle />

      {/* The page's masthead — back, title, page actions — is portalled in here
          by EditorShell. Empty on pages that don't use it, where it just spaces
          the app tools to the right. */}
      <div ref={slotRef} className="flex min-w-0 flex-1 items-center gap-1.5 md:gap-2" />

      {/* What acts on the page in front of you, then who is signed in. Theme,
          what's new and sign out live in the account menu; data refreshes on
          its own after every change, so there is no reload button. */}
      <div className="flex shrink-0 items-center gap-1 md:gap-2">
        {agentEnabled && <DumaAgent />}

        {/* Page sidebar (right panel) toggle — drawer mode below lg only */}
        {hasPageSidebar && (
          <HeaderIconButton
            label={pageSidebarOpen ? 'Hide page panel' : 'Show page panel'}
            onClick={togglePageSidebar}
            aria-expanded={pageSidebarOpen}
            active={pageSidebarOpen}
            className="lg:hidden"
          >
            <PanelRight size={18} aria-hidden="true" />
          </HeaderIconButton>
        )}

        <AccountMenu />
      </div>
    </header>
  );
}
