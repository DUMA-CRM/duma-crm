'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { type CmsStorage, getCmsStorage } from '@/lib/modules/cms/client';
import { formatBytes } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { type StorageKind, storageMeter } from '@/lib/utils/media-storage';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { StorageMeter } from './StorageMeter';
import { cmsKeys } from './shared';
import { useCmsAccess } from './useCmsAccess';

export interface UploadTarget {
  name: string;
  /** Built-in DUMA storage rather than a connected bucket. */
  builtIn: boolean;
  byKind: Record<StorageKind, number>;
  usedBytes: number;
  quotaBytes: number | null;
  freeBytes: number | null;
}

/** Where new uploads go, how full it is, and what is free there (null: no limit). */
export function uploadTarget(storage: CmsStorage | undefined) {
  if (!storage) return null;
  const connection =
    storage.active.kind === 'connection' ? storage.connections.find((row) => row.id === storage.active.connectionId) : undefined;
  const place = connection
    ? {
        name: connection.displayName,
        byKind: connection.byKind,
        usedBytes: connection.usedBytes,
        quotaBytes: connection.quotaBytes,
        connectionId: connection.id,
      }
    : {
        name: 'DUMA storage',
        byKind: storage.builtIn.byKind,
        usedBytes: storage.builtIn.usedBytes,
        quotaBytes: storage.builtIn.quotaBytes,
        connectionId: null,
      };
  return {
    ...place,
    builtIn: !connection,
    freeBytes: place.quotaBytes === null ? null : Math.max(0, place.quotaBytes - place.usedBytes),
  } satisfies UploadTarget & { connectionId: string | null };
}

/** The overview uses the same target and cached usage data as the Media header. */
export function ContentStorageUsage() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const access = useCmsAccess();
  const storage = useQuery({
    queryKey: cmsKeys.storage(tenantId),
    queryFn: () => getCmsStorage(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const target = uploadTarget(storage.data);
  if (target) return <StorageUsage target={target} canManage={access.canManageKeys} />;
  if (storage.isError)
    return (
      <Button variant="outline" className="h-9 text-xs" onClick={() => void storage.refetch()}>
        Retry storage usage
      </Button>
    );
  return (
    <span
      role="status"
      aria-label="Loading storage usage"
      className="h-9 w-24 animate-pulse rounded-md border border-rule/60 bg-band motion-reduce:animate-none"
    />
  );
}

const TONE = {
  ok: { fill: 'bg-primary', text: 'text-foreground' },
  nearly: { fill: 'bg-measured', text: 'text-measured' },
  full: { fill: 'bg-exception', text: 'text-exception' },
} as const;

/**
 * How full the place uploads go to is — a status beside Upload, not a section
 * of the page. The trigger is one short bar and two figures; the breakdown by
 * kind, where uploads go and the way to get more space open on demand. It
 * turns amber at 90% and red when full, which is when it needs to be noticed.
 */
export function StorageUsage({ target, canManage }: { target: UploadTarget; canManage: boolean }) {
  const meter = storageMeter(target.byKind, target.quotaBytes);
  const tone = TONE[meter.state];
  // Without a limit there is nothing to fill; the bar would only ever look empty.
  const fill = meter.percentUsed ?? 0;
  const summary =
    meter.quotaBytes === null
      ? `${formatBytes(meter.usedBytes)} used in ${target.name}, no limit set`
      : `${formatBytes(meter.usedBytes)} of ${formatBytes(meter.quotaBytes)} used in ${target.name}`;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Storage: ${summary}`}
        className={cn(
          'group flex h-9 items-center gap-2.5 rounded-md border border-rule/60 bg-card px-3 text-xs transition-colors',
          'hover:border-rule hover:bg-band/40 data-[state=open]:border-rule data-[state=open]:bg-band/50',
          meter.state === 'full' && 'border-exception/50',
        )}
      >
        {meter.quotaBytes !== null && (
          <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-band sm:w-14" aria-hidden="true">
            {/* A used workspace always shows some ink, however small its share. */}
            <span
              className={cn('absolute inset-y-0 left-0 rounded-full', tone.fill)}
              style={{ width: `${meter.usedBytes > 0 ? Math.max(fill, 4) : 0}%` }}
            />
          </span>
        )}
        <span className="hidden whitespace-nowrap sm:inline" aria-hidden="true">
          <span className={cn('tabular-nums font-semibold', tone.text)}>{formatBytes(meter.usedBytes)}</span>
          {meter.quotaBytes !== null && <span className="tabular-nums text-muted-foreground"> / {formatBytes(meter.quotaBytes)}</span>}
        </span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="space-y-4 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{target.name}</p>
            <p className="text-xs text-muted-foreground">
              {target.builtIn ? 'Included free with every workspace' : 'Your connected bucket'} · new uploads go here
            </p>
          </div>

          <div>
            <p className="flex items-baseline gap-1.5">
              <span className={cn('tabular-nums text-2xl font-semibold', tone.text)}>{formatBytes(meter.usedBytes)}</span>
              <span className="text-sm text-muted-foreground">used</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {meter.quotaBytes === null ? (
                'No limit set for this bucket'
              ) : meter.state === 'full' ? (
                <span className="font-medium text-exception">Full — uploads are refused until space is freed</span>
              ) : (
                <>
                  <span className="tabular-nums text-foreground">{formatBytes(meter.freeBytes ?? 0)}</span> free of{' '}
                  <span className="tabular-nums">{formatBytes(meter.quotaBytes)}</span>
                  {meter.state === 'nearly' && <span className="font-medium text-measured"> · nearly full</span>}
                </>
              )}
            </p>
          </div>

          {meter.segments.length > 0 && <StorageMeter byKind={target.byKind} quotaBytes={target.quotaBytes} showHeadline={false} />}
        </div>

        <div className="border-t border-rule/50 px-4 py-3 text-xs">
          {canManage ? (
            <Link
              href="/settings/connectors?connector=media-storage"
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
            >
              {target.builtIn ? 'Connect your own storage' : 'Manage storage'}
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          ) : (
            <span className="text-muted-foreground">Need more space? Ask the workspace owner to connect storage.</span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
