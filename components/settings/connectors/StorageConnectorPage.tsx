'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useCmsTenantId, useContentPaths } from '@/components/cms/ContentScope';
import { StorageMeter } from '@/components/cms/StorageMeter';
import { BrandTile, RowMenu, type RowMenuItem, RowTile, SectionInfo } from '@/components/cms/rows';
import { cmsKeys, invalidateCms } from '@/components/cms/shared';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  Database,
  ImageIcon,
  Pencil,
  Plug,
  RefreshCw,
  Trash2,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { RelativeTime } from '@/components/shared/RelativeTime';
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
import { toast } from '@/lib/toast';
import { formatBytes } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';

import { ConnectorManagePage, type ConnectorStatus } from './ConnectorManagePage';
import { EditStorageDialog } from './EditStorageDialog';
import { storageProviderLabel } from './StorageConnector';
import { PROVIDER_BRANDS } from './brands';
import { CONNECTORS_BY_ID } from './registry';

const DEFINITION = CONNECTORS_BY_ID['media-storage'];

/**
 * Settings → Connectors → Media storage: where Content's uploads go, and how
 * full each place is. Every workspace has free built-in DUMA storage;
 * connecting a bucket moves new uploads there. Existing files stay where they
 * were written, so switching never breaks a URL. The route is gated on
 * `cms.keys:write` — the same capability the API checks.
 */
export function StorageConnectorPage({ onClose, onConnect }: { onClose: () => void; onConnect: () => void }) {
  const tenantId = useCmsTenantId();
  const { basePath } = useContentPaths();
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

  const storage = query.data;
  const activeConnection = storage?.connections.find((connection) => connection.isActive);
  const status: ConnectorStatus | undefined = !storage
    ? undefined
    : activeConnection?.lastError
      ? { tone: 'danger', text: 'The last check failed' }
      : activeConnection
        ? { tone: 'success', text: `Uploads go to ${activeConnection.displayName}` }
        : { tone: 'muted', text: 'Using DUMA storage' };
  const used = activeConnection ?? storage?.builtIn;
  const quota = activeConnection ? activeConnection.quotaBytes : storage?.builtIn.quotaBytes;
  const files = storage ? storage.builtIn.fileCount + storage.connections.reduce((sum, connection) => sum + connection.fileCount, 0) : 0;

  return (
    <ConnectorManagePage
      definition={DEFINITION}
      brand={activeConnection ? storageBrand(activeConnection) : undefined}
      status={status}
      loading={query.isPending}
      error={query.isError ? { title: 'Storage couldn’t be loaded', onRetry: () => void query.refetch() } : undefined}
      health={
        storage
          ? {
              facts: [
                { icon: CloudUpload, title: 'Receiving uploads', value: activeName(storage) },
                {
                  icon: Database,
                  title: 'Space used',
                  value: `${formatBytes(used?.usedBytes ?? 0)}${quota ? ` of ${formatBytes(quota)}` : ''}`,
                  tone: quota && (used?.usedBytes ?? 0) >= quota * 0.8 ? 'warning' : undefined,
                },
                { icon: ImageIcon, title: 'Files', value: String(files) },
              ],
              problem: activeConnection?.lastError,
              test: activeConnection
                ? {
                    label: 'Test the bucket',
                    icon: RefreshCw,
                    pending: verify.isPending,
                    onTest: () => verify.mutate(activeConnection.id),
                  }
                : undefined,
            }
          : undefined
      }
      usedBy={[{ icon: ImageIcon, label: 'Content media', count: storage ? files : undefined, href: `${basePath}?tab=media` }]}
      actions={[{ icon: Plug, label: 'Connect a bucket', onClick: onConnect }]}
      onClose={onClose}
    >
      {storage && (
        <StorageBody
          storage={storage}
          busy={activate.isPending}
          verifying={verify.isPending ? verify.variables : null}
          onActivate={(id) => activate.mutate(id)}
          onVerify={(id) => verify.mutate(id)}
          onEdit={setEditing}
          onDisconnect={setDisconnecting}
          onConnect={onConnect}
          onMoveFiles={(from, name, count) => setMoving({ from, name, files: count })}
        />
      )}

      {moving && storage && (
        <ConfirmModal
          title={
            progress
              ? `Moving files… ${progress.moved} of ${progress.total}`
              : `Move ${moving.files} ${moving.files === 1 ? 'file' : 'files'} from ${moving.name}?`
          }
          message={`Each file is copied to ${activeName(storage)}, then removed from ${moving.name}. Assets keep their ids, so entries keep working, and DUMA links keep working. A link written with ${moving.name}’s own public URL stops working. Keep this page open until it finishes.`}
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
            <div className="space-y-2">
              <p>This will happen straight away:</p>
              <ul className="list-disc space-y-1 pl-5">
                {disconnecting.isActive && <li>New uploads go back to DUMA storage.</li>}
                <li>DUMA forgets this bucket’s credentials.</li>
                <li>The bucket and anything else in it are not touched.</li>
              </ul>
            </div>
          }
          confirmText={disconnecting.displayName}
          confirmLabel="Disconnect"
          pendingLabel="Disconnecting…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(disconnecting.id)}
          onClose={() => setDisconnecting(null)}
        />
      )}
    </ConnectorManagePage>
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
  const moveItem = (from: 'builtIn' | string, name: string, files: number): RowMenuItem => ({
    icon: ArrowRight,
    label: `Move files to ${target}`,
    disabled: busy,
    onClick: () => onMoveFiles(from, name, files),
  });
  return (
    <SettingsSection
      title="Where files are kept"
      actions={
        <SectionInfo label="Uploads go to the storage marked Receiving uploads. Switching only affects new uploads — files already stored stay where they are, so no link breaks." />
      }
    >
      <div className="flex flex-col gap-2">
        <StorageRow
          tile={<RowTile icon={Database} />}
          name="DUMA storage"
          detail={`Included free · ${formatBytes(builtIn.quotaBytes)}`}
          active={active.kind === 'builtIn'}
          fileCount={builtIn.fileCount}
          meter={<StorageMeter byKind={builtIn.byKind} quotaBytes={builtIn.quotaBytes} />}
          menu={
            active.kind !== 'builtIn'
              ? [
                  { icon: CloudUpload, label: 'Use for new uploads', disabled: busy, onClick: () => onActivate(null) },
                  ...(builtIn.fileCount > 0 ? [moveItem('builtIn', 'DUMA storage', builtIn.fileCount)] : []),
                ]
              : []
          }
        />

        {connections.map((connection) => {
          const brand = storageBrand(connection);
          return (
            <StorageRow
              key={connection.id}
              tile={brand ? <BrandTile brand={brand} /> : <RowTile icon={Plug} />}
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
              menu={[
                ...(!connection.isActive
                  ? [{ icon: CloudUpload, label: 'Use for new uploads', disabled: busy, onClick: () => onActivate(connection.id) }]
                  : []),
                ...(!connection.isActive && connection.fileCount > 0
                  ? [moveItem(connection.id, connection.displayName, connection.fileCount)]
                  : []),
                {
                  icon: RefreshCw,
                  label: verifying === connection.id ? 'Testing…' : 'Test',
                  disabled: verifying === connection.id,
                  onClick: () => onVerify(connection.id),
                },
                { icon: Pencil, label: 'Edit', onClick: () => onEdit(connection) },
                {
                  icon: Trash2,
                  label: connection.fileCount > 0 ? 'Disconnect — move its files first' : 'Disconnect',
                  danger: true,
                  disabled: connection.fileCount > 0,
                  onClick: () => onDisconnect(connection),
                },
              ]}
            />
          );
        })}
      </div>

      {connections.length === 0 && (
        <div className="mt-4">
          <Button variant="outline" className="gap-1.5" onClick={onConnect}>
            <Plug size={14} aria-hidden="true" /> Connect a bucket
          </Button>
        </div>
      )}
    </SettingsSection>
  );
}

function StorageRow({
  tile,
  name,
  detail,
  active,
  fileCount,
  status,
  meter,
  menu,
}: {
  tile: React.ReactNode;
  name: string;
  detail: string;
  active: boolean;
  fileCount: number;
  status?: React.ReactNode;
  meter: React.ReactNode;
  menu: RowMenuItem[];
}) {
  return (
    <section className={cn('space-y-3 rounded-lg border bg-field p-3', active ? 'border-primary/50' : 'border-rule/50')} aria-label={name}>
      <div className="flex items-start gap-3">
        {tile}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {name}
            {active && <Badge variant="success">Receiving uploads</Badge>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {detail} · {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </p>
          {status}
        </div>
        {menu.length > 0 && <RowMenu label={`${name} actions`} items={menu} />}
      </div>
      {meter}
    </section>
  );
}

/** A bucket's brand, from where it lives — for its tile and the page header. */
function storageBrand(connection: CmsStorageConnection) {
  if (connection.provider === 'vercel_blob') return PROVIDER_BRANDS.vercel;
  const endpoint = connection.configuration.endpoint;
  if (endpoint?.includes('.r2.cloudflarestorage.com')) return PROVIDER_BRANDS.cloudflare;
  return endpoint ? undefined : PROVIDER_BRANDS.s3;
}

/** The name of the storage receiving uploads now. */
function activeName(storage: CmsStorage): string {
  return storage.active.kind === 'builtIn'
    ? 'DUMA storage'
    : (storage.connections.find((connection) => connection.id === storage.active.connectionId)?.displayName ?? 'the active storage');
}
