'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { MediaPicker } from '@/components/cms/MediaPicker';
import { ArrowLeft, ArrowRight, ImageIcon, Link2, Plus, Trash2 } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  addCatalogImage,
  getItemCatalog,
  removeCatalogImage,
  reorderCatalogImages,
  updateCatalogImage,
} from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import type { CatalogImage } from '@/types/catalog';

import { catalogKey } from './VariantsEditor';

/**
 * A product's photos, in the order a shop shows them — the first is the main
 * one. From Media (uploaded once, optimised, with sizes for phones) or a link
 * to an image hosted elsewhere. A photo can show one colour only.
 */
export function ProductPhotos({ menuItemId, productName, tenantId }: { menuItemId: string; productName: string; tenantId: string }) {
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({ queryKey: catalogKey(menuItemId, tenantId), queryFn: () => getItemCatalog(menuItemId, tenantId) });
  const [picking, setPicking] = useState(false);
  const [link, setLink] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('item-catalog', tenantId, menuItemId) });

  const add = useMutation({
    mutationFn: async (sources: Array<{ assetId: string } | { url: string }>) => {
      for (const source of sources) await addCatalogImage(menuItemId, source, tenantId);
      return sources.length;
    },
    onSuccess: (count) => {
      setLink('');
      void refresh();
      toast('success', count === 1 ? 'Photo added.' : `${count} photos added.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderCatalogImages(menuItemId, ids, tenantId),
    onSuccess: () => void refresh(),
    onError: (error) => toast('error', error.message),
  });

  if (catalogQuery.isPending) return <LoadingState label="Loading photos" />;
  if (catalogQuery.isError) return <ErrorState title="Couldn’t load this product’s photos" onRetry={() => void catalogQuery.refetch()} />;
  const { images, options } = catalogQuery.data;
  // A photo can be tied to any one value — usually a colour.
  const valueOptions = options.flatMap((option) =>
    option.values.map((value) => ({ value: value.id, label: `${option.name}: ${value.label}` })),
  );
  const linkValid = /^https?:\/\/\S+$/i.test(link.trim());
  const move = (index: number, by: -1 | 1) => {
    const ids = images.map((image) => image.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);
    reorder.mutate(ids);
  };

  return (
    <SettingsSection
      title="Photos"
      description="The first is the main photo. Tie a photo to a colour and shops show it when that colour is picked."
      actions={
        <Button size="sm" className="gap-1.5" disabled={add.isPending} onClick={() => setPicking(true)}>
          <Plus size={14} aria-hidden="true" /> From Media
        </Button>
      }
    >
      <div className="space-y-4">
        {images.length === 0 ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-rule/70 bg-control px-4 py-10 text-sm text-muted-foreground transition-colors hover:border-rule hover:text-foreground"
          >
            <ImageIcon size={22} aria-hidden="true" />
            <span className="font-medium text-foreground">Add {productName}’s photos</span>
            <span className="text-xs">Choose from Media, or upload new ones there</span>
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {images.map((image, index) => (
              <PhotoTile
                key={image.id}
                image={image}
                main={index === 0}
                valueOptions={valueOptions}
                tenantId={tenantId}
                onChanged={() => void refresh()}
                onMove={(by) => move(index, by)}
                canMoveBack={index > 0}
                canMoveOn={index < images.length - 1}
                busy={reorder.isPending}
              />
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              aria-label="Image link"
              placeholder="Or paste a link to an image — https://…"
              leftIcon={<Link2 size={14} aria-hidden="true" />}
              value={link}
              onChange={(event) => setLink(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && linkValid) add.mutate([{ url: link.trim() }]);
              }}
            />
          </div>
          <Button
            variant="outline"
            className="bg-control"
            disabled={!linkValid || add.isPending}
            onClick={() => add.mutate([{ url: link.trim() }])}
          >
            Add link
          </Button>
        </div>
      </div>
      {picking && (
        <MediaPicker
          multiple
          groups={['image']}
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            setPicking(false);
            const have = new Set(images.map((image) => image.assetId));
            const fresh = ids.filter((id) => !have.has(id));
            if (fresh.length > 0) add.mutate(fresh.map((assetId) => ({ assetId })));
          }}
        />
      )}
    </SettingsSection>
  );
}

function PhotoTile({
  image,
  main,
  valueOptions,
  tenantId,
  onChanged,
  onMove,
  canMoveBack,
  canMoveOn,
  busy,
}: {
  image: CatalogImage;
  main: boolean;
  valueOptions: Array<{ value: string; label: string }>;
  tenantId: string;
  onChanged: () => void;
  onMove: (by: -1 | 1) => void;
  canMoveBack: boolean;
  canMoveOn: boolean;
  busy: boolean;
}) {
  const [alt, setAlt] = useState(image.altText ?? '');
  const update = useMutation({
    mutationFn: (data: Parameters<typeof updateCatalogImage>[1]) => updateCatalogImage(image.id, data, tenantId),
    onSuccess: onChanged,
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: () => removeCatalogImage(image.id, tenantId),
    onSuccess: () => {
      onChanged();
      toast('success', 'Photo removed — the file stays in Media.');
    },
    onError: (error) => toast('error', error.message),
  });
  return (
    <li className={cn('overflow-hidden rounded-lg border bg-control', main ? 'border-primary/50' : 'border-rule/60')}>
      <div className="relative aspect-square bg-band/40">
        {image.url && (
          // eslint-disable-next-line @next/next/no-img-element -- tenant media or a merchant's own image host
          <img
            src={image.url}
            alt={image.altText ?? ''}
            loading="lazy"
            className="size-full object-cover"
            style={image.focalPoint ? { objectPosition: `${image.focalPoint.x * 100}% ${image.focalPoint.y * 100}%` } : undefined}
          />
        )}
        {main && (
          <span className="absolute left-2 top-2 rounded-sm bg-primary px-1.5 py-0.5 text-[0.6875rem] font-semibold text-primary-foreground">
            Main
          </span>
        )}
        <div className="absolute right-1.5 top-1.5 flex gap-1">
          {canMoveBack && (
            <Tooltip side="top" label="Move earlier">
              <button
                type="button"
                disabled={busy}
                aria-label="Move earlier"
                onClick={() => onMove(-1)}
                className="flex size-7 items-center justify-center rounded-md bg-background/90 text-foreground shadow-sm hover:bg-background"
              >
                <ArrowLeft size={13} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
          {canMoveOn && (
            <Tooltip side="top" label="Move later">
              <button
                type="button"
                disabled={busy}
                aria-label="Move later"
                onClick={() => onMove(1)}
                className="flex size-7 items-center justify-center rounded-md bg-background/90 text-foreground shadow-sm hover:bg-background"
              >
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            </Tooltip>
          )}
          <Tooltip side="top" align="end" label="Remove photo">
            <button
              type="button"
              aria-label="Remove photo"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
              className="flex size-7 items-center justify-center rounded-md bg-background/90 text-exception shadow-sm hover:bg-background"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="space-y-1.5 p-2">
        {valueOptions.length > 0 && (
          <Select
            ariaLabel="Shows"
            className="w-full"
            value={image.optionValueId ?? ''}
            onValueChange={(value) => update.mutate({ optionValueId: value || null })}
            options={[{ value: '', label: 'Every option' }, ...valueOptions]}
          />
        )}
        <input
          aria-label="Alt text"
          value={alt}
          placeholder="Describe it for screen readers"
          onChange={(event) => setAlt(event.target.value)}
          onBlur={() => alt.trim() !== (image.altText ?? '') && update.mutate({ altText: alt.trim() || null })}
          className={cn(
            'h-8 w-full rounded-sm border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none',
            alt.trim() ? 'border-rule/60 focus:border-rule' : 'border-measured/40 focus:border-measured',
          )}
        />
      </div>
    </li>
  );
}
