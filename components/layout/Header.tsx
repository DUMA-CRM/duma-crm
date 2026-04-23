'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Bell, History, RotateCcw, Search } from 'lucide-react';
import { useCallback, useState } from 'react';

import { cn } from '@/lib/utils/cn';

import { Input } from '../ui/input';

import { AuditDrawer } from './AuditDrawer';
import { LocationPicker } from './LocationPicker';
import { SidebarToggle } from './SidebarToggle';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const [auditOpen, setAuditOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const qc = useQueryClient();

  const handleReload = useCallback(async () => {
    setSpinning(true);
    await qc.invalidateQueries();
    setTimeout(() => setSpinning(false), 600);
  }, [qc]);

  return (
    <>
      <header className="h-14 shrink-0 bg-surface border-b border-divider flex items-center gap-3 px-6 sticky top-0 z-20">
        <SidebarToggle />
        <Input
          leftIcon={<Search size={16} />}
          type="search"
          placeholder="Search orders, roast profiles, or customers…"
          className="max-w-120"
        />
        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button
            aria-label="Notifications"
            className="relative w-9 h-9 rounded-md flex items-center justify-center hover:bg-surface-offset hover:text-foreground transition-colors"
          >
            <Bell size={18} aria-hidden="true" />
            <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-1.75 h-1.75 bg-primary rounded-full border-2 border-surface" />
          </button>

          {/* Reload */}
          <button
            onClick={handleReload}
            aria-label="Reload data"
            className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-surface-offset hover:text-foreground transition-colors"
          >
            <RotateCcw size={18} aria-hidden="true" className={cn('transition-transform duration-500', spinning && 'rotate-180')} />
          </button>

          {/* History */}
          <button
            onClick={() => setAuditOpen(true)}
            aria-label="Activity history"
            className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-surface-offset hover:text-foreground transition-colors"
          >
            <History size={18} aria-hidden="true" />
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-divider mx-1" aria-hidden="true" />

          <LocationPicker />

          <ThemeToggle />

          {/* Avatar */}
          <button
            aria-label="Open user menu"
            className="w-9 h-9 rounded-full bg-linear-to-br from-primary to-primary-hover flex items-center justify-center text-white font-bold border-2 border-surface ring-1 ring-border"
          >
            MD
          </button>
        </div>
      </header>

      <AuditDrawer open={auditOpen} onClose={() => setAuditOpen(false)} />
    </>
  );
}
