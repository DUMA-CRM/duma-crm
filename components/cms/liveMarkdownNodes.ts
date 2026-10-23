import { Node, mergeAttributes } from '@tiptap/react';

// Relative, with .ts: the node test runner (tests/live-markdown.test.mts) has no path aliases.
import { CALLOUT_KINDS, type CalloutKind, videoEmbed } from '../../lib/utils/markdown-edit.ts';

// ---------------------------------------------------------------------------
// The two CMS Markdown constructs the live editor must keep exactly, because
// websites read them from the raw text (UI-ADR-039):
//   - a callout:  `> [!NOTE]` then `> …` lines (GitHub's alert syntax)
//   - a video:    a bare YouTube / Vimeo link on its own line
// Each has its own tokenizer (so the blockquote / paragraph tokenizers don't
// take it first) and writes itself back in the same form.
// ---------------------------------------------------------------------------

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    cmsCallout: { insertCallout: (kind: CalloutKind) => ReturnType };
    cmsVideo: { insertVideo: (url: string) => ReturnType };
  }
}

const KINDS = CALLOUT_KINDS.join('|');
const CALLOUT_BLOCK = new RegExp(`^ {0,3}> ?\\[!(${KINDS})\\][ \\t]*(?:\\n|$)((?: {0,3}>.*(?:\\n|$))*)`, 'i');
const CALLOUT_START = new RegExp(`^ {0,3}> ?\\[!(${KINDS})\\]`, 'im');

export const CmsCallout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return { kind: { default: 'NOTE' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]', getAttrs: (element) => ({ kind: (element as HTMLElement).getAttribute('data-callout') ?? 'NOTE' }) }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': node.attrs.kind, class: 'cms-callout' }), 0];
  },

  markdownTokenizer: {
    name: 'callout',
    level: 'block',
    start: (src) => src.search(CALLOUT_START),
    tokenize: (src, _tokens, lexer) => {
      const match = CALLOUT_BLOCK.exec(src);
      if (!match) return undefined;
      const body = match[2]!
        .split('\n')
        .map((line) => line.replace(/^ {0,3}> ?/, ''))
        .join('\n')
        .trim();
      return { type: 'callout', raw: match[0], kind: match[1]!.toUpperCase(), tokens: lexer.blockTokens(body || ' ') };
    },
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode('callout', { kind: token.kind }, (helpers.parseBlockChildren ?? helpers.parseChildren)(token.tokens ?? [])),
  renderMarkdown: (node, helpers) => {
    const lines = (node.content ?? []).map((child, index) => (helpers.renderChild?.(child, index) ?? helpers.renderChildren([child])).split('\n'));
    const body = lines.map((block) => block.map((line) => (line.trim() ? `> ${line}` : '>')).join('\n')).join('\n>\n');
    return `> [!${(node.attrs?.kind as string | undefined) ?? 'NOTE'}]${body ? `\n${body}` : ''}`;
  },

  addCommands() {
    return {
      insertCallout:
        (kind) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { kind },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Something readers should know.' }] }],
          }),
    };
  },
});

const VIDEO_LINE = /^ {0,3}(https?:\/\/\S+)[ \t]*(?:\n|$)/;

export const CmsVideo = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return { url: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-video]', getAttrs: (element) => ({ url: (element as HTMLElement).getAttribute('data-video') ?? '' }) }];
  },
  // A card, not a player: the CSP allows no third-party frames. The website embeds the real one from the same link.
  renderHTML({ node }) {
    const embed = videoEmbed(node.attrs.url as string);
    const provider = embed?.provider === 'vimeo' ? 'Vimeo' : 'YouTube';
    return [
      'div',
      { 'data-video': node.attrs.url, class: 'cms-video', contenteditable: 'false' },
      ['span', { class: 'cms-video-play', 'aria-hidden': 'true' }, '▶'],
      ['span', { class: 'cms-video-text' }, ['strong', {}, `${provider} video`], ['span', {}, node.attrs.url as string]],
    ];
  },

  markdownTokenizer: {
    name: 'videoEmbed',
    level: 'block',
    start: (src) => src.search(/^ {0,3}https?:\/\//m),
    tokenize: (src) => {
      const match = VIDEO_LINE.exec(src);
      if (!match || !videoEmbed(match[1]!)) return undefined;
      // Only a link alone in its paragraph: the next line must be blank or the end.
      const rest = src.slice(match[0].length);
      if (rest && !/^[ \t]*(?:\n|$)/.test(rest)) return undefined;
      return { type: 'videoEmbed', raw: match[0], url: match[1]! };
    },
  },
  parseMarkdown: (token, helpers) => helpers.createNode('videoEmbed', { url: token.url }),
  renderMarkdown: (node) => (node.attrs?.url as string | undefined) ?? '',

  addCommands() {
    return {
      insertVideo:
        (url) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { url } }),
    };
  },
});
