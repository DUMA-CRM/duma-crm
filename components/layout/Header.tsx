'use client';

import { useQueryClient } from '@tanstack/react-query';
import { History, PanelRight, RotateCcw, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { roleAtLeast } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { usePageSidebarStore } from '@/stores/pageSidebarStore';

import { Input } from '../ui/input';

import { AuditDrawer } from './AuditDrawer';
import { LocationPicker } from './LocationPicker';
import { SidebarToggle } from './SidebarToggle';
import { ThemeToggle } from './ThemeToggle';

const iconButton = 'w-9 h-9 rounded-md flex items-center justify-center hover:bg-surface-offset hover:text-foreground transition-colors';

/** Header search — submits to the customers list with the query prefilled. */
function HeaderSearch({ onSubmitted }: { onSubmitted?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (!query) return;
        router.push(`/customers?q=${encodeURIComponent(query)}`);
        setQ('');
        onSubmitted?.();
      }}
    >
      <Input
        leftIcon={<Search size={16} />}
        type="search"
        placeholder="Search customers… (press Enter)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </form>
  );
}

export function Header() {
  const [auditOpen, setAuditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const qc = useQueryClient();
  // Audit log is franchise_owner+ (matches the API); hide the button otherwise.
  const canViewAudit = roleAtLeast(
    useAuthStore((s) => s.role),
    'franchise_owner',
  );
  // Only pages that render a right-hand panel get the drawer toggle.
  const { present: hasPageSidebar, toggle: togglePageSidebar, open: pageSidebarOpen } = usePageSidebarStore();

  const handleReload = useCallback(async () => {
    setSpinning(true);
    await qc.invalidateQueries();
    setTimeout(() => setSpinning(false), 600);
  }, [qc]);

  // Close the mobile tools menu on outside click (same pattern as LocationPicker).
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const reloadButton = (className?: string) => (
    <button onClick={handleReload} aria-label="Reload data" className={cn(iconButton, className)}>
      <RotateCcw size={18} aria-hidden="true" className={cn('transition-transform duration-500', spinning && 'rotate-180')} />
    </button>
  );

  const auditButton = (className?: string) =>
    canViewAudit ? (
      <button
        onClick={() => {
          setAuditOpen(true);
          setMenuOpen(false);
        }}
        aria-label="Activity history"
        className={cn(iconButton, className)}
      >
        <History size={18} aria-hidden="true" />
      </button>
    ) : null;

  return (
    <>
      <header
        ref={headerRef}
        className="h-14 shrink-0 bg-surface border-b border-divider flex items-center gap-2 md:gap-3 px-3 md:px-6 sticky top-0 z-20"
      >
        <SidebarToggle />

        {/* Inline search — md+ only; collapses into the tools menu below */}
        <div className="hidden md:block w-full max-w-120">
          <HeaderSearch />
        </div>
        <div className="flex-1" />

        {/* Mobile: centred tools-menu trigger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Search and tools"
          aria-expanded={menuOpen}
          className={cn(iconButton, 'md:hidden', menuOpen && 'bg-surface-offset text-foreground')}
        >
          {menuOpen ? <X size={18} aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
        </button>
        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-1 md:gap-2">
          {reloadButton('hidden md:flex')}
          {auditButton('hidden md:flex')}

          {/* Divider */}
          <div className="hidden md:block w-px h-6 bg-divider mx-1" aria-hidden="true" />

          <div className="hidden md:block">
            <LocationPicker />
          </div>

          <ThemeToggle />

          {/* Page sidebar (right panel) toggle — drawer mode below lg only */}
          {hasPageSidebar && (
            <button
              onClick={togglePageSidebar}
              aria-label="Toggle page panel"
              aria-expanded={pageSidebarOpen}
              className={cn(iconButton, 'lg:hidden', pageSidebarOpen && 'bg-surface-offset text-primary')}
            >
              <PanelRight size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Mobile tools menu — search, location, reload, audit */}
        {menuOpen && (
          <div className="absolute top-full inset-x-0 z-30 md:hidden bg-surface border-b border-divider shadow-lg p-3 flex flex-col gap-3">
            <HeaderSearch onSubmitted={() => setMenuOpen(false)} />
            <div className="flex items-center gap-2">
              <LocationPicker align="left" />
              <div className="flex-1" />
              {reloadButton()}
              {auditButton()}
            </div>
          </div>
        )}
      </header>

      {canViewAudit && <AuditDrawer open={auditOpen} onClose={() => setAuditOpen(false)} />}
    </>
  );
}
