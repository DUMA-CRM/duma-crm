'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ArrowLeft, Building2, Check, ChevronDown, LayoutDashboard, Search, ShieldCheck } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Modal } from '@/components/shared/Modal';
import { TileSkeleton } from '@/components/shared/TileSkeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import { getPlatformContext } from '@/lib/api/platform.service';
import { useTenants } from '@/lib/hooks/useTenants';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';
import { useWorkspaceSwitch } from '@/lib/hooks/useWorkspaceSwitch';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { hasUnsavedWork } from '@/lib/utils/unsaved-work';
import type { WorkspaceContext } from '@/lib/utils/workspace-context';
import { useAuthStore } from '@/stores/authStore';
import { useSidebarStore } from '@/stores/sidebarStore';

type Target = Exclude<WorkspaceContext, { kind: 'unresolved' }>;

const STATUS_LABEL = { winding_down: 'Winding down', inactive: 'Inactive' } as const;

/** Platform-level reads use their own context partition, whichever tab asks. */
export const usePlatformContext = (enabled = true) =>
  useQuery({ queryKey: moduleQueryKeys.identity.key('platform-context'), queryFn: getPlatformContext, enabled, staleTime: 60_000 });

/**
 * The places a platform administrator can be: DUMA Admin, DUMA's internal
 * workspace, then every client workspace — searchable, with the name always
 * shown (colour alone says nothing to a screen reader, or across two navies).
 */
export function WorkspacePickerList({ onPick, includePlatform = false }: { onPick: (target: Target) => void; includePlatform?: boolean }) {
  const { context } = useWorkspaceContext();
  const { tenants, isLoading, isError, refetch } = useTenants();
  const platform = usePlatformContext();
  const [query, setQuery] = useState('');

  const internalId = platform.data?.internalWorkspace?.id ?? null;
  const clients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants
      .filter((tenant) => tenant.id !== internalId && tenant.classification !== 'internal')
      .filter((tenant) => !q || `${tenant.name} ${tenant.slug}`.toLowerCase().includes(q));
  }, [internalId, query, tenants]);
  const current = context.kind === 'workspace' ? context.tenantId : context.kind;

  const row = (key: string, label: string, detail: string, target: Target, icon: React.ReactNode, badge?: React.ReactNode) => {
    const selected = target.kind === 'platform' ? current === 'platform' : current === target.tenantId;
    return (
      <li key={key}>
        <button
          type="button"
          onClick={() => onPick(target)}
          aria-current={selected || undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-[border-color,background-color] duration-150',
            'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            selected ? 'border-primary bg-primary/5' : 'border-rule/70 bg-background/60 hover:border-rule hover:bg-band/45',
          )}
        >
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md border',
              selected ? 'border-primary/40 bg-primary text-primary-foreground' : 'border-rule/55 bg-background text-muted-foreground',
            )}
          >
            {selected ? <Check size={16} aria-hidden="true" /> : icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
              {label}
              {badge}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{detail}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      {tenants.length > 5 && (
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search workspaces…"
          aria-label="Search workspaces"
          leftIcon={<Search size={14} aria-hidden="true" />}
          autoFocus
        />
      )}
      <ul className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto" aria-label="Workspaces" aria-busy={isLoading || undefined}>
        {includePlatform &&
          !query &&
          row(
            'platform',
            'DUMA Admin',
            'Platform tools, statistics and every workspace',
            { kind: 'platform' },
            <ShieldCheck size={16} aria-hidden="true" />,
          )}
        {!query &&
          platform.data?.internalWorkspace &&
          row(
            'internal',
            platform.data.internalWorkspace.name,
            'DUMA internal — our own workspace',
            { kind: 'workspace', tenantId: platform.data.internalWorkspace.id, locationId: null },
            <LayoutDashboard size={16} aria-hidden="true" />,
            <Badge variant="reference">Internal</Badge>,
          )}
        {isLoading ? (
          Array.from({ length: 3 }, (_, index) => <TileSkeleton key={index} index={index} />)
        ) : isError ? (
          <li className="rounded-lg border border-rule/70 px-3.5 py-3 text-sm text-muted-foreground">
            Workspaces couldn’t be loaded.{' '}
            <button type="button" className="font-semibold text-foreground underline" onClick={() => void refetch()}>
              Try again
            </button>
          </li>
        ) : clients.length === 0 ? (
          <li className="px-1 py-2 text-sm text-muted-foreground">
            {query ? 'No workspace matches that search.' : 'No client workspaces yet.'}
          </li>
        ) : (
          clients.map((tenant) =>
            row(
              tenant.id,
              tenant.name,
              `${tenant.slug}${tenant.locationCount !== undefined ? ` · ${tenant.locationCount} ${tenant.locationCount === 1 ? 'location' : 'locations'}` : ''}`,
              { kind: 'workspace', tenantId: tenant.id, locationId: null },
              <Building2 size={16} aria-hidden="true" />,
              <>
                {tenant.classification === 'demo' && <Badge variant="muted">Demo</Badge>}
                {tenant.status !== 'active' && (
                  <Badge variant={tenant.status === 'winding_down' ? 'warning' : 'muted'}>{STATUS_LABEL[tenant.status]}</Badge>
                )}
              </>,
            ),
          )
        )}
      </ul>
    </div>
  );
}

/**
 * Where this tab is working, at the top of the navigation. A platform
 * administrator opens the picker from here and, inside a workspace, always has
 * the way back to DUMA Admin. A member sees their workspace's name — they have
 * nowhere else to go, so it is a label, not a control.
 */
export function ContextSwitcher() {
  const isPlatformAccount = useAuthStore((state) => state.role === 'super_admin');
  const { context, workspace } = useWorkspaceContext();
  const { collapsed, mobileOpen } = useSidebarStore();
  const isCollapsed = collapsed && !mobileOpen;
  const switchTo = useWorkspaceSwitch();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Target | null>(null);

  const label = context.kind === 'platform' ? 'DUMA Admin' : (workspace?.name ?? 'Loading…');
  const detail =
    context.kind === 'platform'
      ? 'Platform'
      : workspace?.classification === 'internal'
        ? 'DUMA internal'
        : workspace?.classification === 'demo'
          ? 'Demo workspace'
          : 'Workspace';

  const pick = (target: Target) => {
    setOpen(false);
    if (hasUnsavedWork()) setPending(target);
    else void switchTo(target, { discardUnsaved: true });
  };

  if (context.kind === 'unresolved') return <div className="h-11" aria-hidden="true" />;

  const trigger = (
    <button
      type="button"
      onClick={isPlatformAccount ? () => setOpen(true) : undefined}
      disabled={!isPlatformAccount}
      aria-haspopup={isPlatformAccount ? 'dialog' : undefined}
      aria-label={isCollapsed ? `${label} — switch workspace` : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md text-left text-sidebar-foreground transition-colors duration-150',
        isPlatformAccount &&
          'hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring',
        isCollapsed ? 'mx-auto size-9 justify-center' : 'mx-3 w-[calc(100%-24px)] px-2.5 py-2',
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-foreground/85">
        {context.kind === 'platform' ? <ShieldCheck size={15} aria-hidden="true" /> : <Building2 size={15} aria-hidden="true" />}
      </span>
      {!isCollapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-tight">{label}</span>
            <span className="block truncate text-micro font-semibold text-sidebar-foreground/60">{detail}</span>
          </span>
          {isPlatformAccount && <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-sidebar-foreground/60" />}
        </>
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-1">
      {isCollapsed ? <Tooltip label={label}>{trigger}</Tooltip> : trigger}

      {isPlatformAccount && context.kind === 'workspace' && !isCollapsed && (
        <button
          type="button"
          onClick={() => pick({ kind: 'platform' })}
          className="mx-3 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Back to DUMA Admin
        </button>
      )}

      {open && (
        <Modal
          title="Switch workspace"
          description="Each tab works in one place at a time. Other tabs stay where they are."
          onClose={() => setOpen(false)}
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
    </div>
  );
}
