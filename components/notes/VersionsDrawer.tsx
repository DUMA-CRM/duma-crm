'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { RichTextPreview } from '@/components/cms/RichTextPreview';
import { History } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { getNoteVersions, restoreNoteVersion } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';

/** A note's earlier copies: pick one to read, restore it as the newest. The current copy stays in history. */
export function VersionsDrawer({
  noteId,
  canRestore,
  onClose,
  onRestored,
}: {
  noteId: string;
  canRestore: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const query = useQuery({ queryKey: moduleQueryKeys.notes.key('versions', noteId), queryFn: () => getNoteVersions(noteId) });
  const [picked, setPicked] = useState<string | null>(null);
  const restore = useMutation({
    mutationFn: (versionId: string) => restoreNoteVersion(noteId, versionId),
    onSuccess: () => {
      toast('success', 'That copy is back. The one it replaced is in History.');
      onRestored();
    },
    onError: (error) => toast('error', error.message),
  });
  const versions = query.data ?? [];
  const shown = versions.find((version) => version.id === picked) ?? versions[0];

  return (
    <Drawer title="History" description="Earlier copies, kept as you write." onClose={onClose} className="sm:max-w-3xl">
      {query.isPending ? (
        <LoadingState label="Loading history" />
      ) : query.isError ? (
        <ErrorState title="History couldn’t be loaded" onRetry={() => void query.refetch()} />
      ) : versions.length === 0 ? (
        <EmptyState
          icon={History}
          title="No earlier copies yet"
          description="One is kept each time the note changes, at most every ten minutes."
          compact
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
          <ul className="space-y-1">
            {versions.map((version) => (
              <li key={version.id}>
                <button
                  type="button"
                  onClick={() => setPicked(version.id)}
                  className={cn(
                    'w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    shown?.id === version.id ? 'bg-primary/8 text-foreground' : 'text-muted-foreground hover:bg-band/60',
                  )}
                >
                  <span className="block font-medium text-foreground">
                    <RelativeTime iso={version.createdAt} />
                  </span>
                  <span className="block truncate text-xs">{version.title || 'Untitled'}</span>
                </button>
              </li>
            ))}
          </ul>
          {shown && (
            <div className="min-w-0 space-y-3">
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-rule/60 bg-field px-5 py-4 text-sm">
                <RichTextPreview markdown={shown.markdown || '_Empty_'} />
              </div>
              {canRestore && (
                <Button disabled={restore.isPending} onClick={() => restore.mutate(shown.id)}>
                  {restore.isPending ? 'Restoring…' : 'Restore this copy'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
