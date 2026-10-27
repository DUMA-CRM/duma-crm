'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ArrowRight, Building2, LayoutDashboard, Loader2, Plus } from '@/components/icons';
import { usePlatformContext } from '@/components/layout/ContextSwitcher';
import { FOUNDATION_MODULES, MODULE_ORDER, moduleCopy } from '@/components/onboarding/modules';
import { WorkspaceList } from '@/components/settings/workspaces/WorkspaceList';
import { EditorShell } from '@/components/shared/EditorShell';
import { Modal } from '@/components/shared/Modal';
import { Bone } from '@/components/shared/Skeleton';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { getPlatformWorkspaces, provisionInternalWorkspace } from '@/lib/api/platform.service';
import { useWorkspaceSwitch } from '@/lib/hooks/useWorkspaceSwitch';
import { MODULE_IDS } from '@/lib/modules/manifest';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';

/** Modules DUMA's own team is likely to want; the rest stay one switch away. */
const SUGGESTED_INTERNAL = ['cms', 'forms', 'notes', 'people', 'customers', 'communications', 'support'];

function ProvisionInternalForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('DUMA');
  const [slug, setSlug] = useState('duma-internal');
  const [timezone, setTimezone] = useState('Europe/London');
  const [modules, setModules] = useState<string[]>(SUGGESTED_INTERNAL);
  const options = [...MODULE_ORDER, ...MODULE_IDS.filter((id) => !(MODULE_ORDER as readonly string[]).includes(id))].filter(
    (id) => !FOUNDATION_MODULES.has(id),
  );
  const mutation = useMutation({
    mutationFn: () => provisionInternalWorkspace({ name: name.trim(), slug, timezone, moduleIds: modules }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('platform-context') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('platform-workspaces') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenants') });
      toast('success', result.created ? 'DUMA’s internal workspace is ready.' : 'DUMA already has an internal workspace.');
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
      <Input
        label="Address"
        value={slug}
        onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
        required
        hint="Lower case, no spaces. It must not be any client’s."
      />
      <div className="space-y-1.5">
        <label htmlFor="internal-timezone" className="text-sm font-semibold text-foreground">
          Timezone
        </label>
        <TimezoneSelect id="internal-timezone" value={timezone} onChange={setTimezone} required />
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">Modules</legend>
        <p className="mt-0.5 text-xs text-muted-foreground">
          What a module needs is switched on with it. Change this later in the workspace’s settings.
        </p>
        <div className="mt-2 grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
          {options.map((id) => {
            const copy = moduleCopy(id);
            const checked = modules.includes(id);
            return (
              <label
                key={id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-sm',
                  checked ? 'border-primary bg-primary/5' : 'border-rule/70 hover:bg-band/45',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setModules((current) => (checked ? current.filter((entry) => entry !== id) : [...current, id]))}
                  className="size-4 accent-primary"
                />
                {copy.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="rounded-md bg-band/65 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        A normal workspace, classified internal: its own records, roles, media storage and email settings, and no members yet. Invite DUMA
        staff from its People screen with an ordinary role — membership never grants platform access.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending || name.trim().length < 2 || slug.length < 2}>
          {mutation.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          {mutation.isPending ? 'Creating…' : 'Create internal workspace'}
        </Button>
      </div>
    </form>
  );
}

function InternalWorkspaceCard() {
  const platform = usePlatformContext();
  const switchTo = useWorkspaceSwitch();
  const [creating, setCreating] = useState(false);
  const internal = platform.data?.internalWorkspace;

  return (
    <section aria-labelledby="internal-heading" className="rounded-lg border border-rule/60 bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground">
          <LayoutDashboard size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="internal-heading" className="text-sm font-semibold text-foreground">
            DUMA internal workspace
          </h2>
          {platform.isLoading ? (
            <Bone className="mt-1 h-3.5 w-48" />
          ) : platform.isError ? (
            <p className="text-xs text-exception">Couldn’t check for it. Reload to try again.</p>
          ) : internal ? (
            <p className="text-xs text-muted-foreground">
              {internal.name} · {internal.slug} — DUMA’s own records and content, excluded from client figures.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Not set up. Create one to run DUMA’s own content, forms and team on the same modules.
            </p>
          )}
        </div>
        {internal ? (
          <Button variant="outline" size="sm" onClick={() => void switchTo({ kind: 'workspace', tenantId: internal.id, locationId: null })}>
            Open
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        ) : (
          !platform.isLoading &&
          !platform.isError && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} aria-hidden="true" />
              Set up
            </Button>
          )
        )}
      </div>
      {creating && (
        <Modal
          title="DUMA internal workspace"
          description="Created once. Existing workspaces are never repurposed."
          onClose={() => setCreating(false)}
          size="lg"
        >
          <ProvisionInternalForm onClose={() => setCreating(false)} />
        </Modal>
      )}
    </section>
  );
}

export function AdminWorkspaces() {
  const directory = useQuery({ queryKey: moduleQueryKeys.identity.key('platform-workspaces'), queryFn: getPlatformWorkspaces });
  const rows = useMemo(() => new Map((directory.data?.workspaces ?? []).map((row) => [row.id, row])), [directory.data]);

  return (
    <EditorShell eyebrow="DUMA Admin" title="Workspaces" icon={<Building2 size={18} aria-hidden="true" />}>
      <div className="space-y-5">
        <InternalWorkspaceCard />
        <WorkspaceList directory={rows} />
      </div>
    </EditorShell>
  );
}
