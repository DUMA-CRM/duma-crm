'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createElement, useMemo, useState } from 'react';

import {
  AlignLeft,
  Building2,
  ClipboardCheck,
  type IconComponent,
  KeyRound,
  Megaphone,
  Plus,
  ShieldCheck,
  Store,
  Trash2,
  Type,
  UserRound,
  UsersRound,
} from '@/components/icons';
import { moduleCopy } from '@/components/onboarding/modules';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ChangeRow, SaveBar, ValueAside, ValueMissing } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { IconTag } from '@/components/shared/IconTag';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type AccessRole, createRole, deleteRole, getRoles, updateRole } from '@/lib/modules/identity/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { capabilityName } from '@/lib/utils/module-impact';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Draft = { id: string | null; name: string; description: string; capabilities: string[] };
/** The row open in the role card or the permissions list: a field, or a module's id. */
type Row = 'name' | 'description' | `module:${string}`;

const emptyDraft = (): Draft => ({ id: null, name: '', description: '', capabilities: [] });
const sorted = (values: readonly string[]) => [...values].sort();
const permissions = (count: number) => `${count} ${count === 1 ? 'permission' : 'permissions'}`;

function draftFor(role: AccessRole): Draft {
  return { id: role.id, name: role.name, description: role.description ?? '', capabilities: role.capabilities };
}

function roleIcon(role?: AccessRole): IconComponent {
  const identity = `${role?.key ?? ''} ${role?.name ?? ''}`.toLowerCase();
  if (identity.includes('super')) return ShieldCheck;
  if (identity.includes('franchise') || identity.includes('owner')) return Building2;
  if (identity.includes('hr')) return UsersRound;
  if (identity.includes('marketing')) return Megaphone;
  if (identity.includes('store')) return Store;
  if (identity.includes('auditor')) return ClipboardCheck;
  if (identity.includes('team') || identity.includes('member')) return UserRound;
  return KeyRound;
}

/**
 * Settings → Roles, in the Settings → Account layout. Two stacked columns: the
 * roles as a `RecordGroup` with the chosen role's card under it | its
 * permissions, one `ChangeRow` per module whose value is what the role holds
 * there. One draft, saved through the `SaveBar`; Cancel on a row puts that
 * row's part of the draft back.
 */
export function RoleManager() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const rolesKey = moduleQueryKeys.identity.key('roles', tenantId);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: rolesKey,
    queryFn: () => getRoles(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // One row open at a time; a new role opens on its name.
  const [open, setOpen] = useState<Row | null>('name');
  const [before, setBefore] = useState<Draft | null>(null);

  const editable = useMemo(() => new Set(data?.grantableCapabilities ?? []), [data]);
  const selectedRole = draft.id ? data?.roles.find((role) => role.id === draft.id) : undefined;
  const isBuiltIn = Boolean(selectedRole?.isBuiltIn);
  const displayName = isBuiltIn ? (selectedRole?.name ?? 'Role') : draft.name.trim() || selectedRole?.name || 'New role';
  const isDirty = selectedRole
    ? draft.name.trim() !== selectedRole.name ||
      draft.description.trim() !== (selectedRole.description ?? '') ||
      sorted(draft.capabilities).join('|') !== sorted(selectedRole.capabilities).join('|')
    : Boolean(draft.name.trim() || draft.description.trim() || draft.capabilities.length);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        capabilities: draft.capabilities,
      };
      return draft.id ? updateRole(draft.id, payload, tenantId ?? undefined) : createRole({ ...payload, tenantId: tenantId ?? undefined });
    },
    onSuccess: async (role) => {
      await queryClient.invalidateQueries({ queryKey: rolesKey });
      setDraft(draftFor(role));
      setConfirmDelete(false);
      setOpen(null);
      toast('success', draft.id ? 'Role updated. Assigned staff will sign in again.' : 'Role created.');
    },
    onError: (error) => toast('error', (error as Error).message || 'The role could not be saved.'),
  });

  const remove = useMutation({
    mutationFn: (role: AccessRole) => deleteRole(role.id, tenantId ?? undefined),
    onSuccess: async () => {
      setDraft(emptyDraft());
      setConfirmDelete(false);
      setOpen('name');
      await queryClient.invalidateQueries({ queryKey: rolesKey });
      toast('success', 'Role deleted.');
    },
    onError: (error) => toast('error', (error as Error).message || 'Reassign everyone using this role first.'),
  });

  const selectRole = (role: AccessRole) => {
    const deselecting = draft.id === role.id;
    setDraft(deselecting ? emptyDraft() : draftFor(role));
    setOpen(deselecting ? 'name' : null);
    setConfirmDelete(false);
  };

  const startNewRole = () => {
    setDraft(emptyDraft());
    setOpen('name');
    setConfirmDelete(false);
  };

  const toggleCapability = (capability: string) =>
    setDraft((current) => ({
      ...current,
      capabilities: current.capabilities.includes(capability)
        ? current.capabilities.filter((entry) => entry !== capability)
        : [...current.capabilities, capability].sort(),
    }));

  const groups = Object.entries(data?.capabilityGroups ?? {})
    .map(([moduleId, capabilities]) => {
      const visible = capabilities.filter((capability) => editable.has(capability) || draft.capabilities.includes(capability));
      return { moduleId, visible, granted: visible.filter((capability) => draft.capabilities.includes(capability)) };
    })
    .filter((group) => group.visible.length > 0);

  /** Cancel puts back only that row's part of the draft, as it was when the row opened. */
  const restore = (row: Row, from: Draft) => {
    if (row === 'name' || row === 'description') {
      setDraft((current) => ({ ...current, [row]: from[row] }));
      return;
    }
    const inModule = new Set(data?.capabilityGroups[row.slice('module:'.length)] ?? []);
    setDraft((current) => ({
      ...current,
      capabilities: [
        ...current.capabilities.filter((capability) => !inModule.has(capability)),
        ...from.capabilities.filter((capability) => inModule.has(capability)),
      ].sort(),
    }));
  };
  const toggle = (row: Row) => {
    if (open === row) {
      if (before && !isBuiltIn) restore(row, before);
      setOpen(null);
      return;
    }
    setBefore(draft);
    setOpen(row);
  };

  const textRow = (row: 'name' | 'description', icon: IconComponent, label: string, empty: string, placeholder: string) =>
    isBuiltIn ? (
      <ChangeRow icon={icon} label={label} value={draft[row].trim() || <ValueMissing>{empty}</ValueMissing>} />
    ) : (
      <ChangeRow
        icon={icon}
        label={label}
        value={draft[row].trim() ? <span className="truncate">{draft[row].trim()}</span> : <ValueMissing>{empty}</ValueMissing>}
        open={open === row}
        onToggle={() => toggle(row)}
      >
        <Input
          aria-label={label}
          value={draft[row]}
          onChange={(event) => setDraft((current) => ({ ...current, [row]: event.target.value }))}
          placeholder={placeholder}
          autoFocus
        />
      </ChangeRow>
    );

  return (
    <SettingsTabBody>
      {/* Two stacked columns, not paired rows: the list and the role's card | its permissions. */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <RecordGroup
            id="roles"
            title="Roles"
            actions={
              <Button size="sm" variant="outline" onClick={startNewRole} aria-pressed={draft.id === null}>
                <Plus data-icon="inline-start" /> New role
              </Button>
            }
          >
            {isPending ? (
              <ListSkeleton rows={5} label="Loading roles" />
            ) : isError ? (
              <div className="rounded-lg border border-border bg-card shadow-sm">
                <ErrorState title="Roles could not load" onRetry={() => void refetch()} />
              </div>
            ) : (data?.roles ?? []).length === 0 ? (
              <div className="rounded-lg border border-border bg-card shadow-sm">
                <EmptyState compact icon={KeyRound} title="No roles yet" />
              </div>
            ) : (
              <ListRowGroup aria-label="Workspace roles">
                {(data?.roles ?? []).map((role) => {
                  const selected = role.id === draft.id;
                  return (
                    <ListRow
                      key={role.id}
                      icon={roleIcon(role)}
                      title={role.name}
                      meta={permissions(role.capabilities.length)}
                      trailing={
                        <IconTag
                          icon={role.isBuiltIn ? ShieldCheck : KeyRound}
                          label={role.isBuiltIn ? 'Built in' : 'Custom'}
                          tone={role.isBuiltIn ? 'primary' : 'muted'}
                        />
                      }
                      onClick={() => selectRole(role)}
                      selected={selected}
                      pressed={selected}
                    />
                  );
                })}
              </ListRowGroup>
            )}
          </RecordGroup>

          <SettingsSection>
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                {createElement(roleIcon(selectedRole), { size: 24, 'aria-hidden': true })}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl font-semibold tracking-headline text-heading">{displayName}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {selectedRole && (
                    <IconTag
                      icon={isBuiltIn ? ShieldCheck : KeyRound}
                      label={isBuiltIn ? 'Built in' : 'Custom'}
                      tone={isBuiltIn ? 'primary' : 'muted'}
                    />
                  )}
                  <span>{permissions(draft.capabilities.length)}</span>
                </p>
              </div>
              {selectedRole && !isBuiltIn && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 self-start text-muted-foreground hover:bg-exception/6 hover:text-exception"
                  onClick={() => setConfirmDelete(true)}
                  disabled={remove.isPending}
                >
                  <Trash2 data-icon="inline-start" /> Delete
                </Button>
              )}
            </div>
            <div className="mt-6">
              {!isBuiltIn && textRow('name', Type, 'Name', 'Not set', 'Shift lead')}
              {textRow('description', AlignLeft, 'Description', 'None', 'What this role is responsible for')}
            </div>
          </SettingsSection>
        </div>

        <SettingsSection
          title="Permissions"
          footnote={
            isBuiltIn
              ? 'Built-in roles can’t be changed — make a new role for a different set.'
              : selectedRole
                ? 'Staff with this role sign in again after a save.'
                : undefined
          }
        >
          {isPending ? (
            <div role="status" aria-label="Loading permissions" className="space-y-5">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Bone className="size-10 shrink-0" />
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <Bone className="h-2.5 w-20" />
                    <Bone className="h-3.5 w-44 max-w-full" />
                  </span>
                  <Bone className="h-8 w-20 shrink-0" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <ErrorState title="Permissions could not load" onRetry={() => void refetch()} className="py-6" />
          ) : groups.length === 0 ? (
            <EmptyState compact icon={KeyRound} title="No permissions to grant" />
          ) : (
            <div>
              {groups.map(({ moduleId, visible, granted }) => {
                const copy = moduleCopy(moduleId);
                const row: Row = `module:${moduleId}`;
                return (
                  <ChangeRow
                    key={`${draft.id ?? 'new'}-${moduleId}`}
                    icon={copy.icon}
                    label={copy.name}
                    value={
                      granted.length === 0 ? (
                        <ValueMissing>None</ValueMissing>
                      ) : granted.length === visible.length ? (
                        <>
                          <span className="shrink-0">All {visible.length}</span>
                          <ValueAside>· {granted.map(capabilityName).join(', ')}</ValueAside>
                        </>
                      ) : (
                        <>
                          <span className="shrink-0">
                            {granted.length} of {visible.length}
                          </span>
                          <ValueAside>· {granted.map(capabilityName).join(', ')}</ValueAside>
                        </>
                      )
                    }
                    open={open === row}
                    onToggle={() => toggle(row)}
                    verbs={isBuiltIn ? ['Show', 'Hide'] : undefined}
                  >
                    <ul className="grid gap-x-4 sm:grid-cols-2" aria-label={`${copy.name} permissions`}>
                      {visible.map((capability) => {
                        const checked = draft.capabilities.includes(capability);
                        const disabled = isBuiltIn || !editable.has(capability);
                        return (
                          <li key={capability}>
                            <label
                              className={cn(
                                'flex min-h-9 items-center gap-2.5 py-1.5 text-sm',
                                checked ? 'text-foreground' : 'text-muted-foreground',
                                disabled ? 'cursor-default' : 'cursor-pointer hover:text-foreground',
                              )}
                            >
                              <input
                                type="checkbox"
                                className="size-4 shrink-0 accent-primary"
                                checked={checked}
                                disabled={disabled}
                                onChange={() => toggleCapability(capability)}
                              />
                              <span className="leading-5">{capabilityName(capability)}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </ChangeRow>
                );
              })}
            </div>
          )}
        </SettingsSection>
      </div>

      {!isBuiltIn && (
        <SaveBar
          dirty={isDirty}
          saving={save.isPending}
          disabled={draft.name.trim().length < 2}
          message={draft.name.trim().length < 2 ? 'Name the role to save it' : undefined}
          saveLabel={draft.id ? 'Save changes' : 'Create role'}
          onSave={() => save.mutate()}
          onDiscard={() => {
            setDraft(selectedRole ? draftFor(selectedRole) : emptyDraft());
            setOpen(selectedRole ? null : 'name');
          }}
        />
      )}

      {confirmDelete && selectedRole && (
        <ConfirmModal
          title={`Delete ${selectedRole.name}?`}
          message="Reassign everyone using this role first. This can’t be undone."
          confirmLabel="Delete role"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(selectedRole)}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </SettingsTabBody>
  );
}
