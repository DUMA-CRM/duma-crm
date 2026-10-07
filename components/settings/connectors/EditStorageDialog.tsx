'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { invalidateCms } from '@/components/cms/shared';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type CmsStorageConnection, updateCmsStorageConnection } from '@/lib/modules/cms/client';
import { QUOTA_UNITS, type QuotaUnit, bytesToQuota, quotaToBytes } from '@/lib/utils/media-storage';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Change what can change on a connected bucket: its name, limit, public URL
 * and credentials. Where files are stored (bucket, endpoint, prefix) is fixed
 * once files are there — connect the new place through the wizard instead.
 * New credentials are re-tested by the API before they are saved.
 */
export function EditStorageDialog({ connection, onClose }: { connection: CmsStorageConnection; onClose: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const isS3 = connection.provider === 's3';
  const initialQuota = bytesToQuota(connection.quotaBytes);
  const [form, setForm] = useState({
    displayName: connection.displayName,
    accessKeyId: connection.configuration.accessKeyId ?? '',
    secret: '',
    publicBaseUrl: connection.configuration.publicBaseUrl ?? '',
    quota: initialQuota.value,
    quotaUnit: initialQuota.unit as QuotaUnit,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const quotaBytes = quotaToBytes(form.quota, form.quotaUnit);

  const save = useMutation({
    mutationFn: () =>
      updateCmsStorageConnection(
        connection.id,
        {
          displayName: form.displayName.trim(),
          quotaBytes: quotaBytes ?? null,
          ...(isS3 ? { configuration: { accessKeyId: form.accessKeyId, publicBaseUrl: form.publicBaseUrl } } : {}),
          ...(form.secret.trim() ? { secret: form.secret.trim() } : {}),
        },
        tenantId,
      ),
    onSuccess: () => {
      invalidateCms(queryClient);
      toast('success', 'Storage updated.');
      onClose();
    },
    onError: (failure) => setError(failure.message),
  });

  return (
    <Modal
      title={`Edit ${connection.displayName}`}
      description="New credentials are tested with a small upload before they are saved."
      size="md"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!form.displayName.trim() || quotaBytes === undefined || (isS3 && !form.accessKeyId.trim()) || save.isPending}
            onClick={() => {
              setError(null);
              save.mutate();
            }}
          >
            {save.isPending ? 'Checking…' : 'Save'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Name" value={form.displayName} onChange={(event) => set({ displayName: event.target.value })} />
        {isS3 && (
          <Input
            label="Public URL (optional)"
            value={form.publicBaseUrl}
            onChange={(event) => set({ publicBaseUrl: event.target.value })}
            hint="Applies to new uploads. Files already stored keep the URL they were given."
          />
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
          <Input
            label="Storage limit (optional)"
            inputMode="decimal"
            placeholder="No limit"
            value={form.quota}
            onChange={(event) => set({ quota: event.target.value })}
            error={quotaBytes === undefined ? 'Enter a positive number, or leave it blank' : undefined}
          />
          <div className="sm:pt-5">
            <Select
              ariaLabel="Limit unit"
              className="w-full"
              value={form.quotaUnit}
              onValueChange={(value) => set({ quotaUnit: value as QuotaUnit })}
              options={QUOTA_UNITS.map((unit) => ({ value: unit, label: unit }))}
            />
          </div>
        </div>
        {isS3 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Access key ID"
              autoComplete="off"
              value={form.accessKeyId}
              onChange={(event) => set({ accessKeyId: event.target.value })}
              hint="Shown masked. Type a new one to change it."
            />
            <Input
              label="New secret access key"
              type="password"
              autoComplete="off"
              placeholder="Keep the current key"
              value={form.secret}
              onChange={(event) => set({ secret: event.target.value })}
            />
          </div>
        ) : (
          <Input
            label="New read-write token"
            type="password"
            autoComplete="off"
            placeholder="Keep the current token"
            value={form.secret}
            onChange={(event) => set({ secret: event.target.value })}
          />
        )}
        {error && (
          <p role="alert" className="rounded-md border border-exception/50 bg-exception/6 px-3 py-2 text-sm text-exception">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
