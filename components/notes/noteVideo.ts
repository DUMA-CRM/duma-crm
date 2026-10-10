import { Node, mergeAttributes } from '@tiptap/react';

// ---------------------------------------------------------------------------
// A video from Content, played in place. TipTap has no video node of its own,
// and its YouTube one would need an iframe our CSP refuses (`default-src
// 'self'`), so a note takes the tenant's own files: the keyless delivery URL
// through `/be`, which `media-src 'self'` allows.
// ---------------------------------------------------------------------------

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    noteVideo: {
      setVideo: (attrs: { src: string; title?: string | null }) => ReturnType;
    };
  }
}

export const NoteVideo = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'video[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, { controls: 'true', preload: 'metadata', playsinline: 'true' })];
  },

  // Markdown has no video: export and Ask DUMA see a link to it instead.
  renderMarkdown: (node) => {
    const src = (node.attrs?.src as string | undefined) ?? '';
    const title = (node.attrs?.title as string | undefined) ?? 'Video';
    return src ? `[▶ ${title}](${src})` : '';
  },

  addCommands() {
    return {
      setVideo:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
