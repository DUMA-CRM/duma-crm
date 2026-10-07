'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  Building2,
  ChevronDown,
  ClipboardCheck,
  KeyRound,
  Megaphone,
  Plus,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
  UsersRound,
} from '@/components/icons';
import { moduleCopy } from '@/components/onboarding/modules';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { IconTag } from '@/components/shared/IconTag';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { ActionButton, useDoneBeat } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type AccessRole, createRole, deleteRole, getRoles, updateRole } from '@/lib/modules/identity/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { capabilityName } from '@/lib/utils/module-impact';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Draft = { id: string | null; name: string; description: string; capabilities: string[] };

const emptyDraft = (): Draft => ({ id: null, name: '', description: '', capabilities: [] });
const sorted = (values: readonly string[]) => [...values].sort();

function draftFor(role: AccessRole): Draft {
  return { id: role.id, name: role.name, description: role.description ?? '', capabilities: role.capabilities };
}

function RoleGlyph({ role, className }: { role?: AccessRole; className?: string }) {
  const identity = `${role?.key ?? ''} ${role?.name ?? ''}`.toLowerCase();
  if (identity.includes('super')) return <ShieldCheck className={className} />;
  if (identity.includes('franchise') || identity.includes('owner')) return <Building2 className={className} />;
  if (identity.includes('hr')) return <UsersRound className={className} />;
  if (identity.includes('marketing')) return <Megaphone className={className} />;
  if (identity.includes('store')) return <Store className={className} />;
  if (identity.includes('auditor')) return <ClipboardCheck className={className} />;
  if (identity.includes('team') || identity.includes('member')) return <UserRound className={className} />;
  return <KeyRound className={className} />;
}

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

  const editable = useMemo(() => new Set(data?.grantableCapabilities ?? []), [data]);
  const selectedRole = draft.id ? data?.roles.find((role) => role.id === draft.id) : undefined;
  const isBuiltIn = Boolean(selectedRole?.isBuiltIn);
  const displayName = isBuiltIn ? (selectedRole?.name ?? 'Role') : draft.name.trim() || selectedRole?.name || 'New role';
  const isDirty = selectedRole
    ? draft.name.trim() !== selectedRole.name ||
      draft.description.trim() !== (selectedRole.description ?? '') ||
      sorted(draft.capabilities).join('|') !== sorted(selectedRole.capabilities).join('|')
    : Boolean(draft.name.trim() || draft.description.trim() || draft.capabilities.length);

  const [justSaved, flashSaved] = useDoneBeat();
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
      toast('success', draft.id ? 'Role updated. Assigned staff will sign in again.' : 'Role created.');
    },
    onError: (error) => toast('error', (error as Error).message || 'The role could not be saved.'),
  });

  const remove = useMutation({
    mutationFn: (role: AccessRole) => deleteRole(role.id, tenantId ?? undefined),
    onSuccess: async () => {
      setDraft(emptyDraft());
      setConfirmDelete(false);
      await queryClient.invalidateQueries({ queryKey: rolesKey });
      toast('success', 'Role deleted.');
    },
    onError: (error) => toast('error', (error as Error).message || 'Reassign everyone using this role first.'),
  });

  const selectRole = (role: AccessRole) => {
    setDraft((current) => (current.id === role.id ? emptyDraft() : draftFor(role)));
    setConfirmDelete(false);
  };

  const startNewRole = () => {
    setDraft(emptyDraft());
    setConfirmDelete(false);
  };

  const toggleCapability = (capability: string) =>
    setDraft((current) => ({
      ...current,
      capabilities: current.capabilities.includes(capability)
        ? current.capabilities.filter((entry) => entry !== capability)
        : [...current.capabilities, capability].sort(),
    }));

  const roleDirectory = (
    <SettingsSection
      actions={
        <Button size="sm" variant="outline" onClick={startNewRole} aria-pressed={draft.id === null}>
          <Plus data-icon="inline-start" /> New role
        </Button>
      }
      bodyClassName="pt-3"
    >
      {isPending && <TilesSkeleton count={5} label="Loading roles" className="space-y-1.5" tileClassName="rounded-md bg-page p-3" />}

      {isError && (
        <ErrorState
          title="Roles could not load"
          description="Try loading this list again."
          onRetry={() => void refetch()}
          className="py-6"
        />
      )}

      {!isPending && !isError && (
        <nav className="space-y-1.5" aria-label="Workspace roles">
          {(data?.roles ?? []).map((role) => {
            const selected = role.id === draft.id;
            return (
              <button
                key={role.id}
                type="button"
                aria-pressed={selected}
                onClick={() => selectRole(role)}
                className={cn(
                  'w-full rounded-md border p-3 text-left transition-[background-color,border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  selected
                    ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]'
                    : 'border-rule/50 bg-page hover:border-primary/35 hover:bg-band/50',
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-md border',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-rule/60 bg-field text-muted-foreground',
                    )}
                  >
                    <RoleGlyph role={role} className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{role.name}</span>
                      <IconTag
                        icon={role.isBuiltIn ? ShieldCheck : KeyRound}
                        label={role.isBuiltIn ? 'Built in' : 'Custom'}
                        tone={role.isBuiltIn ? 'primary' : 'muted'}
                      />
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <KeyRound className="size-3" />
                      {role.capabilities.length} {role.capabilities.length === 1 ? 'permission' : 'permissions'}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </SettingsSection>
  );

  return (
    <SettingsTabBody aside={roleDirectory} stickyAside narrowAside>
      <SettingsSection>
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <span
              className={cn(
                'flex size-20 shrink-0 items-center justify-center rounded-xl border shadow-sm',
                selectedRole ? 'border-primary/25 bg-primary text-primary-foreground' : 'border-rule/60 bg-band text-primary',
              )}
            >
              <RoleGlyph role={selectedRole} className="size-8" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h2 className="truncate text-2xl font-semibold tracking-headline text-foreground">{displayName}</h2>
                {isBuiltIn ? (
                  <Badge variant="primary">
                    <ShieldCheck /> Built in
                  </Badge>
                ) : selectedRole ? (
                  <Badge variant="muted">
                    <KeyRound /> Custom
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:justify-start">
                <KeyRound className="size-3.5" />
                {draft.capabilities.length} {draft.capabilities.length === 1 ? 'permission' : 'permissions'} selected
              </p>
            </div>
          </div>

          <div className="border-t border-rule/50" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Role name"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Shift lead"
              disabled={isBuiltIn}
            />
            <Input
              label="Description"
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="What this role is responsible for"
              disabled={isBuiltIn}
            />
          </div>

          <div>
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground">Permissions</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Open a section to choose the actions this role can perform.
              </p>
            </div>

            <div className="grid gap-2 xl:grid-cols-2">
              {Object.entries(data?.capabilityGroups ?? {}).map(([moduleId, capabilities]) => {
                const visible = capabilities.filter((capability) => editable.has(capability) || draft.capabilities.includes(capability));
                if (visible.length === 0) return null;
                const selectedCount = visible.filter((capability) => draft.capabilities.includes(capability)).length;
                const copy = moduleCopy(moduleId);
                const ModuleIcon = copy.icon;
                return (
                  <details
                    key={`${draft.id ?? 'new'}-${moduleId}`}
                    className="group rounded-md border border-rule/60 bg-page open:border-rule"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/60 bg-field text-muted-foreground">
                        <ModuleIcon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{copy.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {selectedCount} of {visible.length} selected
                        </span>
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="grid gap-2 border-t border-rule/50 px-3 py-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {visible.map((capability) => {
                        const checked = draft.capabilities.includes(capability);
                        const disabled = isBuiltIn || !editable.has(capability);
                        return (
                          <label
                            key={capability}
                            className={cn(
                              'flex min-h-10 items-start gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors',
                              checked ? 'border-primary/35 bg-primary/5 text-foreground' : 'border-rule/50 bg-field text-muted-foreground',
                              disabled ? 'cursor-default opacity-70' : 'cursor-pointer hover:border-primary/35 hover:text-foreground',
                            )}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 shrink-0 accent-primary"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleCapability(capability)}
                            />
                            <span className="leading-5">{capabilityName(capability)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>

          {!isBuiltIn && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule/50 pt-4">
              <div>
                {selectedRole && !confirmDelete && (
                  <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} disabled={remove.isPending}>
                    <Trash2 data-icon="inline-start" /> Delete role
                  </Button>
                )}
                {selectedRole && confirmDelete && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-exception">Delete this role?</span>
                    <Button variant="destructive" size="sm" onClick={() => remove.mutate(selectedRole)} disabled={remove.isPending}>
                      {remove.isPending ? 'Deleting…' : 'Yes, delete'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={remove.isPending}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <ActionButton
                className="min-w-32"
                onClick={() => save.mutate(undefined, { onSuccess: flashSaved })}
                disabled={draft.name.trim().length < 2 || (Boolean(selectedRole) && !isDirty)}
                pending={save.isPending}
                done={justSaved}
                doneLabel={draft.id ? 'Saved' : 'Role created'}
              >
                {draft.id ? 'Save changes' : 'Create role'}
              </ActionButton>
            </div>
          )}
        </div>
      </SettingsSection>
    </SettingsTabBody>
  );
}
