'use client';

import { cn } from '@/lib/utils/cn';
import { fixtureCaption, isThinFixture } from '@/lib/utils/floor-fixtures';
import type { FloorFixture } from '@/lib/utils/reservations';

/**
 * A fixture as the floor draws it — quietly, so tables stay the subject: a
 * window is a thin light line, the entrance and doors are gaps, walls are dark
 * lines, the bar a long rounded block, rooms (kitchen, toilets, stairs) labelled
 * blocks, a pillar a small square, a plant a circle, a label just its words.
 * Drawn in canvas units; the caller places and handles it.
 */
export function FixtureShape({ fixture, selected = false }: { fixture: FloorFixture; selected?: boolean }) {
  const { x, y, width: w, height: h, kind } = fixture;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const caption = fixtureCaption(fixture);
  const thin = isThinFixture(kind);

  const body = (() => {
    switch (kind) {
      case 'window':
        return (
          <>
            <rect x={x} y={y} width={w} height={h} rx={2} className="fill-card stroke-reference/35" strokeWidth={1.5} />
            <line x1={x + 2} y1={cy} x2={x + w - 2} y2={cy} className="stroke-reference/30" strokeWidth={1} />
          </>
        );
      case 'wall':
        return <rect x={x} y={y} width={w} height={h} rx={2} className="fill-foreground/45" />;
      case 'entrance':
      case 'door': {
        const tick = kind === 'entrance' ? 'stroke-primary/70' : 'stroke-muted-foreground/50';
        return (
          <>
            <rect x={x} y={y} width={w} height={h} className="fill-card" />
            <line x1={x} y1={cy} x2={x + w} y2={cy} className={tick} strokeWidth={2} strokeDasharray="6 6" />
            <line x1={x} y1={y - 6} x2={x} y2={y + h + 6} className={tick} strokeWidth={3} strokeLinecap="round" />
            <line x1={x + w} y1={y - 6} x2={x + w} y2={y + h + 6} className={tick} strokeWidth={3} strokeLinecap="round" />
          </>
        );
      }
      case 'bar':
      case 'counter':
        return <rect x={x} y={y} width={w} height={h} rx={Math.min(18, h / 2)} className="fill-band/70 stroke-border" strokeWidth={1.5} />;
      case 'stairs': {
        const along = w >= h;
        const length = along ? w : h;
        const steps = Math.max(0, Math.floor(length / 16) - 1);
        return (
          <>
            <rect x={x} y={y} width={w} height={h} rx={6} className="fill-band/50 stroke-border" strokeWidth={1.5} />
            {Array.from({ length: steps }, (_, index) => {
              const at = ((index + 1) * length) / (steps + 1);
              return along ? (
                <line key={index} x1={x + at} y1={y + 4} x2={x + at} y2={y + h - 4} className="stroke-border" strokeWidth={1} />
              ) : (
                <line key={index} x1={x + 4} y1={y + at} x2={x + w - 4} y2={y + at} className="stroke-border" strokeWidth={1} />
              );
            })}
          </>
        );
      }
      case 'kitchen':
      case 'toilets':
        return <rect x={x} y={y} width={w} height={h} rx={8} className="fill-band/50 stroke-border" strokeWidth={1.5} />;
      case 'pillar':
        return <rect x={x} y={y} width={w} height={h} rx={3} className="fill-foreground/12 stroke-foreground/20" strokeWidth={1.5} />;
      case 'plant':
        return (
          <>
            <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} className="fill-band/70 stroke-border" strokeWidth={1.5} />
            <ellipse cx={cx} cy={cy} rx={w / 5} ry={h / 5} className="fill-foreground/10" />
          </>
        );
      case 'label':
        // Invisible, but there to be tapped and dragged.
        return <rect x={x} y={y} width={w} height={h} rx={4} className="fill-transparent" />;
    }
  })();

  // Captions stay level whichever way the fixture turns.
  const size = kind === 'label' ? Math.max(12, Math.min(24, h * 0.7)) : 13;
  const chip = thin && caption;
  const chipWidth = caption ? caption.length * 7.4 + 14 : 0;

  return (
    <g>
      <g transform={fixture.rotation ? `rotate(${fixture.rotation} ${cx} ${cy})` : undefined}>
        {body}
        {selected && (
          <rect
            x={x - 5}
            y={y - 5}
            width={w + 10}
            height={h + 10}
            rx={6}
            className="fill-none stroke-primary"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        )}
      </g>
      {caption && (
        <g pointerEvents="none">
          {chip && <rect x={cx - chipWidth / 2} y={cy - 10} width={chipWidth} height={20} rx={4} className="fill-card" />}
          <text
            x={cx}
            y={cy + size * 0.35}
            textAnchor="middle"
            className={cn(
              'font-semibold',
              kind === 'label' ? 'fill-muted-foreground' : kind === 'entrance' ? 'fill-primary' : 'fill-muted-foreground/80',
            )}
            style={{ fontSize: size }}
          >
            {caption}
          </text>
        </g>
      )}
    </g>
  );
}
