'use client';

import { useId, useState } from 'react';

import { cn } from '@/lib/utils/cn';

export type ProductTab = { id: string; label: string; icon: React.ReactNode; panel: React.ReactNode };

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

      {/* The switcher: a soft grey tray on the frame's bottom edge; the open tab is a white pill. */}
      <div className="relative z-10 -mt-7 flex justify-center px-2">
        <div
          role="tablist"
          aria-label="Parts of DUMA"
          className="flex gap-1 overflow-x-auto rounded-full bg-[color-mix(in_oklab,var(--mkt-ground)_93%,#000)] p-1.5 shadow-[inset_0_1px_2px_rgb(32_55_45/0.06),0_8px_24px_-12px_rgb(32_55_45/0.25)]"
        >
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
                  'flex min-h-11 shrink-0 items-center gap-2.5 rounded-full px-5 text-base font-medium transition-[background-color,color,box-shadow] duration-200 sm:px-6 sm:text-[1.0625rem]',
                  selected ? 'bg-[var(--mkt-card)] text-[var(--mkt-heading)] shadow-[0_1px_3px_rgb(32_55_45/0.12),0_4px_12px_-4px_rgb(32_55_45/0.15)]' : 'text-[var(--mkt-ink-2)] hover:text-[var(--mkt-heading)]',
                )}
              >
                <span className={cn('[&_svg]:size-[1.15rem]', selected ? 'text-primary' : 'text-[var(--mkt-ink-2)]')}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
