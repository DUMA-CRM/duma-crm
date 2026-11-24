'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';

import { canEncode, encodeImage } from '@/components/cms/imageEncode';
import { TEXTAREA_CLASS } from '@/components/cms/shared';
import { ImagePlus, Loader2, X } from '@/components/icons';
import { FormSection, ModalActions } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';

import {
  type ListingImage, type PublisherApp, listingImageUrl, marketplaceRootKey, publisherKey, reviewKey, saveListing,
} from '@/lib/api/marketplace.service';
import { toast } from '@/lib/toast';
import { publisherListingDefaults } from '@/lib/utils/marketplace';
import { cn } from '@/lib/utils/cn';

import { PublisherDocumentFields, publisherDocumentsFromForm } from './PublisherDocumentFields';
import { builtinAppIcon } from './app-appearance';
import { ListingImageView } from './ListingMedia';

const formats = ['image/png', 'image/jpeg', 'image/webp'];

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

/** One image slot: the picture (or an add tile) as the file button, a remove button over it. */
function ImageSlot({ appId, label, image, icon = false, fallback, onChange, onBusy }: {
  appId: string;
  label: string;
  image: ListingImage | null;
  icon?: boolean;
  fallback?: string;
  onChange: (value: ListingImage | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const src = image ? ('id' in image ? listingImageUrl(appId, image.id) : `data:${image.mimeType};base64,${image.data}`) : fallback;
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
    <div className="min-w-0 space-y-1.5">
      <div className={cn('group relative', icon ? 'size-24' : 'aspect-video w-full')}>
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          aria-label={src ? `Replace ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
          className={cn(
            'grid size-full place-items-center overflow-hidden border transition-colors focus-visible:outline-2 focus-visible:outline-ring',
            icon ? 'rounded-2xl' : 'rounded-lg',
            src ? 'border-border bg-band' : 'border-dashed border-rule/60 bg-band/30 text-muted-foreground hover:border-rule hover:bg-band/60',
          )}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin text-muted-foreground" aria-hidden="true" />
          ) : src ? (
            <ListingImageView src={src} alt="" className={cn('size-full', icon ? 'object-cover' : 'object-contain')} />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs font-medium">
              <ImagePlus size={18} aria-hidden="true" />
              {icon ? 'Icon' : 'Add'}
            </span>
          )}
        </button>
        {image && !busy && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Remove ${label.toLowerCase()}`}
            className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-md border border-border bg-card/90 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-exception focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:opacity-100"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
        <input
          ref={input}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          accept={formats.join(',')}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void pick(file);
          }}
        />
      </div>
      {error && <p role="alert" className="text-xs text-exception">{error}</p>}
    </div>
  );
}

export function ListingEditor({ app, publisher, admin = false, onClose }: {
  app: PublisherApp;
  publisher: string;
  admin?: boolean;
  onClose: () => void;
}) {
  const formId = useId();
  const query = useQueryClient();
  const [current] = useState(app.storeListing);
  const [initial] = useState(() => publisherListingDefaults(app));
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
        name: value('name'), description: value('description'), ...publisherDocumentsFromForm(data),
        icon, screenshots: screenshots.filter((image) => image !== null),
      }, admin);
    },
    onSuccess: () => {
      void query.invalidateQueries({ queryKey: publisherKey });
      void query.invalidateQueries({ queryKey: reviewKey });
      void query.invalidateQueries({ queryKey: marketplaceRootKey });
      toast('success', 'Listing saved.');
      onClose();
    },
  });
  return (
    <Modal
      title="Edit store listing"
      description={`${app.slug} · ${publisher}`}
      size="xl"
      onClose={() => { if (!save.isPending) onClose(); }}
      footer={(
        <ModalActions form={formId} submitLabel="Save listing" pendingLabel="Saving…" pending={save.isPending}
          disabled={processing > 0} onCancel={onClose} />
      )}
    >
      <form id={formId} className="space-y-5" onSubmit={(event) => {
        event.preventDefault();
        if (!processing && !save.isPending) save.mutate(new FormData(event.currentTarget));
      }}>
        <FormSection title="Listing" framed={false} note={!current && !app.releases.length
          ? 'Add a description and either link to your support and privacy pages or write them here. You can save the listing before submitting your first release.'
          : undefined}>
          <div className="flex items-start gap-4">
            <ImageSlot appId={app.id} label="App icon" icon image={icon} fallback={builtinAppIcon(initial.builtin)} onChange={setIcon} onBusy={setBusy} />
            <div className="min-w-0 flex-1">
              <Input label="App name" name="name" required minLength={2} maxLength={120} defaultValue={initial.name} />
            </div>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`${formId}-description`} required>Description</FieldLabel>
            <textarea id={`${formId}-description`} className={TEXTAREA_CLASS} name="description" required rows={5} minLength={10} maxLength={2000}
              defaultValue={initial.description} />
          </div>
          <PublisherDocumentFields initial={initial} />
        </FormSection>
        <FormSection title="Screenshots" framed={false} note="Up to four, 16:9 works best. Images are compressed in your browser before upload.">
          <div className="grid grid-cols-2 gap-3">
            {screenshots.map((image, index) => (
              <ImageSlot key={index} appId={app.id} label={`Screenshot ${index + 1}`} image={image} onBusy={setBusy}
                onChange={(next) => setScreenshots((images) => images.map((entry, position) => position === index ? next : entry))} />
            ))}
          </div>
        </FormSection>
        {save.error && <p role="alert" className="text-sm text-exception">{save.error.message}</p>}
      </form>
    </Modal>
  );
}
