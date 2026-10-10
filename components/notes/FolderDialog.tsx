'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Lock, Users } from '@/components/icons';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';

import { getRoles } from '@/lib/api/roles.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { type NoteFolder, createNoteFolder, renameNoteFolder, shareNoteFolder } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** The built-in roles, for when the workspace's own role list isn't readable to this person. */
const BUILT_IN_ROLES = [
  { value: 'franchise_owner', label: 'Owner' },
  { value: 'store_manager', label: 'Store manager' },
  { value: 'barista', label: 'Barista' },
  { value: 'hr_manager', label: 'HR manager' },
  { value: 'marketing_manager', label: 'Marketing manager' },
  { value: 'auditor', label: 'Auditor' },
];

export type FolderDialogMode =
  | { kind: 'create'; parent: NoteFolder | null }
  | { kind: 'rename'; folder: NoteFolder }
  | { kind: 'share'; folder: NoteFolder };

/**
 * New folder, rename, or who a shared folder is for. A shared top-level folder
 * says who reads (roles, locations) and who edits; its subfolders follow it.
 * Only someone who manages notes sees the sharing choices.
 */
export function FolderDialog({
  mode,
  canManage,
  onClose,
  onDone,
}: {
  mode: FolderDialogMode;
  canManage: boolean;
  onClose: () => void;
  onDone: (folder: NoteFolder) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const existing = mode.kind === 'create' ? null : mode.folder;
  const topLevel = mode.kind === 'create' ? mode.parent === null : existing?.parentId === null;
  const [name, setName] = useState(existing?.name ?? '');
  const [shared, setShared] = useState(mode.kind === 'create' ? (mode.parent?.shared ?? false) : (existing?.shared ?? false));
  const [readerRoles, setReaderRoles] = useState<string[]>(existing?.readerRoles ?? []);
  const [readerLocationIds, setReaderLocationIds] = useState<string[]>(existing?.readerLocationIds ?? []);
  const [editorRoles, setEditorRoles] = useState<string[]>(existing?.editorRoles ?? ['franchise_owner', 'store_manager']);
  const showSharing = canManage && topLevel && (mode.kind === 'share' || (mode.kind === 'create' && shared));

  const roles = useQuery({
    queryKey: moduleQueryKeys.identity.key('roles', tenantId),
    queryFn: () => getRoles(tenantId),
    retry: false,
    enabled: showSharing,
  });
  const locations = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: showSharing && Boolean(tenantId),
  });
  const roleOptions = roles.data?.roles.length ? roles.data.roles.map((role) => ({ value: role.key, label: role.name })) : BUILT_IN_ROLES;
  const locationOptions = (locations.data ?? []).map((location) => ({ value: location.id, label: location.name }));

  const save = useMutation({
    mutationFn: async () => {
      if (mode.kind === 'rename') return renameNoteFolder(mode.folder.id, name.trim());
      if (mode.kind === 'share') return shareNoteFolder(mode.folder.id, { readerRoles, readerLocationIds, editorRoles });
      return createNoteFolder({
        name: name.trim(),
        parentId: mode.parent?.id ?? null,
        shared: topLevel && shared,
        ...(topLevel && shared ? { readerRoles, readerLocationIds, editorRoles } : {}),
      });
    },
    onSuccess: async (folder) => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.notes.key('folders') });
      toast(
        'success',
        mode.kind === 'create' ? `Folder “${folder.name}” created.` : mode.kind === 'share' ? 'Sharing saved.' : 'Folder renamed.',
      );
      onDone(folder);
    },
    onError: (error) => toast('error', error.message),
  });

  const title =
    mode.kind === 'create'
      ? mode.parent
        ? `New folder in ${mode.parent.name}`
        : 'New folder'
      : mode.kind === 'rename'
        ? 'Rename folder'
        : `Who sees “${existing!.name}”`;
  const ready = mode.kind === 'share' || name.trim().length > 0;

  return (
    <Modal
      title={title}
      onClose={onClose}
      className="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!ready || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : mode.kind === 'create' ? 'Create folder' : 'Save'}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) save.mutate();
        }}
      >
        {mode.kind !== 'share' && (
          <Input
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            maxLength={120}
            placeholder="Recipes"
          />
        )}

        {mode.kind === 'create' && topLevel && canManage && (
          <ChoiceCards
            columns={2}
            value={shared ? 'shared' : 'private'}
            onChange={(next) => setShared(next === 'shared')}
            options={[
              { value: 'private', label: 'Just me', icon: Lock },
              { value: 'shared', label: 'Shared with the team', icon: Users },
            ]}
          />
        )}
        {mode.kind === 'create' && !topLevel && (
          <p className="text-xs text-muted-foreground">
            {mode.parent?.shared ? 'Shared like the folder it’s in.' : 'Private, like the folder it’s in.'}
          </p>
        )}

        {showSharing && (
          <div className="space-y-3 rounded-lg border border-rule/60 bg-field p-4">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">Who can read it</p>
              <MultiSelect
                value={readerRoles}
                onChange={setReaderRoles}
                options={roleOptions}
                placeholder="Every role"
                ariaLabel="Roles that can read"
              />
              <MultiSelect
                value={readerLocationIds}
                onChange={setReaderLocationIds}
                options={locationOptions}
                placeholder="Every location"
                ariaLabel="Locations that can read"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">Who can edit it</p>
              <MultiSelect
                value={editorRoles}
                onChange={setEditorRoles}
                options={roleOptions}
                placeholder="Everyone who can read it"
                ariaLabel="Roles that can edit"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Typical: everyone reads the SOPs, managers keep them up to date. Ask DUMA can answer from shared folders.
              </p>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
