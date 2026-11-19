'use client';

import { motion, useReducedMotion } from 'motion/react';
import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';

import { Maximize } from '@/components/icons';
import { COMPACT_GRID, GRID, KEY_FLOW } from '@/components/pos/MenuGrid';
import { ProductCard } from '@/components/pos/ProductCard';

import { cn } from '@/lib/utils/cn';
import type { StockLevel } from '@/lib/utils/pos';
import { type KeyEntry, arrangeKeys, keyLayout, keySizeName, moveKey, nextKeySize } from '@/lib/utils/till-keys';
import type { TileStyle } from '@/stores/posSettingsStore';
import type { MenuItem } from '@/types/pos';

/**
 * One menu page's keys, being arranged on the till: hold a key (a mouse can
 * just drag) and move it over another to take its place, the keys between
 * shifting along; the corner button steps it through key, wide key and big
 * key. The keys are the till's own, drawn still — nothing sells while they
 * are being arranged. Keyboard: Space lifts and drops, the arrows move it,
 * Escape puts it back.
 */
export function KeyArranger({
  items,
  keys,
  onChange,
  tileStyle = 'compact',
  colours,
  stock,
  currency,
}: {
  items: MenuItem[];
  keys: KeyEntry[] | undefined;
  onChange: (keys: KeyEntry[]) => void;
  tileStyle?: TileStyle;
  colours?: Record<string, string>;
  stock?: Record<string, { level: StockLevel; ingredient: string }>;
  currency?: string;
}) {
  const reducedMotion = useReducedMotion();
  const saved = keyLayout(arrangeKeys(items, keys));
  // While a key is held: the order as it would drop, and which key it is.
  const [draft, setDraft] = useState<{ id: string; keys: KeyEntry[]; from: 'pointer' | 'keyboard' } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const stop = useRef<(() => void) | null>(null);
  const layout = draft?.keys ?? saved;
  const byId = new Map(items.map((item) => [item.id, item]));
  const nameOf = (id: string) => byId.get(id)?.name ?? 'Key';

  // Leaving the page or arrange mode drops a key in mid-air rather than saving it.
  useEffect(() => () => stop.current?.(), []);

  function startDrag(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (!event.isPrimary || event.button !== 0 || stop.current || draft) return;
    const pointerId = event.pointerId;
    const touch = event.pointerType === 'touch';
    const origin = { x: event.clientX, y: event.clientY };
    let lifted = false;
    let current = saved;
    let timer = 0;
    let frame = 0;
    let point = origin;
    const element = event.currentTarget;
    // The menu scrolls in its own pane; a held key near its top or bottom edge scrolls it.
    const scroller = (element.closest('.overflow-y-auto') as HTMLElement | null) ?? document.scrollingElement;
    // Where the key sat when lifted: its offset in the grid (which transforms don't move) and the pane's scroll.
    const start = { left: element.offsetLeft, top: element.offsetTop, scroll: scroller?.scrollTop ?? 0 };
    /**
     * The held key stays under the finger, written straight to the element rather than through React, so it
     * moves every frame. Its slot changes as the order does, and the pane may scroll; both are taken back out.
     */
    const follow = () => {
      const x = point.x - origin.x - (element.offsetLeft - start.left);
      const y = point.y - origin.y - (element.offsetTop - start.top) + ((scroller?.scrollTop ?? 0) - start.scroll);
      element.style.translate = `${x}px ${y}px`;
    };
    const autoScroll = () => {
      if (scroller) {
        const bounds = scroller === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
        const edge = 72;
        const up = Math.max(0, bounds.top + edge - point.y);
        const down = Math.max(0, point.y - bounds.bottom + edge);
        if (up || down) {
          scroller.scrollTop += (Math.min(edge, down) - Math.min(edge, up)) / 4;
          over(point.x, point.y);
        }
      }
      follow();
      frame = requestAnimationFrame(autoScroll);
    };

    const lift = () => {
      lifted = true;
      // Out of hit-testing, so the key under the finger is the one found, not the one held.
      element.style.pointerEvents = 'none';
      frame = requestAnimationFrame(autoScroll);
      setDraft({ id, keys: current, from: 'pointer' });
      setAnnouncement(`${nameOf(id)} lifted`);
    };
    const over = (x: number, y: number) => {
      const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-key]')?.dataset.key;
      if (!target || target === id) return;
      const next = moveKey(current, id, target);
      if (next.every((entry, index) => entry.id === current[index]!.id)) return;
      current = next;
      setDraft({ id, keys: next, from: 'pointer' });
    };
    const onMove = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      point = { x: next.clientX, y: next.clientY };
      if (lifted) return over(next.clientX, next.clientY);
      // A touch that travels before the hold is a scroll; a mouse that travels is a drag.
      if (Math.hypot(next.clientX - origin.x, next.clientY - origin.y) > 8) {
        if (touch) cleanup();
        else lift();
      }
    };
    const onUp = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      if (lifted && next.type === 'pointerup') {
        onChange(current);
        setAnnouncement(`${nameOf(id)} dropped`);
      }
      cleanup();
    };
    const preventScroll = (move: TouchEvent) => {
      if (lifted && move.cancelable) move.preventDefault();
    };
    const escape = (key: globalThis.KeyboardEvent) => {
      if (key.key === 'Escape') cleanup();
    };
    function cleanup() {
      stop.current = null;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', escape);
      document.removeEventListener('touchmove', preventScroll, true);
      element.style.translate = '';
      element.style.pointerEvents = '';
      setDraft(null);
    }

    stop.current = cleanup;
    // Registered before the browser decides the gesture is a scroll, so a lifted key can stop it.
    if (touch) document.addEventListener('touchmove', preventScroll, { capture: true, passive: false });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', escape);
    if (touch) timer = window.setTimeout(lift, 200);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>, id: string) {
    if (event.target !== event.currentTarget) return;
    if (event.key === ' ') {
      event.preventDefault();
      if (event.repeat) return;
      if (draft?.from === 'keyboard') {
        onChange(draft.keys);
        setDraft(null);
        setAnnouncement(`${nameOf(id)} dropped`);
      } else if (!draft) {
        setDraft({ id, keys: saved, from: 'keyboard' });
        setAnnouncement(`${nameOf(id)} lifted. Use the arrow keys to move it, Space to drop.`);
      }
      return;
    }
    if (draft?.from !== 'keyboard' || draft.id !== id) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setDraft(null);
      setAnnouncement(`${nameOf(id)} put back`);
      return;
    }
    const step =
      event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = draft.keys.findIndex((entry) => entry.id === id);
    const neighbour = draft.keys[index + step];
    if (!neighbour) return;
    const element = event.currentTarget;
    setDraft({ ...draft, keys: moveKey(draft.keys, id, neighbour.id) });
    setAnnouncement(`${nameOf(id)}, position ${index + step + 1} of ${draft.keys.length}`);
    requestAnimationFrame(() => element.focus({ preventScroll: false }));
  }

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className={cn(tileStyle === 'compact' ? COMPACT_GRID : GRID, KEY_FLOW)}>
        {layout.map((entry) => {
          const item = byId.get(entry.id);
          if (!item) return null;
          const held = draft?.id === entry.id;
          const size = { w: entry.w, h: entry.h };
          return (
            <motion.div
              key={entry.id}
              // The held key follows the finger itself; the others glide to their new slots.
              layout={reducedMotion || held ? false : 'position'}
              transition={{ type: 'spring', stiffness: 520, damping: 42 }}
              data-key={entry.id}
              role="button"
              tabIndex={0}
              aria-label={`${item.name}, ${keySizeName(size).toLowerCase()}. Space to lift and move.`}
              aria-pressed={held}
              onPointerDown={(event) => startDrag(event, entry.id)}
              onKeyDown={(event) => onKeyDown(event, entry.id)}
              onContextMenu={(event) => event.preventDefault()}
              style={{ gridColumn: `span ${entry.w}`, gridRow: `span ${entry.h}` }}
              className={cn(
                'relative min-w-0 cursor-grab touch-manipulation rounded-md outline-2 outline-offset-2 outline-border outline-dashed select-none',
                'focus-visible:outline-solid focus-visible:outline-ring',
                held && 'z-30 scale-[1.03] cursor-grabbing shadow-lg outline-solid outline-primary will-change-[translate]',
              )}
            >
              {/* The key as it sells, held still: a tap here never rings anything up. */}
              <div inert className="pointer-events-none h-full">
                <ProductCard
                  item={item}
                  count={0}
                  isSelected={false}
                  stock={stock?.[item.id]}
                  tileStyle={tileStyle}
                  colour={colours?.[item.category]}
                  onSelect={() => undefined}
                  currency={currency}
                  size={size}
                />
              </div>
              <button
                type="button"
                aria-label={`Make ${item.name} a ${keySizeName(nextKeySize(size)).toLowerCase()}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  const next = nextKeySize(size);
                  onChange(saved.map((key) => (key.id === entry.id ? { ...key, ...next } : key)));
                  setAnnouncement(`${item.name} is now a ${keySizeName(next).toLowerCase()}`);
                }}
                // 44px to hit, a 28px chip to see, in the key's top corner.
                className="absolute -top-2 -right-2 z-20 grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
                  <Maximize size={13} aria-hidden="true" />
                </span>
              </button>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
