'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, Check, type LucideIcon, MapPin } from 'lucide-react';
import Link from 'next/link';

import { getLocationsByTenant, getTenants } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Sits above the workspace list and makes the two-step flow explicit:
// pick a workspace, then a location — and links straight to the till once
// both are set. Reads names from the same query caches the panels use, so
// it stays in sync with no extra fetches.
export function WorkspaceContextBar() {
  const { tenantId, locationId } = useWorkspaceStore();

  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: getTenants });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const tenant = tenants.find((t) => t.id === tenantId);
  const location = locations.find((l) => l.id === locationId);
  const ready = !!tenant && !!location;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Step index={1} label="Workspace" value={tenant?.name} done={!!tenant} icon={Building2} />
        <div className="h-px w-4 bg-border shrink-0" aria-hidden="true" />
        <Step index={2} label="Location" value={location?.name} done={!!location} icon={MapPin} muted={!tenant} />
      </div>

      {ready ? (
        <Link
          href="/pos"
          className="h-9 px-3 shrink-0 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
        >
          Start taking orders
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      ) : (
        <p className="text-xs text-muted-foreground shrink-0">
          {!tenant ? 'Select a workspace to begin.' : 'Now pick a location on the right.'}
        </p>
      )}
    </div>
  );
}

function Step({
  index,
  label,
  value,
  done,
  icon: Icon,
  muted,
}: {
  index: number;
  label: string;
  value?: string;
  done: boolean;
  icon: LucideIcon;
  muted?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2 min-w-0', muted && 'opacity-50')}>
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
          done ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
        )}
      >
        {done ? <Check size={14} aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">
          Step {index} · {label}
        </p>
        <p className={cn('text-sm font-semibold truncate leading-tight mt-0.5', value ? 'text-foreground' : 'text-muted-foreground/60')}>
          {value ?? 'Not selected'}
        </p>
      </div>
    </div>
  );
}
