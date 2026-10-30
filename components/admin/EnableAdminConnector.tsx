'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';

import { changeTenantModule, previewTenantModuleChange } from '@/lib/api/modules.service';
import type { ModuleId } from '@/lib/modules/manifest';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

export function EnableAdminConnector({
  tenantId,
  moduleId,
  name,
  onClose,
}: {
  tenantId: string;
  moduleId: ModuleId;
  name: string;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const enable = useMutation({
    mutationFn: async () => {
      const preview = await previewTenantModuleChange(tenantId, moduleId, 'enabled');
      if (!preview.canApply) throw new Error('This module cannot be enabled. Review its dependencies in the internal workspace.');
      await changeTenantModule(tenantId, preview, `Enable ${name} for DUMA admin connections`);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId) }),
  });
  return (
    <EditorShell title={name} onClose={onClose}>
      <div className="max-w-xl space-y-4">
        <h2 className="text-lg font-semibold">Enable {name}</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Enable the {moduleId} module and its required dependencies in DUMA’s internal workspace, then connect your provider.
        </p>
        <Button disabled={enable.isPending} onClick={() => enable.mutate()}>
          {enable.isPending ? 'Enabling…' : `Enable ${name}`}
        </Button>
        {enable.isError && (
          <p role="alert" className="text-sm text-exception">
            {enable.error.message}
          </p>
        )}
      </div>
    </EditorShell>
  );
}
