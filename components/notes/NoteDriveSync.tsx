'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { CloudOff, ExternalLink, GoogleDrive, Loader2, RefreshCw, TriangleAlert } from '@/components/icons';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Button } from '@/components/ui/button';

import {
  type Note,
  type NoteDriveSync,
  getGoogleDriveStatus,
  getNoteDriveSync,
  pushNoteDriveSync,
  startNoteDriveSync,
  stopNoteDriveSync,
} from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { driveSyncPollMs, driveSyncSummary } from '@/lib/utils/note-drive-sync';
import { toast } from '@/stores/toastStore';

export interface DriveMenuItem {
  key: string;
  icon: typeof GoogleDrive;
  label: string;
  onClick: () => void;
}

/**
 * A note's Google Docs sync, for the person looking at it: one way, into their
 * own Drive, switched on per note from the "…" menu. Nothing here shows unless
 * they've connected Google Drive in Settings → Connectors.
 */
export function useNoteDriveSync(note: Pick<Note, 'id' | 'version' | 'deletedAt'>) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const syncKey = moduleQueryKeys.notes.key('drive-sync', note.id);

  // Same key Settings → Connectors uses, so connecting there is seen here.
  const status = useQuery({ queryKey: moduleQueryKeys.notes.key('google-status'), queryFn: getGoogleDriveStatus, staleTime: 60_000 });
  const connected = status.data?.configured === true && status.data.connected;
  const sync = useQuery({
    queryKey: syncKey,
    queryFn: () => getNoteDriveSync(note.id),
    enabled: connected,
    refetchInterval: (query) => driveSyncPollMs(query.state.data),
  });

  // A save makes a synced note pending again — ask, so the line says so and polling starts.
  const synced = sync.data != null;
  useEffect(() => {
    if (synced) void queryClient.invalidateQueries({ queryKey: syncKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on each new version only
  }, [note.version]);

  const settle = (data: NoteDriveSync | null) => {
    queryClient.setQueryData(syncKey, data);
    void queryClient.invalidateQueries({ queryKey: syncKey });
  };
  const start = useMutation({
    mutationFn: () => startNoteDriveSync(note.id),
    onSuccess: (data) => {
      settle(data);
      toast(data.status === 'active' ? 'success' : 'error', data.status === 'active' ? 'Syncing to Google Docs.' : driveSyncSummary(data).message);
    },
    onError: (error) => toast('error', error.message),
  });
  const push = useMutation({
    mutationFn: (overwrite: boolean) => pushNoteDriveSync(note.id, overwrite),
    onSuccess: (data) => {
      settle(data);
      if (data && data.status !== 'active') toast('error', driveSyncSummary(data).message);
    },
    onError: (error) => toast('error', error.message),
  });
  const stop = useMutation({
    mutationFn: () => stopNoteDriveSync(note.id),
    onSuccess: () => {
      settle(null);
      toast('success', 'Stopped syncing. The Google Doc stays in your Drive.');
    },
    onError: (error) => toast('error', error.message),
  });

  const menuItems: DriveMenuItem[] = [];
  if (connected && note.deletedAt === null) {
    if (!status.data!.canSync) {
      menuItems.push({
        key: 'reconnect',
        icon: GoogleDrive,
        label: 'Reconnect Google Drive to sync',
        onClick: () => router.push('/settings/connectors'),
      });
    } else if (sync.data) {
      const { url } = sync.data;
      if (url) menuItems.push({ key: 'open', icon: ExternalLink, label: 'Open in Google Docs', onClick: () => window.open(url, '_blank', 'noopener') });
      menuItems.push(
        { key: 'push', icon: RefreshCw, label: 'Sync now', onClick: () => push.mutate(false) },
        { key: 'stop', icon: CloudOff, label: 'Stop syncing to Google Docs', onClick: () => stop.mutate() },
      );
    } else if (sync.isSuccess) {
      menuItems.push({ key: 'start', icon: GoogleDrive, label: 'Sync to Google Docs', onClick: () => start.mutate() });
    }
  }

  return {
    sync: connected ? (sync.data ?? null) : null,
    busy: start.isPending || push.isPending || stop.isPending,
    menuItems,
    fix: (overwrite: boolean) => push.mutate(overwrite),
    stop: () => stop.mutate(),
  };
}

/** Under the note's bar while it syncs: a quiet line, or the choice a stopped sync needs. */
export function DriveSyncBar({ drive }: { drive: ReturnType<typeof useNoteDriveSync> }) {
  if (!drive.sync) return null;
  const summary = driveSyncSummary(drive.sync);
  const { url, pushedAt } = drive.sync;

  if (summary.tone === 'stopped') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-measured/40 bg-measured/8 px-5 py-2.5 text-sm">
        <TriangleAlert size={16} className="shrink-0 text-measured" aria-hidden="true" />
        <span className="min-w-0 flex-1">{summary.message}</span>
        {url && summary.fix === 'overwrite' && (
          <Button size="sm" variant="ghost" onClick={() => window.open(url, '_blank', 'noopener')}>
            See the Doc
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={drive.busy} onClick={drive.stop}>
          Stop syncing
        </Button>
        <Button size="sm" disabled={drive.busy} onClick={() => drive.fix(summary.fix !== 'retry')}>
          {summary.fixLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-rule/40 px-5 py-1.5 text-xs text-muted-foreground" aria-live="polite">
      <GoogleDrive size={13} aria-hidden="true" />
      <span>
        {summary.message}
        {summary.showPushedAt && pushedAt && (
          <>
            {' '}
            <RelativeTime iso={pushedAt} />
          </>
        )}
      </span>
      {drive.busy && <Loader2 size={12} className="animate-spin" aria-label="Syncing" />}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto font-medium text-primary hover:underline">
          Open in Google Docs
        </a>
      )}
    </div>
  );
}
