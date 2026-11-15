'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Building2, Check, LayoutDashboard, Search, ShieldCheck } from '@/components/icons';
import { TileSkeleton } from '@/components/shared/TileSkeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import { getPlatformContext } from '@/lib/api/platform.service';
import { useTenants } from '@/lib/hooks/useTenants';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import type { WorkspaceContext } from '@/lib/utils/workspace-context';

export type Target = Exclude<WorkspaceContext, { kind: 'unresolved' }>;

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
            selected ? 'border-primary bg-primary/5' : 'border-border bg-background/60 hover:border-rule hover:bg-band/45',
          )}
        >
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md border',
              selected ? 'border-primary/40 bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground',
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
            <Badge variant="reference">Internal</Badge>,
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
          <li className="rounded-lg border border-border px-3.5 py-3 text-sm text-muted-foreground">
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
