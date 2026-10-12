'use client';

import { Excalidraw, exportToBlob, getNonDeletedElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Loader2, PenLine } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { type DrawingScene, emptyDrawing, parseDrawing } from '@/lib/utils/note-drawing';

import './excalidrawAssets';

type Api = Parameters<NonNullable<React.ComponentProps<typeof Excalidraw>['onExcalidrawAPI']>>[0];

/**
 * A drawing, full screen, in Excalidraw. Done hands back the scene (to keep in
 * the note) and a PNG of it (for the note to show); Cancel leaves the note as
 * it was. Images can't be pasted in — they would bloat the note — so the
 * image tool is off. Loaded only when a drawing is opened: Excalidraw is large.
 */
export default function DrawingEditor({
  scene,
  onDone,
  onCancel,
}: {
  scene: string | null;
  onDone: (result: { scene: DrawingScene; png: Blob } | null) => Promise<void> | void;
  onCancel: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const apiRef = useRef<Api>(null);
  const [saving, setSaving] = useState(false);
  const initial = parseDrawing(scene) ?? emptyDrawing();

  // Esc belongs to Excalidraw (it deselects); the page behind shouldn't scroll.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const done = async () => {
    const api = apiRef.current;
    if (!api) return;
    setSaving(true);
    try {
      const elements = getNonDeletedElements(api.getSceneElements());
      if (elements.length === 0) {
        await onDone(null);
        return;
      }
      const appState = api.getAppState();
      const background = appState.viewBackgroundColor;
      const png = await exportToBlob({
        elements,
        appState: { exportBackground: true, viewBackgroundColor: background, exportWithDarkMode: false },
        files: null,
        mimeType: 'image/png',
        exportPadding: 16,
        // Sharp on a retina screen, without a giant file for a big canvas.
        getDimensions: (width: number, height: number) => {
          const scale = Math.min(2, 2400 / Math.max(width, height, 1));
          return { width: width * scale, height: height * scale, scale };
        },
      });
      await onDone({ scene: { elements: elements as unknown as DrawingScene['elements'], background }, png });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Drawing" className="fixed inset-0 z-200 flex flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-divider bg-card px-3">
        <PenLine size={17} className="text-muted-foreground" aria-hidden="true" />
        <p className="flex-1 text-sm font-semibold text-foreground">Drawing</p>
        <Button variant="outline" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={saving} onClick={() => void done()}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Done'}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <Excalidraw
          initialData={{ elements: initial.elements as never, appState: { viewBackgroundColor: initial.background } }}
          onExcalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false,
              saveAsImage: false,
              toggleTheme: false,
              changeViewBackgroundColor: true,
              clearCanvas: true,
            },
            tools: { image: false },
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
