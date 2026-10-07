'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Layers } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { ApiError } from '@/lib/api/client';
import { createCmsEntry, getCmsContentTypes, getCmsLocales } from '@/lib/modules/cms/client';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { cmsKeys, invalidateCms } from './shared';

/**
 * Pick what to write, then the editor opens on a fresh draft. A singleton that
 * already has its entry opens that entry instead of failing.
 */
export function NewEntryDialog({
  initialTypeId,
  onClose,
  onCreated,
  onNewModel,
}: {
  initialTypeId?: string;
  onClose: () => void;
  onCreated: (entryId: string) => void;
  onNewModel?: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const [typeId, setTypeId] = useState(initialTypeId ?? '');
  const [locale, setLocale] = useState('');

  const typesQuery = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const localesQuery = useQuery({
    queryKey: cmsKeys.locales(tenantId),
    queryFn: () => getCmsLocales(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const defaultLocale = localesQuery.data?.find((row) => row.isDefault)?.code ?? '';

  const create = useMutation({
    mutationFn: () => createCmsEntry({ contentTypeId: typeId, locale: locale || defaultLocale || undefined }, tenantId ?? undefined),
    onSuccess: (entry) => {
      invalidateCms(queryClient);
      onCreated(entry.id);
    },
    onError: (error) => {
      // The API names the singleton's existing entry; open it rather than dead-end.
      if (error instanceof ApiError && error.status === 409) {
        const existing = typesQuery.data?.find((type) => type.id === typeId);
        if (existing?.kind === 'singleton') toast('error', `${existing.name} already has its entry — find it in Entries.`);
        else toast('error', error.message);
        return;
      }
      toast('error', error.message);
    },
  });

  const types = typesQuery.data ?? [];

  return (
    <Modal
      title="New entry"
      description="Choose the content type to write."
      onClose={onClose}
      size="lg"
      footer={
        types.length > 0 ? (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!typeId || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? 'Creating…' : 'Create draft'}
            </Button>
          </div>
        ) : undefined
      }
    >
      {typesQuery.isPending ? (
        <LoadingState label="Loading content types" compact />
      ) : types.length === 0 ? (
        <EmptyState
          compact
          icon={Layers}
          title="No content types yet"
          description="Model what you want to write first."
          action={onNewModel ? { label: 'Create a content type', onClick: onNewModel, icon: Layers } : undefined}
        />
      ) : (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Content type" className="grid gap-2 sm:grid-cols-2">
            {types.map((type) => (
              <button
                key={type.id}
                type="button"
                role="radio"
                aria-checked={typeId === type.id}
                onClick={() => setTypeId(type.id)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  typeId === type.id ? 'border-primary bg-primary/6' : 'border-rule/60 hover:bg-band/50',
                )}
              >
                <span className="block text-sm font-semibold text-foreground">{type.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {type.kind === 'singleton' ? 'Single entry' : `${type.entryCount ?? 0} entries`} · {type.fields.length} fields
                </span>
              </button>
            ))}
          </div>
          {(localesQuery.data?.length ?? 0) > 1 && (
            <Select
              ariaLabel="Locale"
              value={locale || defaultLocale}
              onValueChange={setLocale}
              options={(localesQuery.data ?? []).map((row) => ({
                value: row.code,
                label: `${row.name} (${row.code})${row.isDefault ? ' · default' : ''}`,
              }))}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
