'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { canEncode, encodeImage } from '@/components/cms/imageEncode';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/toast';
import { type ListingImage, type PublisherApp, listingImageUrl, saveListing } from '@/lib/api/marketplace.service';

import { ListingImageView } from './ListingMedia';

const formats = ['image/png', 'image/jpeg', 'image/webp'];
const field = 'block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring';

async function prepareImage(file: File, icon: boolean): Promise<ListingImage> {
  if (!formats.includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Choose an image under 12 MB.');
  const limit = (icon ? 96 : 150) * 1024;
  const format = await canEncode('image/webp') ? 'image/webp' : 'image/jpeg';
  for (const maxWidth of icon ? [400, 256] : [1400, 1000, 720]) {
    const result = await encodeImage(file, { format, quality: 0.82, maxWidth });
    if (result.file.size > limit || result.width > 2400 || result.height > 2400 || !formats.includes(result.file.type)) continue;
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]!);
      reader.onerror = () => reject(new Error('The image could not be read.'));
      reader.readAsDataURL(result.file);
    });
    return { mimeType: result.file.type, data };
  }
  throw new Error('The image could not be compressed enough. Try a smaller image.');
}

function ImageField({ appId, label, image, icon = false, onChange, onBusy }: {
  appId: string;
  label: string;
  image: ListingImage | null;
  icon?: boolean;
  onChange: (value: ListingImage | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const src = image ? ('id' in image ? listingImageUrl(appId, image.id) : `data:${image.mimeType};base64,${image.data}`) : null;
  async function pick(file: File) {
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      onChange(await prepareImage(file, icon));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'The image could not be prepared.');
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      {src && <ListingImageView src={src} alt={label}
        className={icon ? 'size-20 rounded-xl object-cover' : 'aspect-video w-full rounded-md bg-band object-contain'} />}
      <label className="block space-y-1 text-sm font-medium">{label}
        <Input type="file" accept={formats.join(',')} disabled={busy} onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void pick(file);
        }} />
      </label>
      {busy && <p role="status" className="text-xs text-muted-foreground">Preparing image…</p>}
      {src && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>Remove {label.toLowerCase()}</Button>}
      {error && <p role="alert" className="text-sm text-exception">{error}</p>}
    </div>
  );
}

export function ListingEditor({ app, publisher, admin = false, onClose }: {
  app: PublisherApp;
  publisher: string;
  admin?: boolean;
  onClose: () => void;
}) {
  const query = useQueryClient();
  const [current] = useState(app.storeListing);
  const [initial] = useState(() => current ?? (app.releases.find((release) => release.status === 'published') ?? app.releases[0])?.manifest);
  const [icon, setIcon] = useState<ListingImage | null>(current?.icon ? { id: current.icon } : null);
  const [screenshots, setScreenshots] = useState<(ListingImage | null)[]>(() =>
    Array.from({ length: 4 }, (_, index) => {
      const id = current?.screenshots[index];
      return id ? { id } : null;
    }));
  const [processing, setProcessing] = useState(0);
  function setBusy(busy: boolean) {
    setProcessing((count) => count + (busy ? 1 : -1));
  }
  const save = useMutation({
    mutationFn: (data: FormData) => {
      const value = (key: string) => String(data.get(key) ?? '').trim();
      return saveListing(app.id, {
        expectedRevision: current?.revision ?? 0,
        name: value('name'), description: value('description'), supportUrl: value('supportUrl'), privacyUrl: value('privacyUrl'),
        icon, screenshots: screenshots.filter((image) => image !== null),
      }, admin);
    },
    onSuccess: () => {
      void query.invalidateQueries({ queryKey: ['app-publisher'] });
      void query.invalidateQueries({ queryKey: ['marketplace-review'] });
      void query.invalidateQueries({ queryKey: ['organization', 'marketplace'] });
      toast('success', 'Listing saved.');
      onClose();
    },
  });
  return (
    <Modal title="Edit App Store listing" description={`Published by ${publisher}`} size="xl"
      onClose={() => { if (!save.isPending) onClose(); }}>
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (!processing && !save.isPending) save.mutate(new FormData(event.currentTarget));
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2">App name<Input name="name" required minLength={2} maxLength={120} defaultValue={initial?.name} /></label>
          <label className="space-y-1 text-sm">Support URL<Input name="supportUrl" type="url" required defaultValue={initial?.supportUrl} /></label>
          <label className="space-y-1 text-sm">Privacy policy URL<Input name="privacyUrl" type="url" required defaultValue={initial?.privacyUrl} /></label>
        </div>
        <label className="block space-y-1 text-sm">Description
          <textarea className={field} name="description" required rows={4} minLength={10} maxLength={2000} defaultValue={initial?.description} />
        </label>
        <ImageField appId={app.id} label="App icon" icon image={icon} onChange={setIcon} onBusy={setBusy} />
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">Screenshots (up to 4)</legend>
          {screenshots.map((image, index) => (
            <ImageField key={index} appId={app.id} label={`Screenshot ${index + 1}`} image={image} onBusy={setBusy}
              onChange={(next) => setScreenshots((images) => images.map((entry, position) => position === index ? next : entry))} />
          ))}
        </fieldset>
        {save.error && <p role="alert" className="text-sm text-exception">{save.error.message}</p>}
        <Button disabled={save.isPending || processing > 0}>{save.isPending ? 'Saving…' : 'Save listing'}</Button>
      </form>
    </Modal>
  );
}
