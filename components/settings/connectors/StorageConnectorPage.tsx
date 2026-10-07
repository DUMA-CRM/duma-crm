'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { StorageMeter } from '@/components/cms/StorageMeter';
import { Panel, PanelError, cmsKeys, invalidateCms } from '@/components/cms/shared';
import { AlertTriangle, ArrowRight, CheckCircle2, Database, Pencil, Plug, RefreshCw, Trash2 } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  type CmsStorage,
  type CmsStorageConnection,
  deleteCmsStorageConnection,
  getCmsStorage,
  migrateCmsStorage,
  setCmsActiveStorage,
  verifyCmsStorageConnection,
} from '@/lib/modules/cms/client';
import { formatBytes } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { EditStorageDialog } from './EditStorageDialog';
import { storageProviderLabel } from './StorageConnector';

/**
 * Settings → Connectors → Media storage: where Content's uploads go, and how
 * full each place is. Every workspace has free built-in DUMA storage;
 * connecting a bucket moves new uploads there. Existing files stay where they
 * were written, so switching never breaks a URL. The route is gated on
 * `cms.keys:write` — the same capability the API checks.
 */
export function StorageConnectorPage({ onClose, onConnect }: { onClose: () => void; onConnect: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CmsStorageConnection | null>(null);
  const [disconnecting, setDisconnecting] = useState<CmsStorageConnection | null>(null);
  const [moving, setMoving] = useState<null | { from: 'builtIn' | string; name: string; files: number }>(null);
  const [progress, setProgress] = useState<null | { moved: number; total: number }>(null);

  /** Move in batches until nothing is left, or a batch moves nothing (the rest failed). */
  async function moveFiles(from: 'builtIn' | string, total: number) {
    setProgress({ moved: 0, total });
    let moved = 0;
    const failures = new Map<string, string>();
    try {
      for (;;) {
        const batch = await migrateCmsStorage(from, tenantId ?? undefined);
        moved += batch.moved;
        for (const failure of batch.failed) failures.set(failure.id, failure.error);
        setProgress({ moved, total });
        if (batch.remaining === 0 || batch.moved === 0) break;
      }
      if (failures.size > 0) toast('error', `Moved ${moved}; ${failures.size} couldn’t be moved: ${[...new Set(failures.values())][0]}`);
      else toast('success', `Moved ${moved} ${moved === 1 ? 'file' : 'files'}.`);
    } catch (error) {
      toast('error', `${moved > 0 ? `Moved ${moved}, then stopped: ` : ''}${error instanceof Error ? error.message : 'the move failed'}`);
    } finally {
      invalidateCms(queryClient);
      setProgress(null);
      setMoving(null);
    }
  }

  const query = useQuery({
    queryKey: cmsKeys.storage(tenantId),
    queryFn: () => getCmsStorage(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const activate = useMutation({
    mutationFn: (connectionId: string | null) => setCmsActiveStorage(connectionId, tenantId ?? undefined),
    onSuccess: (_, connectionId) => {
      invalidateCms(queryClient);
      toast('success', connectionId ? 'New uploads now go to this bucket.' : 'New uploads now go to DUMA storage.');
    },
    onError: (error) => toast('error', error.message),
  });
  const verify = useMutation({
    mutationFn: (id: string) => verifyCmsStorageConnection(id, tenantId ?? undefined),
    onSuccess: (connection) => {
      invalidateCms(queryClient);
      if (connection.lastError) toast('error', connection.lastError);
      else toast('success', `${connection.displayName} is working.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCmsStorageConnection(id, tenantId ?? undefined),
    onSuccess: () => {
      invalidateCms(queryClient);
      toast('success', 'Storage disconnected.');
      setDisconnecting(null);
    },
    onError: (error) => {
      setDisconnecting(null);
      toast('error', error.message);
    },
  });

  return (
    <EditorShell
      eyebrow="Connector"
      title="Media storage"
      icon={<Database size={20} aria-hidden="true" />}
      onClose={onClose}
      actions={
        <Button className="h-9 gap-1.5" onClick={onConnect}>
          <Plug size={15} aria-hidden="true" />
          <span className="hidden md:inline">Connect a bucket</span>
        </Button>
      }
    >
      {query.isError ? (
        <PanelError title="Storage couldn’t be loaded" onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <LoadingState label="Loading storage" />
      ) : (
        <StorageBody
          storage={query.data}
          busy={activate.isPending}
          verifying={verify.isPending ? verify.variables : null}
          onActivate={(id) => activate.mutate(id)}
          onVerify={(id) => verify.mutate(id)}
          onEdit={setEditing}
          onDisconnect={setDisconnecting}
          onConnect={onConnect}
          onMoveFiles={(from, name, files) => setMoving({ from, name, files })}
        />
      )}

      {moving && query.data && (
        <ConfirmModal
          title={
            progress
              ? `Moving files… ${progress.moved} of ${progress.total}`
              : `Move ${moving.files} ${moving.files === 1 ? 'file' : 'files'} from ${moving.name}?`
          }
          message={`Each file is copied to ${activeName(query.data)}, then removed from ${moving.name}. Assets keep their ids, so entries keep working, and DUMA links keep working. A link written with ${moving.name}’s own public URL stops working. Keep this page open until it finishes.`}
          confirmLabel="Move files"
          isPending={progress !== null}
          onConfirm={() => void moveFiles(moving.from, moving.files)}
          onClose={() => {
            if (!progress) setMoving(null);
          }}
        />
      )}

      {editing && <EditStorageDialog connection={editing} onClose={() => setEditing(null)} />}
      {disconnecting && (
        <ConfirmModal
          title={`Disconnect ${disconnecting.displayName}?`}
          message={
            disconnecting.isActive
              ? 'New uploads go back to DUMA storage. The bucket and anything else in it are not touched.'
              : 'DUMA forgets these credentials. The bucket and anything else in it are not touched.'
          }
          confirmLabel="Disconnect"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(disconnecting.id)}
          onClose={() => setDisconnecting(null)}
        />
      )}
    </EditorShell>
  );
}

function StorageBody({
  storage,
  busy,
  verifying,
  onActivate,
  onVerify,
  onEdit,
  onDisconnect,
  onConnect,
  onMoveFiles,
}: {
  storage: CmsStorage;
  busy: boolean;
  verifying: string | null;
  onActivate: (id: string | null) => void;
  onVerify: (id: string) => void;
  onEdit: (connection: CmsStorageConnection) => void;
  onDisconnect: (connection: CmsStorageConnection) => void;
  onConnect: () => void;
  onMoveFiles: (from: 'builtIn' | string, name: string, files: number) => void;
}) {
  const { builtIn, connections, active } = storage;
  const target = activeName(storage);
  const moveButton = (from: 'builtIn' | string, name: string, files: number) => (
    <Button size="sm" variant="ghost" className="gap-1" disabled={busy} onClick={() => onMoveFiles(from, name, files)}>
      Move files to {target} <ArrowRight size={13} aria-hidden="true" />
    </Button>
  );
  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[64ch] text-sm text-muted-foreground">
        Content’s uploads go to the storage marked <span className="font-medium text-foreground">Receiving uploads</span>. Switching only
        affects new uploads — files already stored stay where they are, so no link breaks.
      </p>

      <Panel className="divide-y divide-rule/50">
        <StorageRow
          icon={<Database size={18} aria-hidden="true" />}
          name="DUMA storage"
          detail={`Included free · ${formatBytes(builtIn.quotaBytes)} per workspace`}
          active={active.kind === 'builtIn'}
          fileCount={builtIn.fileCount}
          meter={<StorageMeter byKind={builtIn.byKind} quotaBytes={builtIn.quotaBytes} />}
          actions={
            active.kind !== 'builtIn' ? (
              <>
                {builtIn.fileCount > 0 && moveButton('builtIn', 'DUMA storage', builtIn.fileCount)}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => onActivate(null)}>
                  Use for new uploads
                </Button>
              </>
            ) : null
          }
        />

        {connections.map((connection) => (
          <StorageRow
            key={connection.id}
            icon={<Plug size={18} aria-hidden="true" />}
            name={connection.displayName}
            detail={storageProviderLabel(connection)}
            active={connection.isActive}
            fileCount={connection.fileCount}
            status={
              connection.lastError ? (
                <span className="inline-flex items-center gap-1 text-xs text-exception">
                  <AlertTriangle size={12} aria-hidden="true" /> {connection.lastError}
                </span>
              ) : connection.lastVerifiedAt ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 size={12} className="text-momentum" aria-hidden="true" /> Checked{' '}
                  <RelativeTime iso={connection.lastVerifiedAt} />
                </span>
              ) : null
            }
            meter={<StorageMeter byKind={connection.byKind} quotaBytes={connection.quotaBytes} />}
            actions={
              <>
                {!connection.isActive &&
                  connection.fileCount > 0 &&
                  moveButton(connection.id, connection.displayName, connection.fileCount)}
                {!connection.isActive && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => onActivate(connection.id)}>
                    Use for new uploads
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1"
                  disabled={verifying === connection.id}
                  onClick={() => onVerify(connection.id)}
                >
                  <RefreshCw size={13} aria-hidden="true" /> {verifying === connection.id ? 'Testing…' : 'Test'}
                </Button>
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => onEdit(connection)}>
                  <Pencil size={13} aria-hidden="true" /> Edit
                </Button>
                <Tooltip
                  side="top"
                  label={
                    connection.fileCount > 0 ? 'Files are stored here — move them elsewhere first' : 'Forget this bucket’s credentials'
                  }
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-exception hover:text-exception"
                    disabled={connection.fileCount > 0}
                    onClick={() => onDisconnect(connection)}
                  >
                    <Trash2 size={13} aria-hidden="true" /> Disconnect
                  </Button>
                </Tooltip>
              </>
            }
          />
        ))}
      </Panel>

      {connections.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-rule/60 px-4 py-3.5">
          <p className="text-sm text-muted-foreground">
            Need more than {formatBytes(builtIn.quotaBytes)}, or files served from your own domain? Connect Cloudflare R2, AWS S3, Backblaze
            B2, DigitalOcean Spaces, MinIO or Vercel Blob.
          </p>
          <Button variant="outline" className="gap-1.5" onClick={onConnect}>
            <Plug size={14} aria-hidden="true" /> Connect a bucket
          </Button>
        </div>
      )}
    </div>
  );
}

function StorageRow({
  icon,
  name,
  detail,
  active,
  fileCount,
  status,
  meter,
  actions,
}: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  active: boolean;
  fileCount: number;
  status?: React.ReactNode;
  meter: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <section className={cn('space-y-3 p-4', active && 'bg-primary/4')} aria-label={name}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 text-muted-foreground">{icon}</span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              {name}
              {active && <Badge variant="success">Receiving uploads</Badge>}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {detail} · {fileCount} {fileCount === 1 ? 'file' : 'files'}
            </p>
            {status}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-1">{actions}</div>}
      </div>
      {meter}
    </section>
  );
}

/** The name of the storage receiving uploads now. */
function activeName(storage: CmsStorage): string {
  return storage.active.kind === 'builtIn'
    ? 'DUMA storage'
    : (storage.connections.find((connection) => connection.id === storage.active.connectionId)?.displayName ?? 'the active storage');
}
