'use client';

import { Node, NodeViewWrapper, type ReactNodeViewProps, ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Loader2, PenLine, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { toast } from '@/lib/toast';
import { serializeDrawing } from '@/lib/utils/note-drawing';

// ---------------------------------------------------------------------------
// A drawing inside a text note, made in Excalidraw — how drawings were made
// before a drawing became a note of its own (`DrawingNote`). Nothing inserts
// one any more; this keeps the ones already in notes showing and editable.
// The scene stays in the note; a PNG of it goes wherever the note's photos go
// — Content media, or note storage — and is what History, Ask DUMA and an
// export see: in Markdown a drawing is that image.
// ---------------------------------------------------------------------------

// Excalidraw is large: only fetched when a drawing is opened.
const DrawingEditor = dynamic(() => import('./DrawingEditor'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-background/80">
      <Loader2 className="animate-spin text-muted-foreground" aria-label="Opening the drawing" />
    </div>
  ),
});

export interface NoteDrawingOptions {
  /** Saves the drawing's picture; resolves to its URL. The editor's own upload. */
  upload: (file: File) => Promise<string>;
}

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    noteDrawing: {
      insertDrawing: () => ReturnType;
    };
  }
}

export const NoteDrawing = Node.create<NoteDrawingOptions>({
  name: 'drawing',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { upload: async () => Promise.reject(new Error('Drawings can’t be saved here.')) };
  },

  addAttributes() {
    return {
      scene: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-scene'),
        renderHTML: (attrs) => (attrs.scene ? { 'data-scene': attrs.scene } : {}),
      },
      src: { default: null, parseHTML: (element) => element.querySelector('img')?.getAttribute('src') ?? null, renderHTML: () => ({}) },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-drawing]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const src = node.attrs.src as string | null;
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-drawing': '' }), ...(src ? [['img', { src, alt: 'Drawing' }]] : [])];
  },

  // Markdown has no drawings: export, History and Ask DUMA see its picture.
  renderMarkdown: (node) => {
    const src = (node.attrs?.src as string | undefined) ?? '';
    return src ? `![Drawing](${src})` : '';
  },

  addCommands() {
    return {
      insertDrawing:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { scene: null, src: null } }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingView);
  },
});

function DrawingView({ node, editor, extension, updateAttributes, deleteNode, selected }: ReactNodeViewProps) {
  const scene = node.attrs.scene as string | null;
  const src = node.attrs.src as string | null;
  const editable = editor.isEditable;
  // A drawing just inserted has nothing in it yet: it opens straight away.
  const [open, setOpen] = useState(() => editable && !scene);

  const finish = async (result: Parameters<React.ComponentProps<typeof DrawingEditor>['onDone']>[0]) => {
    if (!result) {
      // Done on an empty canvas: a new drawing goes away; an old one is cleared.
      if (!scene) deleteNode();
      else updateAttributes({ scene: null, src: null });
      setOpen(false);
      return;
    }
    const raw = serializeDrawing(result.scene);
    if (!raw) {
      toast('error', 'This drawing is too big to keep in a note — try splitting it.');
      return;
    }
    try {
      const url = await (extension.options as NoteDrawingOptions).upload(new File([result.png], 'drawing.png', { type: 'image/png' }));
      updateAttributes({ scene: raw, src: url });
      setOpen(false);
    } catch (error) {
      toast('error', error instanceof Error && error.message ? error.message : 'The drawing couldn’t be saved.');
    }
  };

  return (
    <NodeViewWrapper as="figure" data-drawing="" className="my-3" contentEditable={false}>
      <div
        className={`group relative overflow-hidden rounded-lg border bg-card ${selected && editable ? 'border-primary ring-2 ring-primary/25' : 'border-rule/60'}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- the drawing's own picture, from the note's storage
          <img
            src={src}
            alt="Drawing"
            className="mx-auto block max-h-[70vh] w-auto max-w-full"
            onDoubleClick={() => editable && setOpen(true)}
            draggable={false}
          />
        ) : (
          <button
            type="button"
            disabled={!editable}
            onClick={() => setOpen(true)}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground transition-colors duration-150 enabled:hover:bg-band/40"
          >
            <PenLine size={22} aria-hidden="true" />
            {editable ? 'Empty drawing — click to draw' : 'Empty drawing'}
          </button>
        )}
        {editable && src && (
          <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
            <Button size="sm" variant="outline" className="bg-card/95" onClick={() => setOpen(true)}>
              <PenLine aria-hidden="true" />
              Edit drawing
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              className="bg-card/95 text-exception"
              aria-label="Remove drawing"
              onClick={() => deleteNode()}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      {open && (
        <DrawingEditor
          scene={scene}
          onDone={finish}
          onCancel={() => {
            if (!scene) deleteNode();
            setOpen(false);
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
