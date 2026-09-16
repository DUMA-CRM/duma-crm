'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createRole, deleteRole, getRoles, updateRole, type AccessRole } from '@/lib/api/roles.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Draft = { id: string | null; name: string; description: string; capabilities: string[] };
const emptyDraft = (): Draft => ({ id: null, name: '', description: '', capabilities: [] });

export function RoleManager() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: () => getRoles(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const editable = useMemo(() => new Set(data?.grantableCapabilities ?? []), [data]);
  const selectedRole = draft.id ? data?.roles.find((role) => role.id === draft.id) : undefined;

  const save = useMutation({
    mutationFn: () => draft.id
      ? updateRole(draft.id, { name: draft.name, description: draft.description || null, capabilities: draft.capabilities }, tenantId ?? undefined)
      : createRole({ name: draft.name, description: draft.description || null, capabilities: draft.capabilities, tenantId: tenantId ?? undefined }),
    onSuccess: async (role) => {
      await queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
      setDraft({ id: role.id, name: role.name, description: role.description ?? '', capabilities: role.capabilities });
      toast('success', draft.id ? 'Role updated. Assigned staff will sign in again.' : 'Role created.');
    },
    onError: (error) => toast('error', (error as Error).message || 'The role could not be saved.'),
  });

  const remove = useMutation({
    mutationFn: (role: AccessRole) => deleteRole(role.id, tenantId ?? undefined),
    onSuccess: async () => {
      setDraft(emptyDraft());
      await queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
      toast('success', 'Role deleted.');
    },
    onError: (error) => toast('error', (error as Error).message || 'Reassign everyone using this role first.'),
  });

  const selectRole = (role: AccessRole) => {
    setDraft({ id: role.id, name: role.name, description: role.description ?? '', capabilities: role.capabilities });
    setOpen(true);
  };
  const toggleCapability = (capability: string) => setDraft((current) => ({
    ...current,
    capabilities: current.capabilities.includes(capability)
      ? current.capabilities.filter((entry) => entry !== capability)
      : [...current.capabilities, capability].sort(),
  }));

  return (
    <section className="rounded-sm border border-rule bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">Roles & access</span>
          <span className="block text-xs text-muted-foreground">Built-in bundles plus roles shaped for this workspace.</span>
        </span>
        <span className="text-xs font-semibold text-primary">{open ? 'Close' : 'Manage'}</span>
      </button>

      {open && (
        <div className="grid border-t border-rule lg:grid-cols-[260px_1fr]">
          <div className="border-b border-rule p-3 lg:border-b-0 lg:border-r">
            <Button
              variant="outline"
              className="mb-3 w-full gap-1.5"
              onClick={() => setDraft(emptyDraft())}
            >
              <Plus size={14} /> New role
            </Button>
            {isPending && <p className="px-2 py-3 text-xs text-muted-foreground">Loading roles…</p>}
            {isError && (
              <button type="button" className="px-2 py-3 text-xs text-destructive" onClick={() => void refetch()}>
                Roles could not load. Try again.
              </button>
            )}
            <div className="space-y-1">
              {(data?.roles ?? []).map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => selectRole(role)}
                  className={cn(
                    'w-full rounded-sm px-3 py-2 text-left transition-colors',
                    draft.id === role.id ? 'bg-band text-primary' : 'hover:bg-muted',
                  )}
                >
                  <span className="block truncate text-sm font-medium">{role.name}</span>
                  <span className="block text-micro text-muted-foreground">
                    {role.isBuiltIn ? 'Built in' : 'Workspace'} · {role.capabilities.length} capabilities
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Role name</label>
                <Input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Shift lead"
                  disabled={selectedRole?.isBuiltIn}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Description</label>
                <Input
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="What this role is responsible for"
                  disabled={selectedRole?.isBuiltIn}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground">Capabilities</p>
              <p className="mb-3 text-xs text-muted-foreground">A role can only contain access you are allowed to grant.</p>
              <div className="grid gap-2 xl:grid-cols-2">
                {Object.entries(data?.capabilityGroups ?? {}).map(([moduleId, capabilities]) => {
                  const visible = capabilities.filter((capability) => editable.has(capability) || draft.capabilities.includes(capability));
                  if (visible.length === 0) return null;
                  return (
                    <details key={moduleId} className="rounded-sm border border-rule p-3" open={visible.some((capability) => draft.capabilities.includes(capability))}>
                      <summary className="cursor-pointer text-xs font-semibold capitalize text-foreground">
                        {moduleId} · {visible.filter((capability) => draft.capabilities.includes(capability)).length}/{visible.length}
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        {visible.map((capability) => (
                          <label key={capability} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 accent-primary"
                              checked={draft.capabilities.includes(capability)}
                              disabled={selectedRole?.isBuiltIn || !editable.has(capability)}
                              onChange={() => toggleCapability(capability)}
                            />
                            <span>{capability}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2 border-t border-rule pt-4">
              <div>
                {selectedRole && !selectedRole.isBuiltIn && (
                  <Button variant="outline" onClick={() => remove.mutate(selectedRole)} disabled={remove.isPending}>
                    Delete role
                  </Button>
                )}
              </div>
              <Button
                onClick={() => save.mutate()}
                disabled={!!selectedRole?.isBuiltIn || draft.name.trim().length < 2 || save.isPending}
              >
                {save.isPending ? 'Saving…' : draft.id ? 'Save role' : 'Create role'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
