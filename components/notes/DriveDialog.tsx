'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';

import { FileText, GoogleDrive, Link2, Loader2, Search } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  type DriveFile,
  type Note,
  createNote,
  disconnectGoogleDrive,
  getGoogleDocMarkdown,
  getGoogleDriveStatus,
  searchGoogleDrive,
  startGoogleDriveConnect,
} from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/stores/toastStore';

const GOOGLE_DOC = 'application/vnd.google-apps.document';

/**
 * Your Google Drive, from Notes: connect it, search it, bring a Google Doc in
 * as a note (it can be updated from Google later), or start a note that links
 * to any other file. Each person's own Drive; nothing is shared by connecting.
 */
export function DriveDialog({
  folderId,
  onClose,
  onOpened,
}: {
  folderId: string | null;
  onClose: () => void;
  onOpened: (note: Note) => void;
}) {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: moduleQueryKeys.notes.key('google-status'), queryFn: getGoogleDriveStatus });
  const [search, setSearch] = useState('');
  const deferred = useDeferredValue(search.trim());
  const connected = status.data?.connected === true;
  const files = useQuery({
    queryKey: moduleQueryKeys.notes.key('google-files', deferred),
    queryFn: () => searchGoogleDrive(deferred),
    enabled: connected,
    retry: false,
  });

  const connect = useMutation({
    mutationFn: startGoogleDriveConnect,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast('error', error.message),
  });
  const disconnect = useMutation({
    mutationFn: disconnectGoogleDrive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('google-status') });
      toast('success', 'Google Drive disconnected.');
    },
    onError: (error) => toast('error', error.message),
  });
  const bringIn = useMutation({
    mutationFn: async (file: DriveFile) => {
      const source = {
        provider: 'google_drive' as const,
        fileId: file.id,
        url: file.webViewLink,
        mimeType: file.mimeType,
        modifiedAt: file.modifiedTime,
      };
      if (file.mimeType === GOOGLE_DOC) {
        // The Doc's Markdown becomes the note's document when it first opens.
        const { markdown } = await getGoogleDocMarkdown(file.id);
        return createNote({ folderId, title: file.name, markdown, bodyText: markdown, source });
      }
      // Anything else is linked: a note that opens the file.
      const markdown = `# ${file.name}\n\n[Open in Google Drive](${file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`})\n`;
      return createNote({ folderId, title: file.name, markdown, bodyText: `${file.name}\nOpen in Google Drive`, source });
    },
    onSuccess: async (note) => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.all });
      toast('success', note.title ? `“${note.title}” is in your notes.` : 'Added to your notes.');
      onOpened(note);
    },
    onError: (error) => toast('error', error.message),
  });

  return (
    <Modal title="Google Drive" description="Bring a Google Doc in as a note, or link any file." onClose={onClose} className="max-w-2xl">
      {status.isPending ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : status.isError ? (
        <ErrorState title="Couldn’t check your Google Drive" onRetry={() => void status.refetch()} />
      ) : !status.data.configured ? (
        <EmptyState
          icon={GoogleDrive}
          title="Google Drive isn’t set up yet"
          description="An administrator needs to add DUMA’s Google sign-in. Until then, paste a Drive link into any note."
          compact
        />
      ) : !connected ? (
        <div className="space-y-4 py-2 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Connect your own Google Drive to search it from here. DUMA can only read it, and only you see your files.
            {status.data.status === 'error' && (
              <span className="block font-medium text-exception">The last connection stopped working — connect again.</span>
            )}
          </p>
          <Button className="gap-2" disabled={connect.isPending} onClick={() => connect.mutate()}>
            <GoogleDrive aria-hidden="true" /> {connect.isPending ? 'Opening Google…' : 'Connect Google Drive'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">
              Connected as <span className="font-medium text-foreground">{status.data.email}</span>
            </span>
            <Button variant="ghost" size="sm" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
              Disconnect
            </Button>
          </div>
          <Input
            aria-label="Search your Drive"
            placeholder="Search your Drive"
            value={search}
            autoFocus
            leftIcon={<Search size={14} aria-hidden="true" />}
            onChange={(event) => setSearch(event.target.value)}
          />
          {files.isPending ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-muted-foreground" aria-label="Searching" />
            </div>
          ) : files.isError ? (
            <ErrorState title="Your Drive couldn’t be searched" onRetry={() => void files.refetch()} />
          ) : files.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {deferred ? `Nothing called “${deferred}”.` : 'Your Drive is empty.'}
            </p>
          ) : (
            <ul className="max-h-[50vh] space-y-1 overflow-auto">
              {files.data.map((file) => {
                const doc = file.mimeType === GOOGLE_DOC;
                return (
                  <li key={file.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-band/50">
                    {file.iconLink ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Google's own 16px file-type icon
                      <img src={file.iconLink} alt="" className="size-4 shrink-0" />
                    ) : (
                      <FileText size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{file.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {file.owner ? `${file.owner} · ` : ''}edited <RelativeTime iso={file.modifiedTime} />
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant={doc ? 'default' : 'outline'}
                      className="shrink-0 gap-1.5"
                      disabled={bringIn.isPending}
                      onClick={() => bringIn.mutate(file)}
                    >
                      {doc ? <FileText aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                      {doc ? 'Bring in' : 'Link'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
