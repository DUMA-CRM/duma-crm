"use client";

import { useRef, useState } from "react";
import type { CSSProperties, DragEvent, KeyboardEvent, ReactNode } from "react";
// The app's own icon set, so a tree matches the rest of the UI.
import { ChevronRight, FileText as File, FolderIcon as Folder, FolderOpen } from "@/components/icons";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import styles from "./tree-view.module.css";

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  icon?: ReactNode;
  /** Shown at the end of the row — a count, a badge. */
  meta?: ReactNode;
}

export interface TreeViewProps {
  nodes: TreeNode[];
  defaultExpandedIds?: string[];
  expandedIds?: string[];
  onExpandedChange?: (expandedIds: string[]) => void;
  onSelect?: (node: TreeNode) => void;
  /** Controls the selection (e.g. from the URL); left out, the tree keeps its own. */
  selectedId?: string | null;
  /** `plain` drops the card frame, for a tree that fills a sidebar. */
  variant?: "card" | "plain";
  /** Controls beside a row — a menu button. Rendered outside the row's button, so they can be buttons themselves. */
  renderActions?: (node: TreeNode) => ReactNode;
  /** Right-click (or long-press) menu items for a row; null for none. */
  contextMenu?: (node: TreeNode) => ReactNode;
  /** Which rows can be picked up and dragged. */
  canDrag?: (node: TreeNode) => boolean;
  /** Whether `dragged` may be dropped onto `target`. */
  canDrop?: (dragged: TreeNode, target: TreeNode) => boolean;
  onDrop?: (dragged: TreeNode, target: TreeNode) => void;
  "aria-label"?: string;
}

/** Hovering a closed folder this long while dragging opens it, so a drop can go deeper. */
const openWhileDraggingMs = 600;

type VisibleNode = {
  node: TreeNode;
  depth: number;
  parentId?: string;
  position: number;
  setSize: number;
};

function flatten(nodes: TreeNode[], expanded: ReadonlySet<string>, depth = 1, parentId?: string): VisibleNode[] {
  return nodes.flatMap((node, index) => [
    { node, depth, parentId, position: index + 1, setSize: nodes.length },
    ...(node.children && expanded.has(node.id) ? flatten(node.children, expanded, depth + 1, node.id) : []),
  ]);
}

function fileTone(label: string, classNames: Record<string, string>) {
  const name = label.toLowerCase();
  if (name.endsWith(".tsx") || name.endsWith(".ts")) return classNames.typescript;
  if (name.endsWith(".css")) return classNames.stylesheet;
  if (name.endsWith(".md")) return classNames.markdown;
  if (name.endsWith(".json")) return classNames.json;
  return classNames.file;
}

/**
 * Motion the way the app's own sidebar does it: rows open and close at once, and
 * hover and selection are a quick colour change (CSS, 150ms) — no sliding rows,
 * staggers or gliding highlights. Only the disclosure arrow turns, in CSS.
 */
export function TreeView({ nodes, defaultExpandedIds = [], expandedIds, onExpandedChange, onSelect, selectedId: controlledSelectedId, variant = "card", renderActions, contextMenu, canDrag, canDrop, onDrop, "aria-label": ariaLabel = "File tree" }: TreeViewProps) {
  const [internalExpanded, setInternalExpanded] = useState(() => new Set(defaultExpandedIds));
  const [focusedId, setFocusedId] = useState<string | null>(nodes[0]?.id ?? null);
  const [internalSelectedId, setSelectedId] = useState<string | null>(null);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;
  const refs = useRef(new Map<string, HTMLButtonElement>());
  // Drag and drop: what's being carried, which row it's over, and the timer that opens a folder under it.
  const [dragged, setDragged] = useState<TreeNode | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const expanded = expandedIds ? new Set(expandedIds) : internalExpanded;
  const visible = flatten(nodes, expanded);
  const focusableId = visible.some(({ node }) => node.id === focusedId) ? focusedId : (visible[0]?.node.id ?? null);

  function setExpanded(next: Set<string>) {
    if (!expandedIds) setInternalExpanded(next);
    onExpandedChange?.([...next]);
  }

  function toggle(node: TreeNode) {
    if (!node.children?.length) return;
    const next = new Set(expanded);
    if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
    setExpanded(next);
  }

  function focus(id: string) {
    setFocusedId(id);
    const row = refs.current.get(id);
    if (row) row.focus();
    else requestAnimationFrame(() => refs.current.get(id)?.focus());
  }

  function endDrag() {
    clearTimeout(openTimer.current);
    setDragged(null);
    setDropTargetId(null);
  }

  function dragOver(event: DragEvent, node: TreeNode) {
    if (!dragged || dragged.id === node.id || !canDrop?.(dragged, node)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTargetId === node.id) return;
    setDropTargetId(node.id);
    clearTimeout(openTimer.current);
    if (node.children?.length && !expanded.has(node.id)) {
      openTimer.current = setTimeout(() => setExpanded(new Set([...expanded, node.id])), openWhileDraggingMs);
    }
  }

  function select(node: TreeNode) {
    setSelectedId(node.id);
    onSelect?.(node);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, item: VisibleNode, index: number) {
    const { node } = item;
    if (event.key === "ArrowDown") { event.preventDefault(); focus(visible[Math.min(index + 1, visible.length - 1)]!.node.id); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); focus(visible[Math.max(index - 1, 0)]!.node.id); return; }
    if (event.key === "Home") { event.preventDefault(); focus(visible[0]!.node.id); return; }
    if (event.key === "End") { event.preventDefault(); focus(visible[visible.length - 1]!.node.id); return; }
    if (event.key === "ArrowRight" && node.children?.length) {
      event.preventDefault();
      if (!expanded.has(node.id)) toggle(node);
      else if (visible[index + 1]?.parentId === node.id) focus(visible[index + 1]!.node.id);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (node.children?.length && expanded.has(node.id)) toggle(node);
      else if (item.parentId) focus(item.parentId);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(node);
      if (node.children?.length) toggle(node);
    }
  }

  return <div className={[styles.tree, variant === "plain" ? styles.plain : ""].join(" ")} role="tree" aria-label={ariaLabel} aria-multiselectable="false">
    {visible.map((item, index) => {
      const hasChildren = Boolean(item.node.children?.length);
      const isExpanded = hasChildren && expanded.has(item.node.id);
      const isSelected = selectedId === item.node.id;
      const actions = renderActions?.(item.node);
      const menu = contextMenu?.(item.node);
      const draggable = Boolean(canDrag?.(item.node));
      const row = <div
        key={item.node.id}
        className={styles.row}
        data-drop-target={dropTargetId === item.node.id ? "" : undefined}
        data-dragging={dragged?.id === item.node.id ? "" : undefined}
        onDragOver={event => dragOver(event, item.node)}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropTargetId === item.node.id) { clearTimeout(openTimer.current); setDropTargetId(null); } }}
        onDrop={event => { event.preventDefault(); const carried = dragged; endDrag(); if (carried && carried.id !== item.node.id && canDrop?.(carried, item.node)) onDrop?.(carried, item.node); }}
      >
        <button
          data-has-actions={actions ? "" : undefined}
          draggable={draggable || undefined}
          onDragStart={draggable ? event => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.node.label); setDragged(item.node); } : undefined}
          onDragEnd={draggable ? endDrag : undefined}
          ref={element => { if (element) refs.current.set(item.node.id, element); else refs.current.delete(item.node.id); }}
          type="button"
          className={styles.item}
          role="treeitem"
          aria-level={item.depth}
          aria-posinset={item.position}
          aria-setsize={item.setSize}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={isSelected}
          tabIndex={focusableId === item.node.id ? 0 : -1}
          style={{ "--tree-depth": item.depth } as CSSProperties}
          onFocus={() => setFocusedId(item.node.id)}
          onKeyDown={event => onKeyDown(event, item, index)}
          onClick={() => { setFocusedId(item.node.id); select(item.node); if (hasChildren) toggle(item.node); }}
        >
          {item.depth > 1 && <span aria-hidden="true" className={styles.branch} />}
          <span className={styles.disclosure} aria-hidden="true">{hasChildren ? <ChevronRight size={14} strokeWidth={1.9} /> : null}</span>
          <span className={[styles.icon, hasChildren ? styles.folder : fileTone(item.node.label, styles)].join(" ")} aria-hidden="true">
            {item.node.icon ?? (hasChildren ? (isExpanded ? <FolderOpen size={16} strokeWidth={1.7} /> : <Folder size={16} strokeWidth={1.7} />) : <File size={16} strokeWidth={1.7} />)}
          </span>
          <span className={styles.label}>{item.node.label}</span>
          {item.node.meta != null && <span className={styles.meta}>{item.node.meta}</span>}
        </button>
        {actions && <span className={styles.actions}>{actions}</span>}
      </div>;
      return menu ? <ContextMenu key={item.node.id}>
        <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
        <ContextMenuContent>{menu}</ContextMenuContent>
      </ContextMenu> : row;
    })}
  </div>;
}

export default TreeView;
