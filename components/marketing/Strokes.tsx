/**
 * The long chalk curves that frame the hero and the quieter sections: a wide
 * graphite stroke in warm grey, grained by an SVG noise filter and fading out
 * at both ends, so it reads as drawn on the paper rather than placed on it.
 * `id` keeps each instance's filter and gradient ids unique on the page.
 */
const CURVES = {
  // Down from the top, bowing out to the right, sweeping back off the left edge.
  left: { d: 'M262 0 C 330 120 382 262 362 384 C 340 524 236 624 0 690', fade: { x1: 260, y1: 0, x2: 0, y2: 690, end: 0 }, width: 24 },
  // In from the top right, down into a deep loop and back out to the right.
  right: { d: 'M800 18 C 600 120 330 330 238 560 C 196 682 262 790 420 770 C 560 752 700 652 800 560', fade: { x1: 800, y1: 18, x2: 238, y2: 760, end: 1 }, width: 22 },
} as const;

export function ChalkCurve({ side, id, className }: { side: keyof typeof CURVES; id: string; className?: string }) {
  const curve = CURVES[side];
  return (
    <svg viewBox="0 0 800 800" fill="none" aria-hidden="true" className={className}>
      <defs>
        <filter id={`${id}-grain`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={side === 'left' ? 3 : 7} result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.6" result="speckle" />
          <feComposite in="SourceGraphic" in2="speckle" operator="in" />
        </filter>
        <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1={curve.fade.x1} y1={curve.fade.y1} x2={curve.fade.x2} y2={curve.fade.y2}>
          <stop offset="0" stopColor="var(--mkt-chalk)" stopOpacity="0" />
          <stop offset="0.18" stopColor="var(--mkt-chalk)" />
          <stop offset="0.82" stopColor="var(--mkt-chalk)" />
          <stop offset="1" stopColor="var(--mkt-chalk)" stopOpacity={curve.fade.end} />
        </linearGradient>
      </defs>
      <path d={curve.d} stroke={`url(#${id}-fade)`} strokeWidth={curve.width} strokeLinecap="round" filter={`url(#${id}-grain)`} />
    </svg>
  );
}

type Mark = { from: [number, number]; to: [number, number]; kind: 'pencil' | 'accent' | 'smudge'; width?: number };

/**
 * Four corner clusters for a centred section, after seline.com's setup band:
 * thin graphite lines, a thin brand-green line or two, and wide chalk smudges,
 * each cluster in its own coordinate box so its angles and spacing hold at any
 * size.
 */
const CORNERS: Record<'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight', { box: [number, number]; marks: Mark[] }> = {
  topLeft: {
    box: [1080, 462],
    marks: [
      { from: [40, 120], to: [285, 330], kind: 'smudge', width: 62 },
      { from: [432, 48], to: [540, 205], kind: 'smudge', width: 54 },
      { from: [308, 18], to: [420, 158], kind: 'pencil' },
      { from: [117, 347], to: [253, 443], kind: 'pencil' },
      { from: [1032, 83], to: [1054, 195], kind: 'accent' },
    ],
  },
  topRight: {
    box: [932, 810],
    marks: [
      { from: [355, 765], to: [895, 365], kind: 'smudge', width: 72 },
      { from: [28, 218], to: [216, 15], kind: 'pencil' },
      { from: [206, 733], to: [662, 343], kind: 'accent' },
    ],
  },
  bottomLeft: {
    box: [999, 1679],
    marks: [
      { from: [548, 1618], to: [948, 1225], kind: 'smudge', width: 76 },
      { from: [228, 75], to: [493, 25], kind: 'accent' },
      { from: [40, 298], to: [406, 185], kind: 'accent' },
      { from: [689, 1266], to: [879, 1102], kind: 'pencil' },
    ],
  },
  bottomRight: {
    box: [1080, 1233],
    marks: [
      { from: [500, 635], to: [910, 835], kind: 'smudge', width: 60 },
      { from: [490, 865], to: [710, 1045], kind: 'smudge', width: 56 },
      { from: [798, 63], to: [1061, 22], kind: 'pencil' },
      { from: [507, 1033], to: [684, 1218], kind: 'pencil' },
      { from: [16, 980], to: [93, 1130], kind: 'accent' },
    ],
  },
};

const MARK_STROKE = {
  pencil: 'color-mix(in oklab, var(--ink) 80%, transparent)',
  accent: 'var(--success)',
  smudge: 'var(--mkt-chalk)',
} as const;

function CornerCluster({ corner, className }: { corner: keyof typeof CORNERS; className: string }) {
  const { box, marks } = CORNERS[corner];
  const grain = `corner-${corner}-grain`;
  return (
    <svg viewBox={`0 0 ${box[0]} ${box[1]}`} fill="none" className={className}>
      <defs>
        <filter id={grain} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={corner.length} result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 1.5" result="speckle" />
          <feComposite in="SourceGraphic" in2="speckle" operator="in" />
        </filter>
      </defs>
      {marks.map((mark, index) => (
        <line
          key={index}
          x1={mark.from[0]}
          y1={mark.from[1]}
          x2={mark.to[0]}
          y2={mark.to[1]}
          stroke={MARK_STROKE[mark.kind]}
          strokeWidth={mark.kind === 'smudge' ? mark.width : mark.kind === 'accent' ? 4.5 : 4}
          strokeLinecap="round"
          filter={mark.kind === 'smudge' ? `url(#${grain})` : undefined}
        />
      ))}
    </svg>
  );
}

/**
 * All four corner clusters, pinned to the corners of a centred box a little
 * wider than the reading column — close to the section's content rather than
 * out at the screen's edges. Wide screens only.
 */
export function CornerStrokes() {
  return (
    <div className="mkt-strokes mx-auto hidden max-w-[76rem] lg:block" aria-hidden="true">
      <CornerCluster corner="topLeft" className="absolute top-6 left-0 w-[26rem]" />
      <CornerCluster corner="topRight" className="absolute top-4 right-0 w-[19rem]" />
      <CornerCluster corner="bottomLeft" className="absolute bottom-0 left-4 w-[15rem]" />
      <CornerCluster corner="bottomRight" className="absolute right-6 bottom-0 w-[22rem]" />
    </div>
  );
}

/**
 * Three hand-drawn waves rising to the top right, each ending in an open
 * arrowhead — after seline.com's closing card. The periwinkle one runs out
 * over its container's corner, so the card around it must not clip. `id`
 * keeps the filter and marker ids unique on the page.
 */
export function RisingLines({ id }: { id: string }) {
  return (
    <div className="relative aspect-[775/524] w-full" aria-hidden="true">
      <svg viewBox="0 0 775 524" className="absolute inset-0 size-full overflow-visible" fill="none">
        <defs>
          <filter id={`${id}-crayon`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" seed="4" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.7" result="grain" />
            <feComposite in="SourceGraphic" in2="grain" operator="in" />
          </filter>
          {(['reference', 'brand', 'measured'] as const).map((tone) => (
            <marker key={tone} id={`${id}-arrow-${tone}`} viewBox="0 0 12 12" refX="8" refY="6" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M1.5 1.5 8.5 6 1.5 10.5" stroke={`var(--${tone})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          ))}
        </defs>
        <g filter={`url(#${id}-crayon)`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M-70 520 C -40 470, -10 520, 10 505 C 50 450, 90 405, 125 410 C 170 415, 210 470, 245 445 C 285 415, 300 300, 340 230 C 370 175, 410 120, 450 140 C 500 165, 540 60, 590 45 C 630 35, 640 95, 680 80 C 720 65, 740 0, 790 -50 C 830 -90, 860 -130, 900 -170"
            stroke="var(--reference)"
            markerEnd={`url(#${id}-arrow-reference)`}
          />
          <path
            d="M0 560 C 30 545, 50 530, 70 505 C 120 380, 170 300, 220 250 C 270 200, 320 90, 380 100 C 430 110, 420 230, 470 260 C 520 290, 600 200, 650 170 C 700 140, 740 112, 785 94"
            stroke="var(--brand)"
            markerEnd={`url(#${id}-arrow-brand)`}
          />
          <path
            d="M270 560 C 310 540, 335 530, 360 505 C 400 430, 440 440, 470 455 C 510 470, 540 360, 590 320 C 630 290, 660 300, 690 280 C 730 255, 760 222, 790 190"
            stroke="var(--measured)"
            markerEnd={`url(#${id}-arrow-measured)`}
          />
        </g>
      </svg>
    </div>
  );
}
