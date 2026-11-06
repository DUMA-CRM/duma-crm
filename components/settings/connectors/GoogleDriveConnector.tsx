'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FileText, Lock, NotebookPen, RefreshCw, UserRound } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { disconnectGoogleDrive, getGoogleDriveStatus, startGoogleDriveConnect } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';

import { ConnectorManagePage, type ConnectorStatus } from './ConnectorManagePage';
import { CONNECTOR_BRANDS } from './brands';
import { CONNECTORS_BY_ID } from './registry';
import { panelClass } from './shared';

const DEFINITION = CONNECTORS_BY_ID['google-drive'];

/**
 * Each person's own Google Drive, used from Notes. Connecting goes straight to
 * Google (and back to the list); this page is for once it's connected.
 */
export function GoogleDriveConnectorPage({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const key = moduleQueryKeys.notes.key('google-status');
  const query = useQuery({ queryKey: key, queryFn: getGoogleDriveStatus, retry: false });
  const connect = useMutation({
    mutationFn: startGoogleDriveConnect,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast('error', error.message),
  });
  const disconnect = useMutation({
    mutationFn: disconnectGoogleDrive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.all });
      toast('success', 'Google Drive disconnected. Your notes stopped syncing; the Docs stay in your Drive.');
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });

  const drive = query.data;
  const connected = Boolean(drive?.status && drive.status !== 'revoked');
  const status: ConnectorStatus | undefined = !connected
    ? undefined
    : drive?.canSync
      ? { tone: 'success', text: 'Connected' }
      : drive?.status === 'error'
        ? { tone: 'danger', text: 'Google stopped accepting the connection' }
        : { tone: 'warning', text: 'DUMA needs permission to save Docs' };

  return (
    <ConnectorManagePage
      definition={DEFINITION}
      brand={CONNECTOR_BRANDS['google-drive']}
      status={status}
      loading={query.isPending}
      error={query.isError ? { title: 'Couldn’t load Google Drive', onRetry: () => void query.refetch() } : undefined}
      notSetUp={
        !connected ? (
          <div className={panelClass}>
            <p className="text-sm text-muted-foreground">Sync your notes to Google Docs in your own Drive.</p>
            <Button className="mt-4 gap-1.5" disabled={connect.isPending} onClick={() => connect.mutate()}>
              {connect.isPending ? 'Opening Google…' : 'Connect Google Drive'}
            </Button>
          </div>
        ) : undefined
      }
      health={
        connected && drive
          ? {
              facts: [
                { icon: UserRound, title: 'Account', value: drive.email ?? 'Your Google account' },
                {
                  icon: FileText,
                  title: 'Google Docs',
                  value: drive.canSync ? 'Can create' : 'Needs permission',
                  tone: drive.canSync ? undefined : 'warning',
                },
                { icon: Lock, title: 'Who sees it', value: 'Only you' },
              ],
              problem: drive.canSync ? null : (drive.lastError ?? 'Connect again and allow DUMA to create files in your Drive.'),
            }
          : undefined
      }
      usedBy={[{ icon: NotebookPen, label: 'Notes', href: '/notes' }]}
      actions={[{ icon: RefreshCw, label: 'Connect again', onClick: () => connect.mutate(), disabled: connect.isPending }]}
      disconnect={{
        consequences: ['Your notes stop syncing to Google Docs.', 'The Docs already created stay in your Drive.'],
        pending: disconnect.isPending,
        onConfirm: () => disconnect.mutate(),
      }}
      onClose={onClose}
    />
  );
}
