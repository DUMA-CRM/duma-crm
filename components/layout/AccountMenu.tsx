'use client';

import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

import { Building2, ChevronsUpDown, LayoutDashboard, LogOut, Monitor, Moon, Sun } from '@/components/icons';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { useAuth } from '@/lib/hooks/useAuth';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';
import { useWorkspaceSwitch } from '@/lib/hooks/useWorkspaceSwitch';
import { cn } from '@/lib/utils/cn';
import { hasUnsavedWork } from '@/lib/utils/unsaved-work';
import { useAuthStore } from '@/stores/authStore';

import { type Target, WorkspacePickerList } from './ContextSwitcher';

const subscribe = () => () => {};
type Theme = 'light' | 'dark' | 'system';

const item =
  'flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-foreground transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-ring';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Device', icon: Monitor },
] as const;

/**
 * Who is signed in, at the right of the top bar: the avatar opens the name and
 * email, then one list: the workspace this tab is in (a platform administrator
 * opens the picker from it, DUMA Admin included), the theme and sign out.
 * Settings live in the sidebar, so the menu doesn't repeat them.
 */
export function AccountMenu() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const isPlatformAccount = useAuthStore((state) => state.role === 'super_admin');
  const { context, workspace } = useWorkspaceContext();
  // Which workspace this tab is in: the sidebar no longer names it.
  const where = context.kind === 'platform' ? 'DUMA Admin' : context.kind === 'workspace' ? workspace?.name : undefined;
  // DUMA Admin and DUMA's own workspace are ours, not a client's.
  const internal = context.kind === 'platform' || workspace?.classification === 'internal';
  const switchTo = useWorkspaceSwitch();
  // The picker and the unsaved-work check live outside the popover, so they stay open after it closes.
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<Target | null>(null);
  const pick = (picked: Target) => {
    // Picking the workspace you're already in deselects it: back to DUMA Admin.
    const reselected = picked.kind === 'workspace' && context.kind === 'workspace' && picked.tenantId === context.tenantId;
    const target: Target = reselected ? { kind: 'platform' } : picked;
    setPicking(false);
    setOpen(false);
    if (hasUnsavedWork()) setPending(target);
    else void switchTo(target, { discardUnsaved: true });
  };
  // The theme is only known in the browser; render the server's guess until then.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const current = (mounted && (theme as Theme)) || 'system';
  const name = user?.name || user?.email || 'Account';

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Account: ${name}`}
            className="grid size-9 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Avatar name={user?.name} email={user?.email} size="sm" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-1.5">
          <div className="px-2.5 pt-2 pb-2.5">
            <p className="truncate text-sm font-semibold text-heading">{name}</p>
            {user?.email && user.email !== name && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
          </div>

          <div className="mb-1.5 border-t border-border" />

          {/* One list: every row the same height, padding, icon and type. */}
          {where &&
            (isPlatformAccount ? (
              <button
                type="button"
                className={item}
                onClick={() => {
                  setOpen(false);
                  setPicking(true);
                }}
                aria-label={`Workspace: ${where}. Switch workspace`}
              >
                <Building2 size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-left">{where}</span>
                {internal && <Badge variant="reference">Internal</Badge>}
                <ChevronsUpDown size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              </button>
            ) : (
              <div className={cn(item, 'hover:bg-transparent')}>
                <Building2 size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{where}</span>
                {internal && <Badge variant="reference">Internal</Badge>}
              </div>
            ))}

          {context.kind === 'workspace' && (
            <Link href="/dashboard?edit=1" className={cn(item, 'hidden md:flex')} onClick={() => setOpen(false)}>
              <LayoutDashboard size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              Edit dashboard
            </Link>
          )}

          <div className={cn(item, 'hover:bg-transparent')}>
            {current === 'dark' ? (
              <Moon size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            ) : (
              <Sun size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            )}
            <span className="flex-1">Theme</span>
            <div role="group" aria-label="Theme" className="flex gap-0.5 rounded-md border border-border bg-band/60 p-0.5">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={current === value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'grid size-6 place-items-center rounded-[4px] transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    current === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          {/* Signing out ends the session on this device, so it reads as a destructive action on hover. */}
          <button
            type="button"
            onClick={() => {
              if (!hasUnsavedWork() || window.confirm('Sign out and discard your unsaved changes?')) void logout();
            }}
            className={cn(item, 'group hover:bg-destructive/10 hover:text-destructive')}
          >
            <LogOut
              size={16}
              aria-hidden="true"
              className="shrink-0 text-muted-foreground transition-colors group-hover:text-destructive"
            />
            Sign out
          </button>
        </PopoverContent>
      </Popover>

      {picking && (
        <Modal
          title="Switch workspace"
          description="Each tab works in one place at a time. Other tabs stay where they are."
          onClose={() => setPicking(false)}
          size="lg"
        >
          <WorkspacePickerList onPick={pick} includePlatform />
        </Modal>
      )}
      {pending && (
        <ConfirmModal
          title="Discard unsaved changes?"
          message="Switching workspace closes what you are editing here. Changes you haven’t saved will be lost."
          confirmLabel="Switch and discard"
          onConfirm={() => {
            const target = pending;
            setPending(null);
            void switchTo(target, { discardUnsaved: true });
          }}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}
