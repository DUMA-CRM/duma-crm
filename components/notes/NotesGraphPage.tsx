'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Popover } from 'radix-ui';
import { useDeferredValue, useMemo, useState } from 'react';

import { GraphView, Search, SlidersHorizontal } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { getNoteFolders, getNoteGraph } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { noteHref } from '@/lib/utils/note-links';
import { folderTree } from '@/lib/utils/notes';
import { buildNoteGraph, folderAndBelow } from '@/lib/utils/notes-graph';

import { NotesGraph } from './NotesGraph';

/**
 * The graph view: every note you can read as an orb, joined by the links made
 * with [[ — bigger orbs have more links, hollow ones have none. Filter by
 * folder, hide unlinked notes, light up a search. Opened
 * from a note (`?focus=`), it starts centred on that note.
 */
export function NotesGraphPage() {
  const router = useRouter();
  const params = useSearchParams();
  const focusId = params.get('focus');
  const [folder, setFolder] = useState('all');
  const [showOrphans, setShowOrphans] = useState(true);
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim().toLowerCase());

  const graph = useQuery({ queryKey: moduleQueryKeys.notes.key('graph'), queryFn: getNoteGraph });
  const folders = useQuery({ queryKey: moduleQueryKeys.notes.key('folders'), queryFn: getNoteFolders });
  // Stable between renders: the graph's layout restarts whenever its model changes.
  const allFolders = useMemo(() => folders.data?.folders ?? [], [folders.data]);

  const model = useMemo(
    () =>
      graph.data
        ? buildNoteGraph(graph.data, {
            showOrphans,
            folderIds: folder === 'all' ? null : folderAndBelow(folder, allFolders),
          })
        : null,
    [graph.data, showOrphans, folder, allFolders],
  );
  const highlight = useMemo(
    () => (model && q ? new Set(model.nodes.filter((node) => node.label.toLowerCase().includes(q)).map((node) => node.id)) : null),
    [model, q],
  );

  const linkCount = model?.links.filter((link) => link.kind === 'link').length ?? 0;

  const controls = (
    <>
      <div className="w-full shrink-0 xl:w-40">
        <Input
          aria-label="Light up notes by title"
          placeholder="Find a note"
          value={search}
          leftIcon={<Search size={14} aria-hidden="true" />}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full"
        />
      </div>
      <Select
        value={folder}
        onValueChange={setFolder}
        ariaLabel="Folder"
        className="w-full shrink-0 xl:w-40"
        options={[
          { value: 'all', label: 'All folders' },
          ...folderTree(allFolders).map(({ folder: entry, depth }) => ({ value: entry.id, label: `${'  '.repeat(depth)}${entry.name}` })),
        ]}
      />
      <Toggle on={showOrphans} onChange={setShowOrphans} label="Unlinked notes" />
    </>
  );

  return (
    <EditorShell
      title="Graph"
      icon={<GraphView size={20} aria-hidden="true" />}
      onClose={() => router.push(focusId ? noteHref(focusId) : '/notes')}
      meta={
        model && (
          <span className="hidden whitespace-nowrap text-xs tabular-nums text-muted-foreground 2xl:inline">
            {model.nodes.length} notes · {linkCount} {linkCount === 1 ? 'link' : 'links'}
          </span>
        )
      }
      flush
      actions={
        <>
          <div className="hidden items-center gap-2 xl:flex">{controls}</div>
          <Popover.Root>
            <Popover.Trigger asChild>
              <Button variant="outline" size="icon" aria-label="Graph filters" className="xl:hidden">
                <SlidersHorizontal size={16} aria-hidden="true" />
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                onEscapeKeyDown={(event) => event.stopPropagation()}
                align="end"
                sideOffset={8}
                collisionPadding={12}
                className="z-90 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col gap-3 rounded-lg border border-rule/60 bg-card p-3 shadow-lg"
              >
                {controls}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </>
      }
    >
      <div className="relative min-h-0 flex-1 bg-background">
        {graph.isPending ? (
          <LoadingState label="Drawing the graph" />
        ) : graph.isError ? (
          <ErrorState title="The graph couldn’t be loaded" onRetry={() => void graph.refetch()} />
        ) : model!.nodes.length === 0 ? (
          <EmptyState
            className="h-full"
            icon={GraphView}
            title={graph.data.nodes.length === 0 ? 'No notes yet' : 'Nothing here with these filters'}
            description={
              graph.data.nodes.length === 0
                ? 'Write a few notes and link them with [[ — they’ll show up here, joined.'
                : 'Try another folder, or show unlinked notes.'
            }
          />
        ) : (
          <>
            <NotesGraph
              model={model!}
              focusId={focusId}
              highlight={highlight}
              onOpen={(node) => {
                if (node.kind === 'note') router.push(noteHref(node.id));
              }}
            />
            {graph.data.links.length === 0 && (
              <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-md border border-rule/60 bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                No links yet — type <kbd className="font-semibold text-foreground">[[</kbd> in a note to link another.
              </p>
            )}
            {graph.data.truncated && (
              <p className="pointer-events-none absolute bottom-9 left-3 rounded-md border border-rule/60 bg-card/95 px-3 py-1.5 text-xs text-muted-foreground">
                Showing the 1,000 most recently edited notes.
              </p>
            )}
            <p className="pointer-events-none absolute bottom-3 left-3 hidden text-micro text-muted-foreground md:block">
              Scroll to zoom · drag to move · click an orb to open it
            </p>
          </>
        )}
      </div>
    </EditorShell>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        'h-9 shrink-0 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring',
        on ? 'border-primary bg-primary/8 text-foreground' : 'border-rule/60 bg-background text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
