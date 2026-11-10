'use client';

import { useId, useState } from 'react';

import { cn } from '@/lib/utils/cn';

export type ProductTab = {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** The domain colour the icon takes while its tab is selected (DESIGN.md's domain lanes). */
  tone?: keyof typeof ICON_TONE;
  panel: React.ReactNode;
};

// Written out in full so Tailwind sees every class.
const ICON_TONE = {
  action: 'text-primary',
  orders: 'text-measured',
  reference: 'text-reference',
  stock: 'text-stock',
  team: 'text-success',
} as const;

/**
 * The hero's product frame: one screen at a time, switched by a tab bar that
 * sits on the frame's bottom edge. Every panel is server-rendered into the
 * HTML (inactive ones `hidden`), so crawlers and no-JS readers get them all.
 */
export function ProductTabs({ tabs, children }: { tabs: ProductTab[]; children?: React.ReactNode }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const baseId = useId();

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    setActive(next.id);
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
  };

  return (
    <div className="relative">
      {children}
      <div className="mkt-card relative overflow-hidden">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={`${baseId}-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            hidden={tab.id !== active}
          >
            {tab.panel}
          </div>
        ))}
      </div>

      {/* The switcher on the frame's bottom edge, styled as Segmented (attached, compact corners); it keeps the tab roles Segmented's buttons don't have. */}
      <div className="relative z-10 -mt-7 flex justify-center px-2">
        <div role="tablist" aria-label="Parts of DUMA" className="mkt-card flex max-w-full gap-0.5 overflow-x-auto p-1">
          {tabs.map((tab, index) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                id={`${baseId}-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  // Pressed, the tab sinks a little and darkens; released, it springs back.
                  'flex min-h-11 shrink-0 items-center gap-2.5 rounded-[6px] px-4 text-base font-medium transition-[background-color,color,scale] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.96] active:bg-[color-mix(in_oklab,var(--ink)_10%,transparent)] motion-reduce:active:scale-100 sm:px-5',
                  selected
                    ? 'bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] text-[var(--mkt-heading)]'
                    : 'text-[var(--mkt-ink-2)] hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] hover:text-[var(--mkt-heading)]',
                )}
              >
                <span className={cn('transition-colors [&_svg]:size-[1.15rem]', selected ? ICON_TONE[tab.tone ?? 'action'] : 'text-[var(--mkt-ink-2)]')}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
