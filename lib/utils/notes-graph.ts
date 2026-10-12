// The graph view's model: notes as orbs sized by how many links touch them,
// note-to-note links, and — when asked — tags as orbs of their own joined to
// the notes that carry them. Pure, so tests/notes-graph.test.mts can check it;
// the canvas and the physics (d3-force) live in components/notes/NotesGraph.

export interface GraphNoteLike {
  id: string;
  title: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
}

export interface GraphNode {
  id: string;
  kind: 'note' | 'tag';
  label: string;
  /** Links touching it — what sizes the orb. */
  degree: number;
  folderId: string | null;
  pinned: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: 'link' | 'tag';
}

export interface NoteGraphModel {
  nodes: GraphNode[];
  links: GraphLink[];
  /** Each node's neighbours, for the hover highlight. */
  neighbours: Map<string, Set<string>>;
}

export const tagNodeId = (tag: string) => `tag:${tag}`;

/** An orb's radius: a lone note is small, a hub grows with the square root of its links, up to a limit. */
export const orbRadius = (node: Pick<GraphNode, 'degree' | 'kind'>) =>
  node.kind === 'tag' ? 3.5 + Math.min(Math.sqrt(node.degree) * 1.4, 7) : 4.5 + Math.min(Math.sqrt(node.degree) * 2.2, 10);

export function buildNoteGraph(
  input: { nodes: readonly GraphNoteLike[]; links: readonly { source: string; target: string }[] },
  options: { showTags?: boolean; showOrphans?: boolean; folderIds?: ReadonlySet<string> | null } = {},
): NoteGraphModel {
  const { showTags = false, showOrphans = true, folderIds = null } = options;
  const notes = folderIds ? input.nodes.filter((note) => note.folderId !== null && folderIds.has(note.folderId)) : input.nodes;
  const ids = new Set(notes.map((note) => note.id));

  // One link per pair, whichever way it was written.
  const seen = new Set<string>();
  const links: GraphLink[] = [];
  for (const link of input.links) {
    if (!ids.has(link.source) || !ids.has(link.target) || link.source === link.target) continue;
    const pair = [link.source, link.target].sort().join('|');
    if (seen.has(pair)) continue;
    seen.add(pair);
    links.push({ source: link.source, target: link.target, kind: 'link' });
  }
  const tags = new Map<string, number>();
  if (showTags) {
    for (const note of notes) {
      for (const tag of new Set(note.tags)) {
        links.push({ source: note.id, target: tagNodeId(tag), kind: 'tag' });
        tags.set(tag, (tags.get(tag) ?? 0) + 1);
      }
    }
  }

  const neighbours = new Map<string, Set<string>>();
  const touch = (a: string, b: string) => {
    neighbours.set(a, (neighbours.get(a) ?? new Set()).add(b));
    neighbours.set(b, (neighbours.get(b) ?? new Set()).add(a));
  };
  for (const link of links) touch(link.source, link.target);

  const nodes: GraphNode[] = [
    ...notes
      .map<GraphNode>((note) => ({
        id: note.id,
        kind: 'note',
        label: note.title.trim() || 'New note',
        degree: neighbours.get(note.id)?.size ?? 0,
        folderId: note.folderId,
        pinned: note.pinned,
      }))
      .filter((node) => showOrphans || node.degree > 0),
    ...[...tags.entries()].map<GraphNode>(([tag, count]) => ({
      id: tagNodeId(tag),
      kind: 'tag',
      label: `#${tag}`,
      degree: count,
      folderId: null,
      pinned: false,
    })),
  ];
  return { nodes, links, neighbours };
}

/** A folder and every folder below it — the graph's folder filter. */
export function folderAndBelow(folderId: string, folders: readonly { id: string; parentId: string | null }[]): Set<string> {
  const result = new Set([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId && result.has(folder.parentId) && !result.has(folder.id)) {
        result.add(folder.id);
        grew = true;
      }
    }
  }
  return result;
}
