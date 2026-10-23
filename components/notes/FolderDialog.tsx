'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Eye, FolderIcon, FolderLocked, FolderShared, type IconComponent, Info, Pencil } from '@/components/icons';
import { ChoiceCards, ModalActions } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { Tooltip } from '@/components/shared/Tooltip';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';

import { getRoles } from '@/lib/api/roles.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { type NoteFolder, createNoteFolder, renameNoteFolder, shareNoteFolder } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
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
  const [editorRoles, setEditorRoles] = useState<string[]>(existing?.editorRoles ?? []); // Empty: everyone who can read it (and can write notes).
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
      size="md"
      footer={
        <ModalActions
          form="note-folder-form"
          submitLabel={mode.kind === 'create' ? 'Create folder' : 'Save'}
          pendingLabel="Saving…"
          pending={save.isPending}
          disabled={!ready}
          onCancel={onClose}
        />
      }
    >
      <form
        id="note-folder-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) save.mutate();
        }}
      >
        {mode.kind !== 'share' && (
          <Section icon={FolderIcon} title="Name" info="What people look for it by — “Recipes”, “Opening”, “Training”.">
            <Input
              aria-label="Folder name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              maxLength={120}
              placeholder="Recipes"
            />
          </Section>
        )}

        {mode.kind === 'create' && topLevel && canManage && (
          <Section
            icon={shared ? FolderShared : FolderLocked}
            title="Who it’s for"
            info={shared ? 'The team sees it — you choose which roles and locations below.' : 'Only you see it and what’s in it.'}
          >
            <ChoiceCards
              columns={2}
              value={shared ? 'shared' : 'private'}
              onChange={(next) => setShared(next === 'shared')}
              options={[
                { value: 'private', label: 'Just me', icon: FolderLocked },
                { value: 'shared', label: 'The team', icon: FolderShared },
              ]}
            />
          </Section>
        )}

        {showSharing && (
          <>
            <Section icon={Eye} title="Who can read it" info="Leave a list empty for everyone.">
              {/* Roles and locations side by side; stacked on a phone. */}
              <div className="grid gap-2 sm:grid-cols-2">
                <MultiSelect
                  value={readerRoles}
                  onChange={setReaderRoles}
                  options={roleOptions}
                  placeholder="Every role"
                  ariaLabel="Roles that can read"
                  className="w-full"
                />
                <MultiSelect
                  value={readerLocationIds}
                  onChange={setReaderLocationIds}
                  options={locationOptions}
                  placeholder="Every location"
                  ariaLabel="Locations that can read"
                  className="w-full"
                />
              </div>
            </Section>
            <Section
              icon={Pencil}
              title="Who can edit it"
              info="Empty means everyone who can read it. Pick roles to narrow it — managers only, for SOPs."
            >
              <MultiSelect
                value={editorRoles}
                onChange={setEditorRoles}
                options={roleOptions}
                placeholder="Everyone who can read it"
                ariaLabel="Roles that can edit"
                className="w-full"
              />
            </Section>
          </>
        )}
      </form>
    </Modal>
  );
}

/** A part of the dialog: icon, title, and what it means behind an ⓘ — the fields sit straight below, with no panel. */
function Section({ icon: Icon, title, info, children }: { icon: IconComponent; title: string; info: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground">
          <Icon size={16} aria-hidden="true" />
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground">{title}</h3>
        <InfoTip label={info} />
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

/** The explanation, on hover or focus. Its label is the text, so a screen reader hears it too. */
function InfoTip({ label }: { label: string }) {
  return (
    <Tooltip side="bottom" align="end" wrap label={label}>
      <button
        type="button"
        aria-label={label}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Info size={15} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
