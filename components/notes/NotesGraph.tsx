'use client';

import {
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force';
import { useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef } from 'react';

import { type GraphNode, type NoteGraphModel, orbRadius } from '@/lib/utils/notes-graph';

type SimNode = GraphNode & SimulationNodeDatum & { r: number };
type SimLink = SimulationLinkDatum<SimNode> & { kind: 'link' | 'tag' };

interface Palette {
  note: string;
  pinned: string;
  tag: string;
  link: string;
  label: string;
  halo: string;
  ground: string;
}

/**
 * The theme's own colours (globals.css), read when the graph starts and whenever
 * the theme changes. Each goes through an element's `color`, so whatever the
 * variable holds — another variable, color-mix — comes back as one colour canvas accepts.
 */
function readPalette(): Palette {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const resolve = (name: string, fallback: string) => {
    probe.style.color = fallback;
    probe.style.color = `var(${name}, ${fallback})`;
    return getComputedStyle(probe).color || fallback;
  };
  const palette = {
    note: resolve('--muted-foreground', '#8a8a8a'),
    pinned: resolve('--primary', '#2563eb'),
    tag: resolve('--reference', '#7c3aed'),
    link: resolve('--border', '#d4d4d4'),
    label: resolve('--foreground', '#111111'),
    halo: resolve('--primary', '#2563eb'),
    ground: resolve('--card', '#ffffff'),
  };
  probe.remove();
  return palette;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
/** Past this zoom every orb is labelled; below it only the hovered one and its neighbours. */
const LABEL_ALL_FROM = 1.6;

/**
 * Notes as orbs on a canvas, laid out by d3-force: wheel to zoom, drag the
 * background to pan, drag an orb to move it, hover to light up its neighbours,
 * click to open. With reduced motion the layout is settled first and drawn still.
 */
export function NotesGraph({
  model,
  focusId,
  highlight,
  onOpen,
}: {
  model: NoteGraphModel;
  /** An orb to start centred on and lit — the note the graph was opened from. */
  focusId: string | null;
  /** Orbs matching a search, drawn lit. */
  highlight: ReadonlySet<string> | null;
  onOpen: (node: GraphNode) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapHelpId = useId();
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion() ?? false;
  // The latest props, for handlers that live as long as the simulation.
  const live = useRef({ highlight, onOpen, focusId });
  useEffect(() => {
    live.current = { highlight, onOpen, focusId };
  });
  const redrawRef = useRef<() => void>(() => undefined);
  useEffect(() => redrawRef.current(), [highlight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const minimap = minimapRef.current;
    const mini = minimap?.getContext('2d');
    if (!context || !minimap || !mini) return;
    let map = { k: 1, x: 0, y: 0 };
    let miniWidth = minimap.clientWidth;
    let miniHeight = minimap.clientHeight;

    let palette = readPalette();
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    const view = { k: 1, x: width / 2, y: height / 2 };
    let hovered: SimNode | null = null;

    const nodes: SimNode[] = model.nodes.map((node) => ({ ...node, r: orbRadius(node) }));
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const links: SimLink[] = model.links
      .filter((link) => byId.has(link.source) && byId.has(link.target))
      .map((link) => ({ source: link.source, target: link.target, kind: link.kind }));

    const simulation: Simulation<SimNode, SimLink> = forceSimulation(nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .distance((link) => (link.kind === 'tag' ? 45 : 70))
          .strength((link) => (link.kind === 'tag' ? 0.25 : 0.6)),
      )
      .force('charge', forceManyBody<SimNode>().strength(-140).distanceMax(400))
      .force('center', forceCenter(0, 0))
      // A gentle pull to the middle, so notes with no links don't drift off.
      .force('x', forceX<SimNode>(0).strength(0.04))
      .force('y', forceY<SimNode>(0).strength(0.04))
      .force(
        'collide',
        forceCollide<SimNode>((node) => node.r + 3),
      );

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      view.x += (canvas.clientWidth - width) / 2;
      view.y += (canvas.clientHeight - height) / 2;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      miniWidth = minimap.clientWidth;
      miniHeight = minimap.clientHeight;
      minimap.width = Math.round(miniWidth * ratio);
      minimap.height = Math.round(miniHeight * ratio);
      mini.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    };

    const lit = (node: SimNode) => {
      const { highlight: matches, focusId: focus } = live.current;
      if (hovered) return node === hovered || (model.neighbours.get(hovered.id)?.has(node.id) ?? false);
      if (matches) return matches.has(node.id);
      if (focus) return node.id === focus || (model.neighbours.get(focus)?.has(node.id) ?? false);
      return true;
    };
    const dimming = () => hovered !== null || live.current.highlight !== null || live.current.focusId !== null;

    function draw() {
      context!.save();
      context!.clearRect(0, 0, width, height);
      context!.translate(view.x, view.y);
      context!.scale(view.k, view.k);
      const dim = dimming();

      // Links first, under the orbs.
      context!.lineWidth = 1 / view.k;
      for (const link of links) {
        const a = link.source as SimNode;
        const b = link.target as SimNode;
        const on = !dim || (lit(a) && lit(b));
        context!.globalAlpha = on ? (link.kind === 'tag' ? 0.5 : 0.9) : 0.12;
        context!.strokeStyle = on && dim ? palette.halo : palette.link;
        if (link.kind === 'tag') context!.setLineDash([3 / view.k, 3 / view.k]);
        context!.beginPath();
        context!.moveTo(a.x ?? 0, a.y ?? 0);
        context!.lineTo(b.x ?? 0, b.y ?? 0);
        context!.stroke();
        context!.setLineDash([]);
      }

      for (const node of nodes) {
        const on = !dim || lit(node);
        context!.globalAlpha = on ? 1 : 0.18;
        const colour = node.kind === 'tag' ? palette.tag : node.pinned ? palette.pinned : palette.note;
        context!.beginPath();
        context!.arc(node.x ?? 0, node.y ?? 0, node.r, 0, Math.PI * 2);
        if (node.kind === 'note' && node.degree === 0) {
          // A note nothing links to: a hollow orb.
          context!.fillStyle = palette.ground;
          context!.fill();
          context!.lineWidth = 1.5 / view.k;
          context!.strokeStyle = colour;
          context!.stroke();
        } else {
          context!.fillStyle = colour;
          context!.fill();
        }
        if (node === hovered || node.id === live.current.focusId) {
          context!.lineWidth = 2 / view.k;
          context!.strokeStyle = palette.halo;
          context!.beginPath();
          context!.arc(node.x ?? 0, node.y ?? 0, node.r + 3 / view.k, 0, Math.PI * 2);
          context!.stroke();
        }
      }

      // Labels last, over everything; their size stays the same as you zoom.
      context!.font = `500 ${12 / view.k}px ui-sans-serif, system-ui, sans-serif`;
      context!.textAlign = 'center';
      context!.textBaseline = 'top';
      for (const node of nodes) {
        const show =
          view.k >= LABEL_ALL_FROM || node === hovered || (dim && lit(node) && (hovered !== null || live.current.focusId !== null));
        if (!show) continue;
        context!.globalAlpha = !dim || lit(node) ? 1 : 0.3;
        const label = node.label.length > 40 ? `${node.label.slice(0, 39)}…` : node.label;
        const y = (node.y ?? 0) + node.r + 4 / view.k;
        context!.lineWidth = 3 / view.k;
        context!.strokeStyle = palette.ground;
        context!.strokeText(label, node.x ?? 0, y);
        context!.fillStyle = palette.label;
        context!.fillText(label, node.x ?? 0, y);
      }
      context!.restore();
      drawMinimap();
    }

    function drawMinimap() {
      const left = -view.x / view.k;
      const top = -view.y / view.k;
      const viewWidth = width / view.k;
      const viewHeight = height / view.k;
      // Include the viewport, so the overview stays useful when panned past the graph.
      let minX = left,
        minY = top,
        maxX = left + viewWidth,
        maxY = top + viewHeight;
      for (const node of nodes) {
        minX = Math.min(minX, (node.x ?? 0) - node.r);
        minY = Math.min(minY, (node.y ?? 0) - node.r);
        maxX = Math.max(maxX, (node.x ?? 0) + node.r);
        maxY = Math.max(maxY, (node.y ?? 0) + node.r);
      }
      const k = Math.min((miniWidth - 20) / Math.max(1, maxX - minX), (miniHeight - 20) / Math.max(1, maxY - minY));
      map = { k, x: (miniWidth - (maxX + minX) * k) / 2, y: (miniHeight - (maxY + minY) * k) / 2 };
      mini!.clearRect(0, 0, miniWidth, miniHeight);
      mini!.save();
      mini!.translate(map.x, map.y);
      mini!.scale(k, k);
      mini!.strokeStyle = palette.link;
      mini!.lineWidth = 1 / k;
      for (const link of links) {
        const a = link.source as SimNode,
          b = link.target as SimNode;
        mini!.beginPath();
        mini!.moveTo(a.x ?? 0, a.y ?? 0);
        mini!.lineTo(b.x ?? 0, b.y ?? 0);
        mini!.stroke();
      }
      for (const node of nodes) {
        mini!.fillStyle =
          node.pinned || node.id === live.current.focusId || live.current.highlight?.has(node.id) ? palette.pinned : palette.note;
        mini!.beginPath();
        mini!.arc(node.x ?? 0, node.y ?? 0, Math.max(node.r, 2 / k), 0, Math.PI * 2);
        mini!.fill();
      }
      mini!.strokeStyle = palette.halo;
      mini!.fillStyle = palette.halo;
      mini!.globalAlpha = 0.08;
      mini!.fillRect(left, top, viewWidth, viewHeight);
      mini!.globalAlpha = 0.8;
      mini!.lineWidth = 1 / k;
      mini!.strokeRect(left, top, viewWidth, viewHeight);
      mini!.restore();
    }
    redrawRef.current = draw;

    // Start on the note the graph was opened from.
    const centreOn = (node: SimNode | undefined) => {
      if (!node) return;
      view.x = width / 2 - (node.x ?? 0) * view.k;
      view.y = height / 2 - (node.y ?? 0) * view.k;
    };
    if (reduced) {
      simulation.stop();
      for (let tick = 0; tick < 300; tick += 1) simulation.tick();
      centreOn(byId.get(live.current.focusId ?? ''));
    } else {
      let centred = false;
      simulation.on('tick', () => {
        if (!centred && simulation.alpha() < 0.3 && live.current.focusId) {
          centreOn(byId.get(live.current.focusId));
          centred = true;
        }
        draw();
      });
    }

    // ── Pointer: hover, drag an orb, pan, click ──
    const toWorld = (event: PointerEvent | WheelEvent) => {
      const box = canvas.getBoundingClientRect();
      return { x: (event.clientX - box.left - view.x) / view.k, y: (event.clientY - box.top - view.y) / view.k };
    };
    const nodeAt = (point: { x: number; y: number }) => {
      for (let index = nodes.length - 1; index >= 0; index -= 1) {
        const node = nodes[index]!;
        const reach = node.r + 4 / view.k;
        if (((node.x ?? 0) - point.x) ** 2 + ((node.y ?? 0) - point.y) ** 2 <= reach * reach) return node;
      }
      return null;
    };
    let press: { node: SimNode | null; startX: number; startY: number; viewX: number; viewY: number; moved: boolean } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
      const node = nodeAt(toWorld(event));
      press = { node, startX: event.clientX, startY: event.clientY, viewX: view.x, viewY: view.y, moved: false };
      if (node && !reduced) {
        node.fx = node.x;
        node.fy = node.y;
        simulation.alphaTarget(0.25).restart();
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (press) {
        const dx = event.clientX - press.startX;
        const dy = event.clientY - press.startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) press.moved = true;
        if (press.node) {
          const point = toWorld(event);
          press.node.fx = point.x;
          press.node.fy = point.y;
          if (reduced) {
            press.node.x = point.x;
            press.node.y = point.y;
          }
        } else {
          view.x = press.viewX + dx;
          view.y = press.viewY + dy;
        }
        canvas.style.cursor = 'grabbing';
        draw();
        return;
      }
      const node = nodeAt(toWorld(event));
      if (node !== hovered) {
        hovered = node;
        canvas.style.cursor = node ? 'pointer' : 'grab';
        draw();
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!press) return;
      const { node, moved } = press;
      press = null;
      canvas.style.cursor = hovered ? 'pointer' : 'grab';
      if (node) {
        node.fx = null;
        node.fy = null;
        simulation.alphaTarget(0);
        if (!moved) live.current.onOpen(node);
      }
      canvas.releasePointerCapture(event.pointerId);
    };
    const onLeave = () => {
      if (hovered && !press) {
        hovered = null;
        draw();
      }
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = toWorld(event);
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * Math.exp(-event.deltaY * 0.0015)));
      // Zoom about the pointer: the point under it stays put.
      view.x -= point.x * (k - view.k);
      view.y -= point.y * (k - view.k);
      view.k = k;
      draw();
    };

    // The overview navigates the viewport without opening or moving any notes.
    let miniDrag: { pointerId: number; projection: typeof map } | null = null;
    const moveFromMinimap = (event: PointerEvent) => {
      if (!miniDrag) return;
      const box = minimap.getBoundingClientRect();
      const projection = miniDrag.projection;
      view.x = width / 2 - ((event.clientX - box.left - projection.x) / projection.k) * view.k;
      view.y = height / 2 - ((event.clientY - box.top - projection.y) / projection.k) * view.k;
      draw();
    };
    const onMiniDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      minimap.focus({ preventScroll: true });
      minimap.setPointerCapture(event.pointerId);
      miniDrag = { pointerId: event.pointerId, projection: { ...map } };
      moveFromMinimap(event);
    };
    const onMiniUp = (event: PointerEvent) => {
      if (miniDrag?.pointerId !== event.pointerId) return;
      miniDrag = null;
      if (minimap.hasPointerCapture(event.pointerId)) minimap.releasePointerCapture(event.pointerId);
    };
    const onMiniKey = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 160 : 40;
      if (event.key === 'ArrowLeft') view.x += step;
      else if (event.key === 'ArrowRight') view.x -= step;
      else if (event.key === 'ArrowUp') view.y += step;
      else if (event.key === 'ArrowDown') view.y -= step;
      else if (event.key === 'Home') {
        view.x = width / 2;
        view.y = height / 2;
      } else return;
      event.preventDefault();
      draw();
    };
    minimap.addEventListener('pointerdown', onMiniDown);
    minimap.addEventListener('pointermove', moveFromMinimap);
    minimap.addEventListener('pointerup', onMiniUp);
    minimap.addEventListener('pointercancel', onMiniUp);
    minimap.addEventListener('keydown', onMiniKey);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    const resizer = new ResizeObserver(resize);
    resizer.observe(canvas);
    resizer.observe(minimap);
    // Light ↔ dark: the theme sets a class or attribute on <html>.
    const themeWatch = new MutationObserver(() => {
      palette = readPalette();
      draw();
    });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    resize();

    return () => {
      simulation.stop();
      redrawRef.current = () => undefined;
      minimap.removeEventListener('pointerdown', onMiniDown);
      minimap.removeEventListener('pointermove', moveFromMinimap);
      minimap.removeEventListener('pointerup', onMiniUp);
      minimap.removeEventListener('pointercancel', onMiniUp);
      minimap.removeEventListener('keydown', onMiniKey);
      resizer.disconnect();
      themeWatch.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [model, reduced]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none cursor-grab"
        role="img"
        aria-label={`Graph of ${model.nodes.length} notes and ${model.links.length} links. The list below has the same notes.`}
      />
      <div className="absolute bottom-3 right-3 overflow-hidden rounded-md border border-rule/70 bg-card shadow-sm">
        <canvas
          ref={minimapRef}
          className="block h-24 w-36 touch-none cursor-crosshair focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:h-28 md:w-44"
          role="group"
          tabIndex={0}
          aria-label="Graph minimap"
          aria-describedby={minimapHelpId}
          title="Click or drag to move the view"
        />
        <span id={minimapHelpId} className="sr-only">
          Click or drag to move the view. Use arrow keys to pan, or Home to recenter.
        </span>
      </div>
      {/* The same notes for a screen reader or keyboard: the canvas itself can't be navigated. */}
      <ul className="sr-only">
        {model.nodes.map((node) => (
          <li key={node.id}>
            <button type="button" onClick={() => onOpen(node)}>
              {node.label}, {node.degree} {node.degree === 1 ? 'link' : 'links'}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
