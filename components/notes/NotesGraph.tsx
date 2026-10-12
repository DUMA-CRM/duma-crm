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
import { useEffect, useRef } from 'react';

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
    if (!context) return;

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
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
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

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    const resizer = new ResizeObserver(resize);
    resizer.observe(canvas);
    // Light ↔ dark: the theme sets a class or attribute on <html>.
    const themeWatch = new MutationObserver(() => {
      palette = readPalette();
      draw();
    });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    resize();

    return () => {
      simulation.stop();
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
