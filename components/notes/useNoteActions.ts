'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { type Note, deleteNote, purgeNote, restoreNote, saveNote } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/stores/toastStore';

/**
 * What the sidebar can do to a note without opening it — the right-click menu
 * and drag and drop. Pin and move patch an open note's cached copy rather than
 * refetching it, so an editor mid-sentence isn't reloaded under the cursor.
 */
export function useNoteActions() {
  const queryClient = useQueryClient();
  const noteKey = (id: string) => moduleQueryKeys.notes.key('note', id);
  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('list') });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('folders') });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('tags') });
  };
  const fail = (error: Error) => toast('error', error.message);

  const move = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null; name: string }) => saveNote(id, { folderId }),
    onSuccess: (saved, { id, name }) => {
      queryClient.setQueryData(noteKey(id), (current: Note | undefined) => (current ? { ...current, folderId: saved.folderId } : current));
      refreshLists();
      toast('success', `Moved to ${name}.`);
    },
    onError: fail,
  });
  const pin = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => saveNote(id, { pinned }),
    onSuccess: (saved, { id }) => {
      queryClient.setQueryData(noteKey(id), (current: Note | undefined) => (current ? { ...current, pinned: saved.pinned } : current));
      refreshLists();
    },
    onError: fail,
  });
  const trash = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: async (_, id) => {
      refreshLists();
      // An open note becomes its Recently Deleted view.
      await queryClient.invalidateQueries({ queryKey: noteKey(id) });
      toast('success', 'Moved to Recently Deleted — it’s kept for 30 days.');
    },
    onError: fail,
  });
  const restore = useMutation({
    mutationFn: (id: string) => restoreNote(id),
    onSuccess: async (_, id) => {
      refreshLists();
      await queryClient.invalidateQueries({ queryKey: noteKey(id) });
      toast('success', 'Note restored.');
    },
    onError: fail,
  });
  const purge = useMutation({
    mutationFn: (id: string) => purgeNote(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: noteKey(id) });
      refreshLists();
      toast('success', 'Deleted for good.');
    },
    onError: fail,
  });

  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/notes?note=${id}`);
      toast('success', 'Link copied — anyone who can read the note can open it.');
    } catch {
      toast('error', 'The link couldn’t be copied.');
    }
  };

  return { move, pin, trash, restore, purge, copyLink };
}
