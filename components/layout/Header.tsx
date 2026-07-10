'use client';

import { useQueryClient } from '@tanstack/react-query';
import { History, RotateCcw, Search } from 'lucide-react';
import { useCallback, useState } from 'react';

import { roleAtLeast } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';

import { Input } from '../ui/input';

import { AuditDrawer } from './AuditDrawer';
import { LocationPicker } from './LocationPicker';
import { SidebarToggle } from './SidebarToggle';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const [auditOpen, setAuditOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const qc = useQueryClient();
  // Audit log is franchise_owner+ (matches the API); hide the button otherwise.
  const canViewAudit = roleAtLeast(useAuthStore((s) => s.role), 'franchise_owner');

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
          {/* Reload */}
          <button
            onClick={handleReload}
            aria-label="Reload data"
            className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-surface-offset hover:text-foreground transition-colors"
          >
            <RotateCcw size={18} aria-hidden="true" className={cn('transition-transform duration-500', spinning && 'rotate-180')} />
          </button>

          {/* History / audit — franchise_owner+ only */}
          {canViewAudit && (
            <button
              onClick={() => setAuditOpen(true)}
              aria-label="Activity history"
              className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-surface-offset hover:text-foreground transition-colors"
            >
              <History size={18} aria-hidden="true" />
            </button>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-divider mx-1" aria-hidden="true" />

          <LocationPicker />

          <ThemeToggle />
        </div>
      </header>

      {canViewAudit && <AuditDrawer open={auditOpen} onClose={() => setAuditOpen(false)} />}
    </>
  );
}
