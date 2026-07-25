'use client';

import { useQueryClient } from '@tanstack/react-query';
import { History, PanelLeftClose, PanelLeftOpen, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import { Tooltip } from '@/components/shared/Tooltip';
import { roleAtLeast } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useSidebarStore } from '@/stores/sidebarStore';

import { AuditDrawer } from './AuditDrawer';
import { LocationPicker } from './LocationPicker';

const iconButton =
  'w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-surface-offset hover:text-foreground transition-colors';

/**
 * The top-bar tools relocated into the sidebar when "Hide top bar" is on.
 * Rendered on lg+ only (below lg the header still carries these). Adapts to the
 * collapsed rail vs the expanded sidebar.
 */
export function SidebarTools() {
  const { collapsed, toggleCollapsed } = useSidebarStore();
  const qc = useQueryClient();
  const [auditOpen, setAuditOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const canViewAudit = roleAtLeast(
    useAuthStore((s) => s.role),
    'franchise_owner',
  );

  const handleReload = useCallback(async () => {
    setSpinning(true);
    await qc.invalidateQueries();
    setTimeout(() => setSpinning(false), 600);
  }, [qc]);

  const reloadButton = (
    <Tooltip label="Reload data" className={collapsed ? 'mx-auto' : undefined}>
      <button onClick={handleReload} aria-label="Reload data" className={iconButton}>
        <RotateCcw size={18} aria-hidden="true" className={cn('transition-transform duration-500', spinning && 'rotate-180')} />
      </button>
    </Tooltip>
  );

  // Expanded: open the drawer preview. Collapsed rail: there's no room for a
  // useful preview, so go straight to the full audit-log page.
  const auditButton = canViewAudit && (
    <Tooltip label="Activity history" className={collapsed ? 'mx-auto' : undefined}>
      {collapsed ? (
        <Link href="/audit-log" aria-label="Activity history" className={iconButton}>
          <History size={18} aria-hidden="true" />
        </Link>
      ) : (
        <button onClick={() => setAuditOpen(true)} aria-label="Activity history" className={iconButton}>
          <History size={18} aria-hidden="true" />
        </button>
      )}
    </Tooltip>
  );

  const collapseButton = (
    <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={collapsed ? 'mx-auto' : undefined}>
      <button onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={iconButton}>
        {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
      </button>
    </Tooltip>
  );

  return (
    <>
      <div className={cn('px-3 pb-2', collapsed ? 'flex flex-col items-center gap-0.5' : 'flex flex-col gap-2')}>
        {collapsed ? (
          <>
            {reloadButton}
            {auditButton}
            {collapseButton}
          </>
        ) : (
          <>
            <LocationPicker sidebar />
            <div className="flex items-center gap-1">
              {reloadButton}
              {auditButton}
              <div className="flex-1" />
              {collapseButton}
            </div>
          </>
        )}
      </div>

      {canViewAudit && <AuditDrawer open={auditOpen} onClose={() => setAuditOpen(false)} />}
    </>
  );
}
