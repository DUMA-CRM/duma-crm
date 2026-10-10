import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Node, mergeAttributes } from '@tiptap/react';

// ---------------------------------------------------------------------------
// Side by side: two or three columns in a row, each holding anything a note
// can (text, a photo, a list, a table). TipTap's own columns are a paid
// extension, so these are two small nodes of ours: `columns` holds 2–3
// `column`s. On a phone they stack (globals.css). In Markdown — export, search,
// Ask DUMA — the columns read one after another.
// ---------------------------------------------------------------------------

export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 3;

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    noteColumns: {
      /** Put the current block in a row of `count` columns, or change how many the row has. */
      setColumns: (count: number) => ReturnType;
      /** Back to one column: everything in the row, top to bottom. */
      unsetColumns: () => ReturnType;
    };
  }
}

/** An empty line left in a column — dropped when columns fold together, so nothing gains stray gaps. */
const isBlank = (block: ProseMirrorNode) => block.type.name === 'paragraph' && block.content.size === 0;

const emptyColumn = (schema: ProseMirrorNode['type']['schema']) => schema.nodes.column!.create(null, schema.nodes.paragraph!.create());

export const NoteColumn = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column' }), 0];
  },

  renderMarkdown: (node, h) => h.renderChildren(node.content ?? [], '\n\n'),
});

export const NoteColumns = Node.create({
  name: 'columns',
  group: 'block',
  content: `column{${MIN_COLUMNS},${MAX_COLUMNS}}`,
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      count: {
        default: MIN_COLUMNS,
        parseHTML: (element) => Number(element.getAttribute('data-count')) || MIN_COLUMNS,
        renderHTML: (attributes) => ({ 'data-count': attributes.count }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'columns' }), 0];
  },

  renderMarkdown: (node, h) => h.renderChildren(node.content ?? [], '\n\n'),

  addCommands() {
    return {
      setColumns:
        (count) =>
        ({ state, tr, dispatch }) => {
          const wanted = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.round(count)));
          const { $from } = state.selection;
          const { schema } = state;

          // Already in a row: add empty columns, or fold the last ones into the one before.
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const row = $from.node(depth);
            if (row.type.name !== 'columns') continue;
            if (row.childCount === wanted) return true;
            const columns: ProseMirrorNode[] = [];
            row.forEach((column) => columns.push(column));
            while (columns.length < wanted) columns.push(emptyColumn(schema));
            while (columns.length > wanted) {
              const last = columns.pop()!;
              const previous = columns.pop()!;
              const kept: ProseMirrorNode[] = [];
              previous.forEach((block) => kept.push(block));
              last.forEach((block) => kept.push(block));
              const merged = kept.filter((block) => !isBlank(block));
              columns.push(previous.copy(Fragment.from(merged.length > 0 ? merged : [schema.nodes.paragraph!.create()])));
            }
            if (dispatch) {
              const start = $from.before(depth);
              tr.replaceWith(start, start + row.nodeSize, row.type.create({ ...row.attrs, count: wanted }, columns));
            }
            return true;
          }

          // Not in a row: the block the caret is in becomes the first column.
          const depth = $from.depth > 0 ? 1 : 0;
          if (depth === 0) return false;
          const block = $from.node(depth);
          const columns = [schema.nodes.column!.create(null, block), ...Array.from({ length: wanted - 1 }, () => emptyColumn(schema))];
          if (dispatch) {
            const start = $from.before(depth);
            tr.replaceWith(start, start + block.nodeSize, schema.nodes.columns!.create({ count: wanted }, columns));
          }
          return true;
        },

      unsetColumns:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const row = $from.node(depth);
            if (row.type.name !== 'columns') continue;
            const blocks: ProseMirrorNode[] = [];
            row.forEach((column) => column.forEach((block) => blocks.push(block)));
            const kept = blocks.filter((block) => !isBlank(block));
            if (dispatch) {
              const start = $from.before(depth);
              tr.replaceWith(start, start + row.nodeSize, kept.length > 0 ? kept : [state.schema.nodes.paragraph!.create()]);
            }
            return true;
          }
          return false;
        },
    };
  },
});
