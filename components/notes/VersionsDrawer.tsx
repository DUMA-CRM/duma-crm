'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { RichTextPreview } from '@/components/cms/RichTextPreview';
import { History, Loader2, RotateCcw } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { type NoteVersion, getNoteVersions, restoreNoteVersion } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { groupNotesByDate } from '@/lib/utils/notes';
import { formatInstant } from '@/lib/utils/workspace-time';

const time = (iso: string) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });
const day = (iso: string) => formatInstant(iso, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * A note's earlier copies: the list on the left, grouped by day, with when and
 * by whom; the copy you pick on the right, as a page. Restoring makes it the
 * newest — the copy it replaces goes into history, so nothing is lost.
 */
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
  const count = versions.length;

  return (
    <Drawer
      icon={History}
      title="History"
      description={
        count > 0
          ? `${count} earlier ${count === 1 ? 'copy' : 'copies'} — one kept at most every ten minutes as you write.`
          : 'Earlier copies, kept as you write.'
      }
      onClose={onClose}
      className="sm:max-w-4xl"
      // Two columns that scroll on their own, so a long note never pushes the list away.
      bodyClassName={count > 0 ? 'flex flex-col overflow-hidden p-0 md:flex-row' : undefined}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="default" className="flex-1" onClick={onClose}>
            Close
          </Button>
          {canRestore && shown && (
            <Button type="button" size="default" className="flex-1" disabled={restore.isPending} onClick={() => restore.mutate(shown.id)}>
              {restore.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
              {restore.isPending ? 'Restoring…' : 'Restore this copy'}
            </Button>
          )}
        </div>
      }
    >
      {query.isPending ? (
        <LoadingState label="Loading history" />
      ) : query.isError ? (
        <ErrorState title="History couldn’t be loaded" onRetry={() => void query.refetch()} />
      ) : count === 0 ? (
        <EmptyState
          icon={History}
          title="No earlier copies yet"
          description="One is kept each time the note changes, at most every ten minutes."
          compact
        />
      ) : (
        <>
          <VersionList versions={versions} shownId={shown?.id ?? null} onPick={setPicked} />
          {shown && (
            <article className="min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8" aria-label="The copy you picked">
              <p className="text-xs text-muted-foreground">
                Saved {day(shown.createdAt)}, {time(shown.createdAt)}
                {shown.createdByName && <> · by {shown.createdByName}</>} · <RelativeTime iso={shown.createdAt} />
              </p>
              <div className="mt-4 text-sm">
                <RichTextPreview markdown={shown.markdown || '_This copy was empty._'} />
              </div>
            </article>
          )}
        </>
      )}
    </Drawer>
  );
}

function VersionList({ versions, shownId, onPick }: { versions: NoteVersion[]; shownId: string | null; onPick: (id: string) => void }) {
  // Today, Yesterday, Previous 7 days … — the same days the notes list uses.
  const groups = groupNotesByDate(versions.map((version) => ({ ...version, pinned: false, updatedAt: version.createdAt })));
  return (
    <nav
      aria-label="Earlier copies"
      className="max-h-[30dvh] shrink-0 overflow-y-auto border-b border-divider bg-field md:max-h-none md:w-64 md:border-b-0 md:border-r"
    >
      {groups.map((group) => (
        <section key={group.group} aria-label={group.group}>
          <h3 className="sticky top-0 z-1 bg-field/95 px-4 pb-1 pt-3 text-label uppercase text-muted-foreground backdrop-blur">
            {group.group}
          </h3>
          <ul className="space-y-px px-2 pb-1">
            {group.notes.map((version) => {
              const current = version.id === shownId;
              return (
                <li key={version.id}>
                  <button
                    type="button"
                    onClick={() => onPick(version.id)}
                    aria-current={current ? 'true' : undefined}
                    className={cn(
                      'w-full rounded-md px-2.5 py-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring',
                      current ? 'bg-primary/10' : 'hover:bg-band/60',
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{version.title || 'Untitled'}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{time(version.createdAt)}</span>
                    </span>
                    {version.createdByName && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{version.createdByName}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
