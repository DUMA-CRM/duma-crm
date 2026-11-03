'use client';

import { useReducedMotion } from 'motion/react';
import { createRef, useRef, useState } from 'react';

import { BarChart3, Calculator, Clock, Code, CreditCard, FileText, Gift, Package, Users } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';
import { AnimatedBeam } from '@/components/ui/animated-beam';

import type { Connections } from '@/lib/marketing/compare';
import { INTEGRATION_LOGOS } from '@/lib/marketing/integration-logos';
import { cn } from '@/lib/utils/cn';

const KIND_ICON = { card: CreditCard, file: FileText, api: Code } as const;
const UPDATE_ICON = { stock: Package, margin: Calculator, customers: Users, reports: BarChart3, rotas: Clock, loyalty: Gift } as const;

// SVG gradient stops take colours, not CSS variables: the brand green into apricot (DESIGN.md).
const BEAM = { gradientStartColor: '#2b7355', gradientStopColor: '#b84e2d', pathColor: '#20372d', pathOpacity: 0.12 } as const;

const NODE =
  'relative z-10 flex items-center gap-3 rounded-[12px] border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-3 py-2.5 shadow-[0_6px_16px_-10px_rgb(32_55_45/0.35)] sm:px-4 sm:py-3';
const TILE = 'grid size-9 shrink-0 place-items-center rounded-lg sm:size-10';

/**
 * Where a beam meets a card or the logo. AnimatedBeam joins the centres of the
 * two elements it is given, so the beams aim at these points on the inner
 * edges, not the middle of each card, where a line ran underneath and only
 * slivers of it showed between the cards.
 */
function Anchor({ ref, side }: { ref: React.Ref<HTMLSpanElement>; side: 'left' | 'right' }) {
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute top-1/2 -translate-y-1/2',
        side === 'left' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2',
        'size-0',
      )}
    />
  );
}

/**
 * The "use both" picture on a /compare page: the tools a business already has
 * on the left, beaming into DUMA, and what a sale in DUMA updates on the
 * right. Each source says how it connects, so a CSV import never reads as a
 * live sync. With reduced motion the beams are drawn once and stay still.
 *
 * No curvature: AnimatedBeam bends by lifting its control point, so a beam to
 * a node above the hub dipped below it first. Flat, each beam leaves its start
 * level and bends into its target, which fans cleanly on both sides. Beams run
 * edge to edge — card to the logo's side — through `Anchor`s.
 */
export function ConnectionBeams({ connections, className }: { connections: Connections; className?: string }) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const hubInRef = useRef<HTMLSpanElement>(null);
  const hubOutRef = useRef<HTMLSpanElement>(null);
  const [sourceRefs] = useState(() => connections.sources.map(() => createRef<HTMLSpanElement>()));
  const [updateRefs] = useState(() => connections.updates.map(() => createRef<HTMLSpanElement>()));
  const motion = reduceMotion ? { repeat: 0, duration: 0.01 } : { duration: 4 };

  return (
    <div
      ref={containerRef}
      className={cn('relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6 sm:gap-16 lg:gap-24', className)}
    >
      <ul className="flex flex-col gap-5" aria-label="What connects to DUMA">
        {connections.sources.map((source, index) => {
          const brand = source.logo ? INTEGRATION_LOGOS.find((logo) => logo.name === source.logo) : undefined;
          const Icon = KIND_ICON[source.kind];
          return (
            <li key={source.name}>
              <div className={NODE}>
                <Anchor ref={sourceRefs[index]} side="right" />
                {brand ? (
                  <span className={cn(TILE, 'text-white')} style={{ background: brand.background }} aria-hidden="true">
                    {brand.path ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
                        <path d={brand.path} />
                      </svg>
                    ) : (
                      <span className="text-[9px] font-bold tracking-tight">{brand.name}</span>
                    )}
                  </span>
                ) : (
                  <span className={cn(TILE, 'bg-[var(--mkt-ground)] text-[var(--mkt-ink-2)]')} aria-hidden="true">
                    <Icon className="size-5" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold sm:text-[0.9375rem]">{source.name}</span>
                  <span className="block truncate text-xs text-[var(--mkt-ink-3)]">{source.how}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* The logo alone, no frame: it is the hub every beam runs through. */}
      <div className="relative z-10">
        <Anchor ref={hubInRef} side="left" />
        <Anchor ref={hubOutRef} side="right" />
        <Logo size={72} className="size-14 rounded-[19.4%] shadow-[0_12px_28px_-12px_rgb(32_55_45/0.55)] sm:size-[72px]" />
        <span className="sr-only">DUMA</span>
      </div>

      <ul className="flex flex-col gap-3" aria-label="What a sale in DUMA updates">
        {connections.updates.map((update, index) => {
          const Icon = UPDATE_ICON[update.icon];
          return (
            <li key={update.label}>
              <div className={NODE}>
                <Anchor ref={updateRefs[index]} side="left" />
                <span className={cn(TILE, 'bg-primary/10 text-primary')} aria-hidden="true">
                  <Icon className="size-5" />
                </span>
                <span className="truncate text-sm font-semibold sm:text-[0.9375rem]">{update.label}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {sourceRefs.map((ref, index) => (
        <AnimatedBeam
          key={`in-${index}`}
          containerRef={containerRef}
          fromRef={ref}
          toRef={hubInRef}
          delay={index * 0.4}
          {...BEAM}
          {...motion}
        />
      ))}
      {updateRefs.map((ref, index) => (
        <AnimatedBeam
          key={`out-${index}`}
          containerRef={containerRef}
          fromRef={hubOutRef}
          toRef={ref}
          delay={1.2 + index * 0.3}
          {...BEAM}
          {...motion}
        />
      ))}
    </div>
  );
}
