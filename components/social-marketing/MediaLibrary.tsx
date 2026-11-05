'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRef, useState } from 'react';

import { ImageOptionsDialog } from '@/components/cms/ImageOptionsDialog';
import { VideoOptionsDialog } from '@/components/cms/VideoOptionsDialog';
import { RowWarning } from '@/components/cms/rows';
import { Check, ImageIcon, Loader2, Play, UploadCloud } from '@/components/icons';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { type Asset, assetSrc, getAssets, marketingKey, uploadAsset } from '@/lib/modules/marketing/client';
import { cn } from '@/lib/utils/cn';
import { isConvertibleImage, isConvertibleVideo } from '@/lib/utils/media-storage';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Kind = 'all' | 'image' | 'video';
const KINDS: { value: Kind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
];
const sizeLabel = (bytes: number) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * The workspace's media: a drop zone to upload a new file (which is picked as
 * soon as it lands), then everything already uploaded as thumbnails. Picking
 * one closes the library; files already on the destination carry a tick.
 */
export function MediaLibrary({
  onPick,
  onClose,
  selectedIds = [],
}: {
  onPick: (asset: Asset) => void;
  onClose: () => void;
  /** Files already on the destination, ticked. */
  selectedIds?: string[];
}) {
  const tenantId = useWorkspaceStore((s) => s.tenantId),
    client = useQueryClient();
  const [page, setPage] = useState(1),
    [kind, setKind] = useState<Kind>('all'),
    [dragging, setDragging] = useState(false),
    [uploading, setUploading] = useState<string | null>(null),
    // A picked file waits here while it's cropped, converted or compressed, as on the Content page.
    [staged, setStaged] = useState<{ file: File; kind: 'image' | 'video' } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const q = useQuery({ queryKey: marketingKey(tenantId, 'assets', page), queryFn: () => getAssets(page) });
  const upload = useMutation({
    mutationFn: uploadAsset,
    onSuccess: (a) => {
      void client.invalidateQueries({ queryKey: marketingKey(tenantId, 'assets') });
      onPick(a);
      onClose();
    },
    onSettled: () => setUploading(null),
  });
  const send = (file?: File) => {
    if (!file || upload.isPending) return;
    setUploading(file.name);
    upload.mutate(file);
  };
  /** A picked or dropped file: images and videos get the Content page's options first; anything else goes straight up. */
  const stage = (file?: File) => {
    if (!file || upload.isPending) return;
    if (isConvertibleImage(file.type)) setStaged({ file, kind: 'image' });
    else if (isConvertibleVideo(file.type)) setStaged({ file, kind: 'video' });
    else send(file);
  };
  const afterOptions = (files: File[]) => {
    setStaged(null);
    send(files[0]);
  };
  const shown = (q.data?.data ?? []).filter((a) => kind === 'all' || a.mimeType.startsWith(kind + '/'));

  return (
    <>
      <Modal title="Choose media" description="Upload something new, or pick from what’s already uploaded." size="xl" onClose={onClose}>
        <div className="space-y-5">
          <button
            type="button"
            disabled={upload.isPending}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              stage(e.dataTransfer.files[0]);
            }}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-progress',
              dragging ? 'border-primary bg-primary/5' : 'border-rule bg-field hover:border-primary/60 hover:bg-band/30',
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              {upload.isPending ? (
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              ) : (
                <UploadCloud size={20} aria-hidden="true" />
              )}
            </span>
            {upload.isPending ? (
              <span role="status" className="text-sm font-semibold text-foreground">
                Uploading {uploading}…
              </span>
            ) : (
              <>
                <span className="text-sm font-semibold text-foreground">
                  {dragging ? 'Drop to upload' : 'Drop an image or video here, or click to browse'}
                </span>
                <span className="text-xs text-muted-foreground">
                  Up to 25 MB. Crop, convert or compress it before it uploads; it’s added to this post when it lands.
                </span>
              </>
            )}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*,video/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              stage(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {upload.error && <RowWarning>{upload.error.message}</RowWarning>}

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Your media</h3>
              <div role="group" aria-label="Show" className="flex gap-1">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    aria-pressed={kind === k.value}
                    onClick={() => setKind(k.value)}
                    className={cn(
                      'h-8 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                      kind === k.value
                        ? 'border-primary bg-primary/5 text-foreground shadow-[inset_0_0_0_1px_var(--primary)]'
                        : 'border-rule/70 bg-field text-muted-foreground hover:bg-band/45 hover:text-foreground',
                    )}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            {q.isPending ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <Bone key={i} className="aspect-square w-full rounded-md" />
                ))}
              </div>
            ) : q.error ? (
              <ErrorState title="Couldn’t load your media" onRetry={() => void q.refetch()} />
            ) : shown.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg bg-band/40 px-4 py-8 text-center">
                <ImageIcon size={20} className="text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {q.data.data.length
                    ? `No ${kind === 'image' ? 'images' : 'videos'} on this page.`
                    : 'Nothing uploaded yet. Files you upload here can be reused on any post.'}
                </p>
              </div>
            ) : (
              <div className="grid max-h-[26rem] grid-cols-2 gap-3 overflow-y-auto p-0.5 sm:grid-cols-4">
                {shown.map((a) => {
                  const picked = selectedIds.includes(a.id);
                  const video = a.mimeType.startsWith('video/');
                  return (
                    <button
                      key={a.id}
                      type="button"
                      title={a.fileName}
                      aria-pressed={picked}
                      onClick={() => {
                        onPick(a);
                        onClose();
                      }}
                      className={cn(
                        'group min-w-0 rounded-lg border bg-field p-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        picked ? 'border-primary shadow-[inset_0_0_0_1px_var(--primary)]' : 'border-rule/60 hover:border-primary/60',
                      )}
                    >
                      <span className="relative block aspect-square overflow-hidden rounded-md bg-band/50">
                        {video ? (
                          <video src={assetSrc(a)} preload="metadata" muted className="size-full object-cover" />
                        ) : (
                          <Image
                            unoptimized
                            width={240}
                            height={240}
                            src={assetSrc(a)}
                            alt={a.fileName}
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        )}
                        {video && (
                          <span className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
                            <Play size={12} aria-hidden="true" />
                          </span>
                        )}
                        {picked && (
                          <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check size={13} aria-label="Already added" />
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 block truncate px-0.5 text-xs font-medium text-foreground">{a.fileName}</span>
                      <span className="block px-0.5 text-[11px] text-muted-foreground">
                        {video ? 'Video' : 'Image'} · {sizeLabel(a.sizeBytes)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {(page > 1 || q.data?.hasMore) && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" className="h-9" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">Page {page}</span>
              <Button variant="outline" className="h-9" disabled={!q.data?.hasMore} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      </Modal>
      {staged?.kind === 'image' && (
        <ImageOptionsDialog
          files={[staged.file]}
          mode="upload"
          freeBytes={null}
          isPending={upload.isPending}
          onConfirm={afterOptions}
          onClose={() => setStaged(null)}
        />
      )}
      {staged?.kind === 'video' && (
        <VideoOptionsDialog
          files={[staged.file]}
          mode="upload"
          freeBytes={null}
          isPending={upload.isPending}
          onConfirm={afterOptions}
          onClose={() => setStaged(null)}
        />
      )}
    </>
  );
}
