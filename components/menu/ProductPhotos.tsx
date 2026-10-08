'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { ImageOptionsDialog } from '@/components/cms/ImageOptionsDialog';
import { AssetDrawer } from '@/components/cms/MediaPanel';
import { MediaPicker } from '@/components/cms/MediaPicker';
import { createRenditions } from '@/components/cms/renditions';
import { InfoRow, InfoRows } from '@/components/cms/rows';
import { AlertTriangle, ArrowLeft, ArrowRight, ImageIcon, Link2, Palette, Plus, Star, UploadCloud } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { proxiedImage } from '@/lib/api/client';
import { uploadCmsAsset } from '@/lib/api/cms.service';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import {
  addCatalogImage,
  getItemCatalog,
  removeCatalogImage,
  reorderCatalogImages,
  updateCatalogImage,
} from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { formatBytes } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { isConvertibleImage } from '@/lib/utils/media-storage';
import { toast } from '@/stores/toastStore';
import type { CatalogImage, CatalogOption } from '@/types/catalog';

import { catalogKey } from './VariantsEditor';

/**
 * A product's photos, laid out like Media — the same tiles, the same drawer —
 * narrowed to this product, with what only a product has: the main photo,
 * which colour a photo shows, and the order a shop shows them in.
 */
export function ProductPhotos({ menuItemId, productName, tenantId }: { menuItemId: string; productName: string; tenantId: string }) {
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({ queryKey: catalogKey(menuItemId, tenantId), queryFn: () => getItemCatalog(menuItemId, tenantId) });
  const { contentEnabled } = useCatalogWords();
  const fileInput = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const [linking, setLinking] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Images waiting on the optimise dialog (convert, compress, crop) before they upload.
  const [staged, setStaged] = useState<File[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [shows, setShows] = useState('');

  // The main photo is the product's image in the list, at the till and on the QR menu — refresh those too.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('item-catalog', tenantId, menuItemId) }),
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-items') }),
    ]);

  const add = useMutation({
    mutationFn: async (sources: Array<{ assetId: string } | { url: string }>) => {
      for (const source of sources) await addCatalogImage(menuItemId, source, tenantId);
      return sources.length;
    },
    onSuccess: (count) => {
      setLinking(false);
      void refresh();
      toast('success', count === 1 ? 'Photo added.' : `${count} photos added.`);
    },
    onError: (error) => toast('error', error.message),
  });
  // Upload straight from the product: into Media (optimised, with phone sizes), then onto the product.
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const failures: string[] = [];
      let added = 0;
      for (const file of files) {
        try {
          const asset = await uploadCmsAsset(file, { title: productName, folder: 'Products' }, tenantId);
          await createRenditions(asset, tenantId, file).catch(() => 0);
          await addCatalogImage(menuItemId, { assetId: asset.id }, tenantId);
          added += 1;
        } catch (error) {
          failures.push(`${file.name}: ${error instanceof Error ? error.message : 'failed'}`);
        }
      }
      return { added, failures };
    },
    onSuccess: ({ added, failures }) => {
      setStaged(null);
      void refresh();
      if (added > 0) toast('success', added === 1 ? 'Photo uploaded.' : `${added} photos uploaded.`);
      if (failures.length > 0) toast('error', failures.join(' · '));
    },
    onError: (error) => toast('error', error.message),
  });
  const onFiles = (list: FileList | null | undefined) => {
    const files = [...(list ?? [])].filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    if (files.some((file) => isConvertibleImage(file.type))) setStaged(files);
    else upload.mutate(files);
  };

  if (catalogQuery.isPending) return <LoadingState label="Loading photos" />;
  if (catalogQuery.isError) return <ErrorState title="Couldn’t load this product’s photos" onRetry={() => void catalogQuery.refetch()} />;
  const { images, options } = catalogQuery.data;
  const valueLabel = (id: string | null) =>
    id ? (options.flatMap((option) => option.values).find((value) => value.id === id)?.label ?? null) : null;
  const shown =
    shows === 'all-only'
      ? images.filter((image) => !image.optionValueId)
      : shows
        ? images.filter((image) => image.optionValueId === shows)
        : images;
  const filterChoices = options.flatMap((option) =>
    option.values.map((value) => ({ value: value.id, label: `${option.name}: ${value.label}` })),
  );
  const open = images.find((image) => image.id === openId) ?? null;

  return (
    <div
      className="relative flex flex-1 flex-col gap-3"
      onDragOver={(event) => {
        if (!contentEnabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        if (!contentEnabled) return;
        event.preventDefault();
        setDragging(false);
        onFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {/* One row, as on Media: what to show, then where photos come from. */}
      <div className="flex flex-wrap items-center gap-2">
        {filterChoices.length > 0 && (
          <Select
            ariaLabel="Shows"
            className="w-48"
            value={shows}
            onValueChange={setShows}
            options={[{ value: '', label: 'All photos' }, { value: 'all-only', label: 'For every option' }, ...filterChoices]}
          />
        )}
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{images.length}</span> {images.length === 1 ? 'photo' : 'photos'}
          {images.length > 1 && ' · the first is the main one'}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setLinking(true)}>
            <Link2 size={14} aria-hidden="true" /> Link
          </Button>
          {contentEnabled && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5 bg-control" disabled={add.isPending} onClick={() => setPicking(true)}>
                <Plus size={14} aria-hidden="true" /> From Media
              </Button>
              <Button size="sm" className="gap-1.5" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
                <UploadCloud size={14} aria-hidden="true" /> {upload.isPending ? 'Uploading…' : 'Upload'}
              </Button>
            </>
          )}
        </span>
      </div>

      {!contentEnabled && (
        <p className="rounded-lg border border-measured/35 bg-measured/6 px-3.5 py-3 text-sm text-foreground">
          Uploading needs <span className="font-semibold">Website content</span> — it stores and optimises your photos. Switch it on in
          Settings → Modules, or add photos by link.
        </p>
      )}

      {images.length === 0 ? (
        <EmptyState
          className="flex-1"
          icon={ImageIcon}
          title={`Upload ${productName}’s photos`}
          description="Drop them here or choose files — they’re optimised and sized for phones. The first is the main photo."
          action={contentEnabled ? { label: 'Upload', onClick: () => fileInput.current?.click(), icon: UploadCloud } : undefined}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          className="flex-1"
          kind="search"
          icon={Palette}
          title="No photo shows this yet"
          description="Open a photo and choose what it shows."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((image) => {
            const main = image.id === images[0]?.id;
            const label = valueLabel(image.optionValueId);
            const missingAlt = !image.altText;
            return (
              <li key={image.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setOpenId(image.id)}
                  className={cn(
                    'block w-full overflow-hidden rounded-lg border bg-background text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    main ? 'border-primary/50 ring-2 ring-primary/15' : 'border-rule/55 hover:border-rule',
                  )}
                >
                  {image.apiUrl || image.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tenant media or a merchant's own image host
                    <img
                      src={proxiedImage(image.apiUrl ?? image.url) ?? undefined}
                      alt={image.altText ?? ''}
                      loading="lazy"
                      className="aspect-4/3 w-full bg-band object-cover"
                      style={image.focalPoint ? { objectPosition: `${image.focalPoint.x * 100}% ${image.focalPoint.y * 100}%` } : undefined}
                    />
                  ) : (
                    <span className="flex aspect-4/3 w-full items-center justify-center bg-band/60 text-muted-foreground">
                      <ImageIcon size={22} aria-hidden="true" />
                    </span>
                  )}
                  <span className="block truncate px-2.5 pt-2 text-xs font-semibold text-foreground">
                    {image.file?.title ?? image.file?.fileName ?? 'Linked image'}
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 pb-2 text-xs text-muted-foreground">
                    <span className="min-w-0 flex-1 truncate tabular-nums">
                      {image.file
                        ? `${formatBytes(image.file.sizeBytes)}${image.file.width && image.file.height ? ` · ${image.file.width}×${image.file.height}` : ''}`
                        : 'From a link'}
                    </span>
                    <span className="shrink-0 rounded-sm bg-band px-1.5 py-0.5 text-label font-medium text-foreground">
                      {label ?? 'All'}
                    </span>
                  </span>
                </button>
                {main && (
                  <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm bg-primary px-1.5 py-0.5 text-label font-semibold text-primary-foreground">
                    <Star size={10} aria-hidden="true" /> Main
                  </span>
                )}
                {missingAlt && (
                  <Tooltip side="top" align="end" label="No alt text — open to add it">
                    <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md border border-measured/40 bg-background/95 text-measured shadow-sm">
                      <AlertTriangle size={13} aria-label="No alt text" />
                    </span>
                  </Tooltip>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Over the page rather than above it, so nothing jumps while dragging. */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/6 backdrop-blur-[1px]">
          <span className="flex items-center gap-2 rounded-lg border border-primary/30 bg-control px-4 py-2.5 text-sm font-semibold text-primary shadow-sm">
            <UploadCloud size={16} aria-hidden="true" /> Drop to upload to {productName}
          </span>
        </div>
      )}

      {open &&
        (open.assetId ? (
          <AssetDrawer
            assetId={open.assetId}
            onClose={() => setOpenId(null)}
            onChanged={() => void refresh()}
            extra={
              <OnThisProduct
                image={open}
                images={images}
                options={options}
                menuItemId={menuItemId}
                tenantId={tenantId}
                onChanged={() => void refresh()}
                onRemoved={() => setOpenId(null)}
              />
            }
          />
        ) : (
          <Drawer title="Linked image" description={open.url ?? undefined} onClose={() => setOpenId(null)}>
            <div className="space-y-6">
              <OnThisProduct
                image={open}
                images={images}
                options={options}
                menuItemId={menuItemId}
                tenantId={tenantId}
                onChanged={() => void refresh()}
                onRemoved={() => setOpenId(null)}
              />
              {open.url && (
                // eslint-disable-next-line @next/next/no-img-element -- a merchant's own image host
                <img
                  src={open.url}
                  alt={open.altText ?? ''}
                  className="max-h-80 w-full rounded-lg border border-rule/50 bg-band object-contain"
                />
              )}
            </div>
          </Drawer>
        ))}

      {linking && <LinkDialog pending={add.isPending} onAdd={(url) => add.mutate([{ url }])} onClose={() => setLinking(false)} />}
      {staged && (
        <ImageOptionsDialog
          files={staged}
          mode="upload"
          freeBytes={null}
          isPending={upload.isPending}
          onConfirm={(files) => upload.mutate(files)}
          onClose={() => setStaged(null)}
        />
      )}
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
    </div>
  );
}

/** The photo's place on this product, at the top of its drawer: main, what it shows, its position, and removal. */
function OnThisProduct({
  image,
  images,
  options,
  menuItemId,
  tenantId,
  onChanged,
  onRemoved,
}: {
  image: CatalogImage;
  images: CatalogImage[];
  options: CatalogOption[];
  menuItemId: string;
  tenantId: string;
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const index = images.findIndex((entry) => entry.id === image.id);
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderCatalogImages(menuItemId, ids, tenantId),
    onSuccess: onChanged,
    onError: (error) => toast('error', error.message),
  });
  const update = useMutation({
    mutationFn: (data: Parameters<typeof updateCatalogImage>[1]) => updateCatalogImage(image.id, data, tenantId),
    onSuccess: onChanged,
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: () => removeCatalogImage(image.id, tenantId),
    onSuccess: () => {
      onChanged();
      onRemoved();
      toast('success', 'Removed from this product — the file stays in Media.');
    },
    onError: (error) => toast('error', error.message),
  });
  const move = (to: number) => {
    const ids = images.map((entry) => entry.id);
    ids.splice(index, 1);
    ids.splice(to, 0, image.id);
    reorder.mutate(ids);
  };
  const choices = options.flatMap((option) => option.values.map((value) => ({ value: value.id, label: `${option.name}: ${value.label}` })));

  return (
    <section aria-labelledby="on-this-product" className="space-y-2">
      <h3 id="on-this-product" className="text-sm font-semibold text-foreground">
        On this product
      </h3>
      <div className="space-y-3 rounded-lg border border-rule/60 bg-control p-4">
        <InfoRows>
          <InfoRow icon={Star} title="Main photo">
            {index === 0 ? (
              <span className="text-sm font-medium text-primary">This one</span>
            ) : (
              <Button size="sm" variant="outline" disabled={reorder.isPending} onClick={() => move(0)}>
                Make main
              </Button>
            )}
          </InfoRow>
          {choices.length > 0 && (
            <InfoRow icon={Palette} title="Shows">
              <Select
                ariaLabel="Shows"
                className="w-44"
                value={image.optionValueId ?? ''}
                onValueChange={(value) => update.mutate({ optionValueId: value || null })}
                options={[{ value: '', label: 'Every option' }, ...choices]}
              />
            </InfoRow>
          )}
          {images.length > 1 && (
            <InfoRow icon={ImageIcon} title="Position">
              <span className="flex items-center gap-1">
                <span className="mr-1 text-sm tabular-nums text-muted-foreground">
                  {index + 1} of {images.length}
                </span>
                <Tooltip side="top" label="Earlier">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move earlier"
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index - 1)}
                  >
                    <ArrowLeft size={14} aria-hidden="true" />
                  </Button>
                </Tooltip>
                <Tooltip side="top" align="end" label="Later">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Move later"
                    disabled={index === images.length - 1 || reorder.isPending}
                    onClick={() => move(index + 1)}
                  >
                    <ArrowRight size={14} aria-hidden="true" />
                  </Button>
                </Tooltip>
              </span>
            </InfoRow>
          )}
        </InfoRows>
        <div className="flex justify-end border-t border-rule/50 pt-2.5">
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
            className="rounded-md px-2 py-1 text-xs font-semibold text-exception transition-colors hover:bg-exception/8 disabled:opacity-50"
          >
            {remove.isPending ? 'Removing…' : 'Remove from this product'}
          </button>
        </div>
      </div>
    </section>
  );
}

/** An image hosted elsewhere — a supplier's or an old shop's — added by its address. */
function LinkDialog({ pending, onAdd, onClose }: { pending: boolean; onAdd: (url: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const valid = /^https?:\/\/\S+$/i.test(url.trim());
  return (
    <Drawer
      title="Add a photo by link"
      description="For an image hosted elsewhere. It isn’t optimised — upload it instead to get phone sizes."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || pending} onClick={() => onAdd(url.trim())}>
            {pending ? 'Adding…' : 'Add photo'}
          </Button>
        </div>
      }
    >
      <Input
        label="Image address"
        placeholder="https://…"
        value={url}
        autoFocus
        leftIcon={<Link2 size={14} aria-hidden="true" />}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && valid) onAdd(url.trim());
        }}
      />
    </Drawer>
  );
}
