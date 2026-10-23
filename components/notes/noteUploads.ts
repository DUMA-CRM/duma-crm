'use client';

import { useQueryClient } from '@tanstack/react-query';

import { encodeImage } from '@/components/cms/imageEncode';
import { createRenditions } from '@/components/cms/renditions';
import { assetSrc, invalidateCms } from '@/components/cms/shared';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { uploadCmsAsset } from '@/lib/modules/cms/client';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Where a photo or video put in a note goes. A text note's photos go to
// Content's "Notes" folder; a drawing's to "Drawings", compressed harder.

/** Which kind of note a file is for: it decides the format and the Content folder. */
type Place = 'note' | 'drawing';

const FOLDER: Record<Place, string> = { note: 'Notes', drawing: 'Drawings' };

/**
 * Re-encoded in the browser first, as every image in DUMA is (UI-ADR-024).
 * A text note's photos stay PNG or JPEG rather than WebP: the note can be
 * synced to Google Docs, which imports only PNG, JPEG and GIF — anything else
 * becomes a JPEG. A drawing's photos become WebP, at most 1600px: they are only
 * ever seen on its canvas, and a pasted screenshot is otherwise a large PNG.
 * WebP keeps a screenshot's transparency. If re-encoding would make a file
 * bigger, the original is kept. GIFs (which may move) and videos go as they are.
 */
async function optimised(file: File, place: Place): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  const options =
    place === 'drawing'
      ? ({ format: 'image/webp', quality: 0.8, maxWidth: 1600 } as const)
      : ({
          format: file.type === 'image/png' || file.type === 'image/jpeg' ? 'original' : 'image/jpeg',
          quality: 0.85,
          maxWidth: 2000,
        } as const);
  // A browser that can't write WebP (older Safari) still resizes and recompresses, in the file's own format.
  const encoded = await encodeImage(file, options)
    .catch(() => encodeImage(file, { ...options, format: 'original' }))
    .catch(() => null);
  return encoded?.file ?? file;
}

/**
 * Where a photo from this device goes. With Content on and `cms:write`, into
 * Content's media library (folder "Notes", or "Drawings" for a drawing, with its smaller copies), so it can
 * be used anywhere afterwards; the note keeps the keyless delivery URL through
 * `/be`. Null otherwise — the toolbar then offers no upload, and a pasted
 * screenshot falls back to the note's own image store.
 */
export function useContentUpload(place: Place): ((file: File) => Promise<string>) | null {
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const { contentEnabled } = useCatalogWords();
  if (!contentEnabled || !hasCapability(capabilities, 'cms:write')) return null;
  return async (file) => {
    try {
      const upload = await optimised(file, place);
      const asset = await uploadCmsAsset(
        upload,
        { title: file.name.replace(/\.[^.]+$/, ''), folder: FOLDER[place] },
        tenantId ?? undefined,
      );
      if (asset.mimeType.startsWith('image/')) await createRenditions(asset, tenantId ?? undefined, upload).catch(() => 0);
      void invalidateCms(queryClient);
      return assetSrc(asset.url);
    } catch (error) {
      toast('error', error instanceof Error && error.message ? error.message : `${file.name} couldn’t be uploaded.`);
      throw error;
    }
  };
}

/** Without Content: into the notes' own image store. */
export const uploadNoteImage = (file: File) => uploadToNoteStore(file, 'note');
export const uploadDrawingImage = (file: File) => uploadToNoteStore(file, 'drawing');

async function uploadToNoteStore(file: File, place: Place): Promise<string> {
  const upload = await optimised(file, place);
  const response = await fetch(`/api/notes/images?filename=${encodeURIComponent(upload.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': upload.type },
    body: upload,
  });
  const result = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !result.url) {
    toast('error', result.error ?? 'The image couldn’t be added.');
    throw new Error(result.error ?? 'upload failed');
  }
  return result.url;
}
