// A drawing in a note: its Excalidraw scene, kept in the note's document as a
// JSON string attribute, beside the picture of it the note shows. Only what's
// needed to reopen it is kept — the elements and the background — never pasted
// image files, which would bloat the note. Pure, so tests/note-drawing.test.mts
// can check it.

export type DrawingScene = {
  /** Excalidraw's elements, as it gave them; opaque here. */
  elements: Record<string, unknown>[];
  background: string;
};

/** Big enough for any real sketch; past it the note itself would get unwieldy. */
export const MAX_DRAWING_CHARS = 1_500_000;

export const emptyDrawing = (): DrawingScene => ({ elements: [], background: '#ffffff' });

/** The scene in a note's drawing attribute, or null when it's missing or unreadable. */
export function parseDrawing(raw: string | null | undefined): DrawingScene | null {
  if (!raw) return null;
  try {
    return readScene(JSON.parse(raw));
  } catch {
    return null;
  }
}

function readScene(raw: unknown): DrawingScene | null {
  const value = raw as Partial<DrawingScene> | null;
  if (!value || !Array.isArray(value.elements)) return null;
  return {
    elements: value.elements.filter((element): element is Record<string, unknown> => typeof element === 'object' && element !== null),
    background: typeof value.background === 'string' && value.background ? value.background : '#ffffff',
  };
}

/** The attribute to store, or null if the drawing is too big to keep in a note. */
export function serializeDrawing(scene: DrawingScene): string | null {
  const raw = JSON.stringify({ elements: scene.elements, background: scene.background });
  return raw.length > MAX_DRAWING_CHARS ? null : raw;
}

// ─── A drawing note ──────────────────────────────────────────────────────────
//
// A note can be a drawing: its whole content is an Excalidraw scene, opened
// full-pane, not a block inside a text note. Photos in it are files in Content's
// media library (or note storage), kept by URL — never pasted bytes — and a
// video is an embed of a Content file. Search, History, Drive sync and Ask DUMA
// see the Markdown made here: the title, the words written on the canvas, and
// links to its photos and videos.

export const DRAWING_NOTE = 'drawing';

/** A photo on the canvas: where its file lives. */
export type DrawingFile = {
  mimeType: string;
  url: string;
};

// A type, not an interface, so it is also a `Record<string, unknown>` — what a note's content is.
export type DrawingNoteContent = DrawingScene & {
  type: typeof DRAWING_NOTE;
  title: string;
  files: Record<string, DrawingFile>;
};

export const UNTITLED_DRAWING = 'Untitled drawing';

/**
 * A drawing note's background until someone picks a colour: the canvas is
 * transparent and the app's own background shows through, so it follows the
 * theme — light, dark and every brand. Excalidraw's white (its default, and
 * what "clear canvas" resets to) means the same: in dark mode Excalidraw never
 * showed it white anyway.
 */
export const APP_BACKGROUND = 'transparent';

/** True when a background is "whatever the app's is" rather than a colour someone chose. */
export const followsApp = (background: string | null | undefined) =>
  !background || ['transparent', '#fff', '#ffffff'].includes(background.trim().toLowerCase());

const drawingBackground = (background: string) => (followsApp(background) ? APP_BACKGROUND : background);

/** True when a note's stored content is a drawing, not a text document. */
export const isDrawingNote = (content: Record<string, unknown> | null | undefined) => content?.type === DRAWING_NOTE;

export const newDrawingNote = (): DrawingNoteContent => ({
  type: DRAWING_NOTE,
  title: '',
  elements: [],
  background: APP_BACKGROUND,
  files: {},
});

/** A drawing note's content as stored, tidied; anything unreadable becomes an empty drawing. */
export function parseDrawingNote(content: Record<string, unknown> | null | undefined): DrawingNoteContent {
  const scene = readScene(content) ?? emptyDrawing();
  const files: Record<string, DrawingFile> = {};
  const stored = content?.files;
  if (stored && typeof stored === 'object') {
    for (const [id, file] of Object.entries(stored as Record<string, unknown>)) {
      const { mimeType, url } = (file ?? {}) as Partial<DrawingFile>;
      if (typeof mimeType === 'string' && typeof url === 'string' && url) files[id] = { mimeType, url };
    }
  }
  return {
    type: DRAWING_NOTE,
    title: typeof content?.title === 'string' ? content.title : '',
    elements: scene.elements,
    background: drawingBackground(scene.background),
    files,
  };
}

const str = (value: unknown) => (typeof value === 'string' ? value : '');

/** The words written on the canvas, top to bottom. */
export function drawingTexts(elements: readonly Record<string, unknown>[]): string[] {
  return elements
    .filter((element) => element.type === 'text' && !element.isDeleted)
    .map((element) => ({
      text: (str(element.originalText) || str(element.text)).trim(),
      y: Number(element.y) || 0,
      x: Number(element.x) || 0,
    }))
    .filter((entry) => entry.text)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((entry) => entry.text);
}

/**
 * What a drawing note saves: its content, and the Markdown and plain text
 * derived from it — the first line of the text is the note's title. Only the
 * elements still on the canvas are kept, and only the files they show. Null
 * when it's too big to keep in a note.
 */
export function drawingNoteSnapshot(input: {
  title: string;
  elements: readonly Record<string, unknown>[];
  background: string;
  files: Record<string, DrawingFile>;
}): { content: DrawingNoteContent; markdown: string; text: string } | null {
  const elements = input.elements.filter((element) => !element.isDeleted);
  const files: Record<string, DrawingFile> = {};
  const media: string[] = [];
  for (const element of elements) {
    const fileId = str(element.fileId);
    const file = element.type === 'image' && fileId ? input.files[fileId] : undefined;
    if (file && !files[fileId]) {
      files[fileId] = file;
      media.push(`![Photo](${file.url})`);
    }
    if (element.type === 'embeddable' && str(element.link)) media.push(`[▶ Video](${str(element.link)})`);
  }
  const title = input.title.trim();
  const texts = drawingTexts(elements);
  const content: DrawingNoteContent = {
    type: DRAWING_NOTE,
    title,
    elements: [...elements],
    background: drawingBackground(input.background),
    files,
  };
  if (JSON.stringify(content).length > MAX_DRAWING_CHARS) return null;
  const heading = title || UNTITLED_DRAWING;
  return {
    content,
    markdown: [`# ${heading}`, ...texts, ...media].join('\n\n'),
    text: [heading, ...texts].join('\n'),
  };
}
