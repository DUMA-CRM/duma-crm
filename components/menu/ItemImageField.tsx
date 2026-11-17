'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { canEncode, encodeImage } from '@/components/cms/imageEncode';
import { ImageIcon, Link2, Loader2, Trash2, UploadCloud } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { proxiedImage } from '@/lib/api/client';
import { hasCapability } from '@/lib/auth/capabilities';
import { uploadMenuImage } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * A menu item's photo: upload it, or paste a link to one hosted elsewhere.
 *
 * Uploads go through the menu's own route (POST /menu-items/images) into the
 * workspace's built-in storage — Media's "Menu" folder, 50 MB free — without
 * needing Website content. They are shrunk first: WebP at 90% quality, no
 * wider than 1600 px, plenty for a till tile or the QR menu and a fraction of
 * a phone photo's size.
 *
 * The field only sets the URL — the item's own Save writes it.
 */
const MENU_IMAGE = { format: 'image/webp', quality: 0.9, maxWidth: 1600 } as const;

export function ItemImageField({
  value,
  onChange,
  itemName,
  error,
  layout = 'row',
}: {
  value: string;
  onChange: (url: string) => void;
  itemName: string;
  error?: string;
  /** `stacked` for a sidebar card: the photo full width, its buttons under it. */
  layout?: 'row' | 'stacked';
}) {
  const qc = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  // The same permission the item's Save needs — anyone who can edit the menu can give it photos.
  const canUpload = hasCapability(capabilities, 'menu:write');
  const fileInput = useRef<HTMLInputElement>(null);
  const [broken, setBroken] = useState(false);
  const [dragging, setDragging] = useState(false);
  // A pasted link is the fallback — shown at once when uploading isn't possible or a link is already set.
  const [linking, setLinking] = useState(false);
  const isUploaded = /\/menu-items\/images\/|\/cms\/delivery\/assets\//.test(value);
  const showLink = linking || !canUpload || (Boolean(value) && !isUploaded);

  const upload = useMutation({
    mutationFn: async (source: File) => {
      if (!tenantId) throw new Error('Choose a workspace first.');
      // A format the browser can't redraw (HEIC, say) goes up as it is.
      const file = (await canEncode(source.type)) ? (await encodeImage(source, MENU_IMAGE)).file : source;
      const asset = await uploadMenuImage(
        file,
        { title: itemName.trim() || 'Menu photo', altText: itemName.trim() || undefined },
        tenantId,
      );
      // It's in Media's "Menu" folder too, for anyone with Website content on.
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.cms.key('assets') });
      return asset.url;
    },
    onSuccess: (url) => {
      setBroken(false);
      setLinking(false);
      onChange(url);
    },
    onError: (err) => toast('error', err instanceof Error && err.message ? err.message : 'The photo wasn’t uploaded. Try again.'),
  });

  const pick = (files: FileList | null | undefined) => {
    const file = [...(files ?? [])].find((entry) => entry.type.startsWith('image/'));
    if (file) upload.mutate(file);
  };
  const src = value.trim() && !broken ? proxiedImage(value.trim()) : null;

  const stacked = layout === 'stacked';
  const dropProps = {
    onDragOver: (event: React.DragEvent) => {
      if (!canUpload) return;
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event: React.DragEvent) => {
      if (!canUpload) return;
      event.preventDefault();
      setDragging(false);
      pick(event.dataTransfer.files);
    },
  };
  const picture = upload.isPending ? (
    <Loader2 size={20} className="animate-spin" aria-label="Uploading" />
  ) : src ? (
    // eslint-disable-next-line @next/next/no-img-element -- tenant media or a merchant's own image host
    <img src={src} alt="" onError={() => setBroken(true)} className={cn('size-full object-cover', stacked && 'absolute inset-0')} />
  ) : (
    <ImageIcon size={22} aria-hidden="true" />
  );
  const buttons = (
    <div className={cn('flex flex-wrap gap-2', !stacked && 'mt-2')}>
      {canUpload && (
        <Button type="button" size="sm" variant="outline" disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
          <UploadCloud aria-hidden="true" /> {value ? 'Replace' : 'Upload'}
        </Button>
      )}
      {canUpload && !showLink && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setLinking(true)}>
          <Link2 aria-hidden="true" /> Use a link
        </Button>
      )}
      {value && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-exception"
          disabled={upload.isPending}
          onClick={() => {
            onChange('');
            setBroken(false);
          }}
        >
          <Trash2 aria-hidden="true" /> Remove
        </Button>
      )}
    </div>
  );
  // The section is already titled Photo — only a state worth saying gets a line.
  const state = (upload.isPending || !value || broken) && (
    <p className="text-sm font-semibold text-foreground">
      {upload.isPending ? 'Uploading…' : broken ? 'That image didn’t load' : 'No photo yet'}
    </p>
  );
  const hint = (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {canUpload ? 'Drag a photo here, or upload one.' : 'Paste a link to a photo hosted elsewhere.'}
    </p>
  );
  const fileField = (
    <input
      ref={fileInput}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(event) => {
        pick(event.target.files);
        event.target.value = '';
      }}
    />
  );

  return (
    <div className="space-y-3">
      {stacked ? (
        <>
          <div
            className={cn(
              'relative flex aspect-4/3 flex-col items-center justify-center gap-1 overflow-hidden rounded-md border text-center text-muted-foreground transition-colors',
              dragging
                ? 'border-dashed border-primary bg-primary/5'
                : src
                  ? 'border-border bg-band'
                  : 'border-dashed border-edge bg-band/40',
            )}
            {...dropProps}
          >
            {picture}
            {!src && !upload.isPending && (
              <div className="px-4">
                {state}
                {hint}
              </div>
            )}
          </div>
          {buttons}
          {fileField}
        </>
      ) : (
        <div
          className={cn(
            'flex items-center gap-4 rounded-lg border border-dashed p-3 transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-edge',
          )}
          {...dropProps}
        >
          <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-band text-muted-foreground">
            {picture}
          </span>
          <div className="min-w-0 flex-1">
            {state}
            {hint}
            {buttons}
          </div>
          {fileField}
        </div>
      )}
      {showLink && (
        <Input
          value={isUploaded ? '' : value}
          onChange={(event) => {
            onChange(event.target.value);
            setBroken(false);
          }}
          placeholder="https://…"
          aria-label="Image link"
          leftIcon={<Link2 size={14} />}
          error={error ?? (broken && value.trim() ? 'That link didn’t load as an image.' : undefined)}
        />
      )}
    </div>
  );
}
