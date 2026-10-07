'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { Check, FileText, ImageIcon, Search, UploadCloud } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type CmsAsset, type CmsMediaGroup, getCmsAssets, uploadCmsAsset } from '@/lib/modules/cms/client';
import { isImage } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { createRenditions } from './renditions';
import { PanelError, assetPreviewSrc, cmsKeys, invalidateCms } from './shared';

/** Choose assets for a media field, or upload one in place. */
export function MediaPicker({
  multiple,
  groups,
  onPick,
  onClose,
}: {
  multiple: boolean;
  groups?: CmsMediaGroup[];
  /** The chosen ids, in order, and the assets themselves for callers that need their URLs. */
  onPick: (ids: string[], assets: CmsAsset[]) => void;
  onClose: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  // Uploaded here, so a pick can hand them back before the list refetches.
  const uploaded = useRef(new Map<string, CmsAsset>());
  // A field restricted to one media group only ever shows that group.
  const kind: CmsMediaGroup | '' = groups && groups.length === 1 ? groups[0]! : '';

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = { q: q || undefined, kind };
  const assetsQuery = useQuery({
    queryKey: cmsKeys.assets(tenantId, filters),
    queryFn: () => getCmsAssets(filters, tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const asset = await uploadCmsAsset(file, {}, tenantId ?? undefined);
      await createRenditions(asset, tenantId ?? undefined, file).catch(() => 0);
      return asset;
    },
    onSuccess: (asset) => {
      uploaded.current.set(asset.id, asset);
      invalidateCms(queryClient);
      toast('success', `${asset.fileName} uploaded.`);
      if (multiple) setChosen((current) => [...current, asset.id]);
      else pick([asset.id]);
    },
    onError: (error) => toast('error', error.message),
  });

  const toggle = (id: string) => {
    if (!multiple) {
      pick([id]);
      return;
    }
    setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  /** Hand back the ids and the assets themselves, for callers that need their URLs. */
  const pick = (ids: string[]) => {
    const listed = new Map((assetsQuery.data?.data ?? []).map((asset) => [asset.id, asset]));
    onPick(
      ids,
      ids.map((id) => listed.get(id) ?? uploaded.current.get(id)).filter((asset): asset is CmsAsset => Boolean(asset)),
    );
  };
  const assets = (assetsQuery.data?.data ?? []).filter((asset) => {
    if (!groups || groups.length === 0) return true;
    const group = asset.mimeType.startsWith('image/')
      ? 'image'
      : asset.mimeType.startsWith('video/')
        ? 'video'
        : asset.mimeType.startsWith('audio/')
          ? 'audio'
          : 'document';
    return groups.includes(group);
  });

  return (
    <Modal
      title={multiple ? 'Choose media' : 'Choose a file'}
      description={groups && groups.length > 0 ? `Only ${groups.join(', ')} files fit this field.` : undefined}
      onClose={onClose}
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" className="gap-1.5" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
            <UploadCloud size={14} aria-hidden="true" /> {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
          {multiple && (
            <Button disabled={chosen.length === 0} onClick={() => pick(chosen)}>
              Add {chosen.length || ''} {chosen.length === 1 ? 'file' : 'files'}
            </Button>
          )}
        </div>
      }
    >
      <input
        ref={fileInput}
        type="file"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.mutate(file);
          event.target.value = '';
        }}
      />
      <Input
        aria-label="Search media"
        placeholder="Search by name, title or alt text"
        leftIcon={<Search size={14} aria-hidden="true" />}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="mt-3 max-h-[55vh] overflow-y-auto">
        {assetsQuery.isError ? (
          <PanelError title="Media couldn’t be loaded" onRetry={() => void assetsQuery.refetch()} />
        ) : assetsQuery.isPending ? (
          <LoadingState label="Loading media" compact />
        ) : assets.length === 0 ? (
          <EmptyState
            compact
            icon={ImageIcon}
            kind={q ? 'search' : 'start'}
            title={q ? 'Nothing matches' : 'No media yet'}
            description="Upload a file to use it here."
          />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {assets.map((asset) => {
              const on = chosen.includes(asset.id);
              return (
                <button
                  key={asset.id}
                  type="button"
                  aria-pressed={multiple ? on : undefined}
                  onClick={() => toggle(asset.id)}
                  className={cn(
                    'relative overflow-hidden rounded-md border text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    on ? 'border-primary ring-2 ring-primary/40' : 'border-rule/60 hover:border-rule',
                  )}
                >
                  {isImage(asset.mimeType) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tenant media from the API
                    <img
                      src={assetPreviewSrc(asset)}
                      alt={asset.altText ?? ''}
                      className="aspect-4/3 w-full bg-band object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex aspect-4/3 items-center justify-center bg-band/60 text-muted-foreground">
                      <FileText size={22} aria-hidden="true" />
                    </span>
                  )}
                  <span className="block truncate px-2 py-1 text-xs text-muted-foreground">{asset.title ?? asset.fileName}</span>
                  {on && (
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check size={12} aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
