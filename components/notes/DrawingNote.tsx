'use client';

import { CaptureUpdateAction, Excalidraw, convertToExcalidrawElements, getSceneVersion, restoreElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useTheme } from 'next-themes';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { MediaPicker } from '@/components/cms/MediaPicker';
import { assetSrc } from '@/components/cms/shared';
import { ImageIcon, ImagePlus, UploadCloud } from '@/components/icons';
import { MenuOption } from '@/components/shared/MenuOption';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { toast } from '@/lib/toast';
import {
  APP_BACKGROUND,
  type DrawingFile,
  UNTITLED_DRAWING,
  drawingNoteSnapshot,
  followsApp,
  parseDrawingNote,
} from '@/lib/utils/note-drawing';
import { noteMediaKind } from '@/lib/utils/note-editor';
import { useAuthStore } from '@/stores/authStore';

import type { EditorSnapshot } from './RichNoteEditor';
import './excalidrawAssets';

type Api = NonNullable<Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>['onExcalidrawAPI']>>[0]>;
type Element = Record<string, unknown>;

/** How big a photo or video lands on the canvas, at most, in screen pixels. */
const PLACED_SIZE = 480;

/** A video on the canvas is an embed of a file on this origin (Content, through `/be`); nothing else may be embedded. */
const isOwnMedia = (link: string) => link.startsWith('/') && !link.startsWith('//');

/** A photo pasted or dropped on the canvas arrives as a data URL; it is uploaded from that. */
function dataUrlToFile(dataURL: string, mimeType: string, name: string): File {
  const base64 = dataURL.slice(dataURL.indexOf(',') + 1);
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new File([bytes], `${name}.${mimeType.split('/')[1]?.replace('+xml', '') ?? 'png'}`, { type: mimeType });
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 400, height: image.naturalHeight || 300 });
    image.onerror = () => resolve({ width: 400, height: 300 });
    image.src = src;
  });
}

/**
 * A drawing note: the whole note is an Excalidraw canvas, full pane, saved as
 * you draw through the same loop as a text note. Photos — from Content, from
 * this device, or pasted and dropped on the canvas — are kept as files in
 * Content (or note storage) and the drawing holds only their URLs. A video is a
 * Content file, embedded and played in place. Loaded only when a drawing note
 * is opened: Excalidraw is large.
 */
export default function DrawingNote({
  content,
  editable,
  onChange,
  upload,
  uploadVideo,
  bar,
}: {
  content: Record<string, unknown>;
  editable: boolean;
  onChange: (snapshot: EditorSnapshot) => void;
  /** Saves a photo; resolves to its URL. Content when it's on, else note storage. */
  upload: (file: File) => Promise<string>;
  /** Saves a video into Content; null when that isn't possible. */
  uploadVideo: ((file: File) => Promise<string>) | null;
  /** The note's own bar (beside Saved and the pin): the title and "Photo or video" go there, in one row. */
  bar: HTMLElement | null;
}) {
  const { resolvedTheme } = useTheme();
  const capabilities = useAuthStore((store) => store.capabilities);
  const { contentEnabled } = useCatalogWords();
  // Content's media library: the module on, and Media readable (`cms:read`, as the API checks).
  const canUseContent = contentEnabled && hasCapability(capabilities, 'cms:read');
  const fileInputId = useId();

  // The canvas takes the drawing once, as it was opened; after that it holds it.
  const [initial] = useState(() => parseDrawingNote(content));
  const apiRef = useRef<Api>(null);
  const [title, setTitle] = useState(initial.title);
  const titleRef = useRef(initial.title);
  // Every photo's file, by the id the canvas knows it by.
  const files = useRef<Record<string, DrawingFile>>({ ...initial.files });
  // Photos pasted onto the canvas, being (or already) uploaded — each once.
  const uploading = useRef(new Set<string>());
  // The scene version last saved; null until the canvas reports the scene as it loaded.
  const lastScene = useRef<string | null>(null);
  const warnedTooBig = useRef(false);
  const [picking, setPicking] = useState(false);

  const save = () => {
    const api = apiRef.current;
    if (!api || !editable) return;
    const snapshot = drawingNoteSnapshot({
      title: titleRef.current,
      elements: api.getSceneElements() as unknown as Element[],
      background: api.getAppState().viewBackgroundColor,
      files: files.current,
    });
    if (!snapshot) {
      if (!warnedTooBig.current) toast('error', 'This drawing is too big to keep in a note — try splitting it.');
      warnedTooBig.current = true;
      return;
    }
    warnedTooBig.current = false;
    onChange(snapshot);
  };

  // A pasted or dropped photo lives in the canvas as bytes: upload it, then save its URL instead.
  const uploadPasted = (canvasFiles: Record<string, { id: string; mimeType: string; dataURL: string }>) => {
    for (const file of Object.values(canvasFiles)) {
      if (files.current[file.id] || uploading.current.has(file.id) || !file.dataURL.startsWith('data:')) continue;
      uploading.current.add(file.id);
      void upload(dataUrlToFile(file.dataURL, file.mimeType, 'drawing-photo'))
        .then((url) => {
          files.current[file.id] = { mimeType: file.mimeType, url };
          save();
        })
        // The upload has already said why; the photo stays on screen but isn't kept.
        .catch(() => undefined);
    }
  };

  /** Where something added lands: the middle of what's on screen, a little apart for each of several. */
  const placeAt = (index: number, width: number, height: number) => {
    const state = apiRef.current!.getAppState();
    const zoom = state.zoom.value;
    return {
      x: -state.scrollX + state.width / 2 / zoom - width / 2 + index * 24,
      y: -state.scrollY + state.height / 2 / zoom - height / 2 + index * 24,
    };
  };
  const addElements = (added: readonly unknown[]) => {
    const api = apiRef.current!;
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), ...(added as ReturnType<Api['getSceneElements']>)],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const addPhoto = async (url: string, mimeType: string, index = 0) => {
    const api = apiRef.current;
    if (!api) return;
    const id = crypto.randomUUID();
    files.current[id] = { mimeType, url };
    api.addFiles([{ id, mimeType, dataURL: url, created: Date.now() } as never]);
    const natural = await imageSize(url);
    const scale = Math.min(1, PLACED_SIZE / api.getAppState().zoom.value / Math.max(natural.width, natural.height));
    const width = natural.width * scale;
    const height = natural.height * scale;
    addElements(
      convertToExcalidrawElements([
        { type: 'image', fileId: id as never, status: 'saved', ...placeAt(index, width, height), width, height },
      ]),
    );
  };

  const addVideo = (url: string, index = 0) => {
    if (!apiRef.current) return;
    const width = PLACED_SIZE / apiRef.current.getAppState().zoom.value;
    const height = (width * 9) / 16;
    // Excalidraw makes no embeds from a sketch; an embed is a rectangle with a link.
    const [frame] = convertToExcalidrawElements([{ type: 'rectangle', ...placeAt(index, width, height), width, height }]);
    addElements(restoreElements([{ ...frame, type: 'embeddable', link: url } as never], null));
  };

  const addFromDevice = (picked: File[]) => {
    picked.forEach((file, index) => {
      const video = file.type.startsWith('video/');
      const send = video ? uploadVideo : file.type.startsWith('image/') ? upload : null;
      if (!send) return;
      void send(file)
        .then((url) => (video ? addVideo(url, index) : addPhoto(url, file.type, index)))
        .catch(() => undefined);
    });
  };

  const accept = `image/png,image/jpeg,image/webp,image/gif${uploadVideo ? ',video/mp4,video/webm,video/quicktime' : ''}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {bar &&
        createPortal(
          <>
            <input
              aria-label="Drawing title"
              placeholder={UNTITLED_DRAWING}
              value={title}
              readOnly={!editable}
              maxLength={300}
              onChange={(event) => {
                setTitle(event.target.value);
                titleRef.current = event.target.value;
                save();
              }}
              className="h-8 min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 text-sm font-semibold text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/70 hover:bg-band/50 focus-visible:bg-band/50 read-only:hover:bg-transparent"
            />
            {editable && (
              <Popover>
                <Tooltip side="bottom" align="end" label="Add a photo or video">
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="shrink-0 gap-1.5">
                      <ImagePlus aria-hidden="true" />
                      <span className="hidden md:inline">Photo or video</span>
                    </Button>
                  </PopoverTrigger>
                </Tooltip>
                <PopoverContent align="end" className="w-64 p-1">
                  <MenuOption
                    icon={UploadCloud}
                    label="Upload from this device"
                    hint={uploadVideo ? 'Compressed, saved to Content → Media, in Drawings' : 'Photos only, compressed'}
                    onSelect={() => document.getElementById(fileInputId)?.click()}
                  />
                  {canUseContent && (
                    <MenuOption
                      icon={ImageIcon}
                      label="From Content"
                      hint="Photos and videos in your media library"
                      onSelect={() => setPicking(true)}
                    />
                  )}
                </PopoverContent>
              </Popover>
            )}
          </>,
          bar,
        )}

      {/* Behind a transparent canvas: the app's background, so an uncoloured drawing follows the theme. */}
      <div className="relative min-h-0 flex-1 bg-background">
        <div className="absolute inset-0">
          <Excalidraw
            initialData={{
              elements: initial.elements as never,
              appState: { viewBackgroundColor: initial.background },
              files: Object.fromEntries(
                Object.entries(initial.files).map(([id, file]) => [id, { id, mimeType: file.mimeType, dataURL: file.url, created: 0 }]),
              ) as never,
              scrollToContent: true,
            }}
            onExcalidrawAPI={(api) => {
              apiRef.current = api;
            }}
            onChange={(elements, appState, canvasFiles) => {
              // White — Excalidraw's default, and what clearing the canvas sets — means the app's own background.
              if (appState.viewBackgroundColor !== APP_BACKGROUND && followsApp(appState.viewBackgroundColor)) {
                apiRef.current?.updateScene({
                  appState: { viewBackgroundColor: APP_BACKGROUND },
                  captureUpdate: CaptureUpdateAction.NEVER,
                });
                return;
              }
              if (!editable) return;
              uploadPasted(canvasFiles as never);
              // Excalidraw reports every pointer move; only a changed scene is saved.
              const scene = `${getSceneVersion(elements)}:${appState.viewBackgroundColor}`;
              if (lastScene.current === null || lastScene.current === scene) {
                lastScene.current = scene;
                return;
              }
              lastScene.current = scene;
              save();
            }}
            viewModeEnabled={!editable}
            theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            validateEmbeddable={isOwnMedia}
            renderEmbeddable={(element) =>
              element.link && isOwnMedia(element.link) ? (
                <video src={element.link} controls preload="metadata" playsInline className="size-full bg-black object-contain" />
              ) : null
            }
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                export: false,
                saveAsImage: true,
                toggleTheme: false,
                changeViewBackgroundColor: true,
                clearCanvas: true,
              },
            }}
          />
        </div>
      </div>

      <input
        id={fileInputId}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(event) => {
          addFromDevice([...(event.target.files ?? [])]);
          event.currentTarget.value = '';
        }}
      />
      {picking && (
        <MediaPicker
          multiple
          groups={['image', 'video']}
          onClose={() => setPicking(false)}
          onPick={(_, assets) => {
            setPicking(false);
            // The keyless delivery URL through /be: a note shared with someone
            // who can't open Content still shows it (UI-ADR-031).
            assets.forEach((asset, index) => {
              const kind = noteMediaKind(asset.mimeType);
              if (kind === 'image') void addPhoto(assetSrc(asset.url), asset.mimeType, index);
              else if (kind === 'video') addVideo(assetSrc(asset.url), index);
            });
          }}
        />
      )}
    </div>
  );
}
