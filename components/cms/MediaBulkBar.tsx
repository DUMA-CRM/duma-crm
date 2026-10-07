'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { FolderIcon, SlidersHorizontal, Tags, Trash2, X } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Modal } from '@/components/shared/Modal';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type CmsAsset, bulkCmsAssets, getCmsAssetFile, replaceCmsAssetFile } from '@/lib/modules/cms/client';
import { formatBytes } from '@/lib/utils/cms';
import { DEFAULT_IMAGE_OPTIONS, isConvertibleImage } from '@/lib/utils/media-storage';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { encodeImage } from './imageEncode';
import { invalidateCms } from './shared';

type Dialog = null | 'move' | 'tag' | 'delete' | { forceIds: string[]; message: string };

/**
 * What to do with the selected files. It floats at the foot of the media grid
 * while anything is selected — the selection is the context, so the actions
 * come to it rather than living in a toolbar that is usually irrelevant.
 */
export function MediaBulkBar({ selected, folders, onClear }: { selected: CmsAsset[]; folders: string[]; onClear: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [folder, setFolder] = useState('');
  const [tags, setTags] = useState('');
  const ids = selected.map((asset) => asset.id);
  const images = selected.filter((asset) => isConvertibleImage(asset.mimeType) && asset.mimeType !== 'image/webp');
  const selectedBytes = selected.reduce((sum, asset) => sum + asset.sizeBytes, 0);

  async function act(
    label: string,
    run: () => Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }>,
    done: (count: number) => string,
  ) {
    setBusy(label);
    try {
      const result = await run();
      invalidateCms(queryClient);
      if (result.succeeded.length > 0) toast('success', done(result.succeeded.length));
      setDialog(null);
      return result;
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'That didn’t work. Try again.');
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function remove(force: boolean, only = ids) {
    const result = await act(
      'delete',
      () => bulkCmsAssets({ action: 'delete', ids: only, force }, tenantId),
      (n) => `Deleted ${n} ${n === 1 ? 'file' : 'files'}.`,
    );
    if (!result) return;
    const inUse = result.failed.filter((failure) => failure.error.startsWith('Used by'));
    if (inUse.length > 0 && !force) {
      setDialog({
        forceIds: inUse.map((failure) => failure.id),
        message: `${inUse.length} ${inUse.length === 1 ? 'file is' : 'files are'} still used by entries. Deleting leaves those fields and images empty, and their URLs stop working.`,
      });
      return;
    }
    if (result.failed.length > 0) toast('error', `${result.failed.length} couldn’t be deleted.`);
    onClear();
  }

  /** Re-encode each image to WebP in the browser, replacing it only when that is smaller. */
  async function convert() {
    setBusy('convert');
    let replaced = 0;
    let saved = 0;
    try {
      for (const asset of images) {
        const blob = await getCmsAssetFile(asset.id, tenantId);
        const encoded = await encodeImage(new File([blob], asset.fileName, { type: asset.mimeType }), {
          ...DEFAULT_IMAGE_OPTIONS,
          format: 'image/webp',
        });
        if (!encoded.converted || encoded.file.size >= asset.sizeBytes) continue;
        await replaceCmsAssetFile(asset.id, encoded.file, tenantId);
        replaced += 1;
        saved += asset.sizeBytes - encoded.file.size;
      }
      invalidateCms(queryClient);
      toast(
        'success',
        replaced > 0
          ? `Converted ${replaced} ${replaced === 1 ? 'image' : 'images'} — ${formatBytes(saved)} saved.`
          : 'Those images are already as small as WebP makes them.',
      );
      onClear();
    } catch (error) {
      invalidateCms(queryClient);
      toast(
        'error',
        `${replaced > 0 ? `Converted ${replaced}, then stopped: ` : ''}${error instanceof Error ? error.message : 'conversion failed'}`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div
        role="region"
        aria-label="Selected files"
        className="sticky bottom-4 z-20 mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-rule bg-card px-3 py-2 shadow-lg"
      >
        <span className="mr-auto pl-1 text-sm">
          <span className="font-semibold tabular-nums text-foreground">{selected.length}</span>{' '}
          <span className="text-muted-foreground">selected · {formatBytes(selectedBytes)}</span>
        </span>
        <Button size="sm" variant="ghost" className="gap-1.5" disabled={!!busy} onClick={() => setDialog('move')}>
          <FolderIcon size={14} aria-hidden="true" /> Move
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5" disabled={!!busy} onClick={() => setDialog('tag')}>
          <Tags size={14} aria-hidden="true" /> Tag
        </Button>
        {images.length > 0 && (
          <Tooltip side="top" label="Re-encode to WebP; only files that get smaller are replaced">
            <Button size="sm" variant="ghost" className="gap-1.5" disabled={!!busy} onClick={() => void convert()}>
              <SlidersHorizontal size={14} aria-hidden="true" /> {busy === 'convert' ? 'Converting…' : `Convert ${images.length} to WebP`}
            </Button>
          </Tooltip>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-exception hover:text-exception"
          disabled={!!busy}
          onClick={() => setDialog('delete')}
        >
          <Trash2 size={14} aria-hidden="true" /> Delete
        </Button>
        <Button size="sm" variant="ghost" aria-label="Clear selection" disabled={!!busy} onClick={onClear}>
          <X size={14} aria-hidden="true" />
        </Button>
      </div>

      {dialog === 'move' && (
        <Modal
          title={`Move ${selected.length} ${selected.length === 1 ? 'file' : 'files'}`}
          description="Folders only organise the library — URLs don’t change."
          size="sm"
          onClose={() => setDialog(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                disabled={busy === 'move'}
                onClick={() =>
                  void act(
                    'move',
                    () => bulkCmsAssets({ action: 'move', ids, folder: folder.trim() || null }, tenantId),
                    (n) => `Moved ${n} ${n === 1 ? 'file' : 'files'}.`,
                  ).then((result) => result && onClear())
                }
              >
                {busy === 'move' ? 'Moving…' : folder.trim() ? `Move to ${folder.trim()}` : 'Remove from folder'}
              </Button>
            </div>
          }
        >
          <Input
            label="Folder"
            placeholder="No folder"
            list="cms-folders"
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            autoFocus
          />
          <datalist id="cms-folders">
            {folders.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Modal>
      )}

      {dialog === 'tag' && (
        <Modal
          title={`Tag ${selected.length} ${selected.length === 1 ? 'file' : 'files'}`}
          size="sm"
          onClose={() => setDialog(null)}
          footer={
            <div className="flex justify-between gap-2">
              <Button
                variant="ghost"
                disabled={!tags.trim() || !!busy}
                onClick={() =>
                  void act(
                    'tag',
                    () => bulkCmsAssets({ action: 'untag', ids, tags: splitTags(tags) }, tenantId),
                    (n) => `Removed tags from ${n}.`,
                  ).then((result) => result && onClear())
                }
              >
                Remove these tags
              </Button>
              <Button
                disabled={!tags.trim() || !!busy}
                onClick={() =>
                  void act(
                    'tag',
                    () => bulkCmsAssets({ action: 'tag', ids, tags: splitTags(tags) }, tenantId),
                    (n) => `Tagged ${n} ${n === 1 ? 'file' : 'files'}.`,
                  ).then((result) => result && onClear())
                }
              >
                Add tags
              </Button>
            </div>
          }
        >
          <Input label="Tags" hint="Comma separated" value={tags} onChange={(event) => setTags(event.target.value)} autoFocus />
        </Modal>
      )}

      {dialog === 'delete' && (
        <ConfirmModal
          title={`Delete ${selected.length} ${selected.length === 1 ? 'file' : 'files'}?`}
          message={`Frees ${formatBytes(selectedBytes)}. Files still used by entries are kept — you’ll be asked about those next. This cannot be undone.`}
          confirmLabel="Delete"
          isPending={busy === 'delete'}
          onConfirm={() => void remove(false)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog && typeof dialog === 'object' && (
        <ConfirmModal
          title="Some files are in use"
          message={dialog.message}
          confirmLabel="Delete anyway"
          isPending={busy === 'delete'}
          onConfirm={() => void remove(true, dialog.forceIds)}
          onClose={() => {
            setDialog(null);
            onClear();
          }}
        />
      )}
    </>
  );
}

const splitTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
