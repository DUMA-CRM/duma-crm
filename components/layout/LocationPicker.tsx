'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ArrowRight, Check, ChevronDown, MapPin, Search } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';

import { type Location, getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Long lists earn a filter; a three-site franchise does not.
const FILTER_THRESHOLD = 7;
// Widen past the collapsed rail so the menu is readable from either trigger.
const MIN_MENU_WIDTH = 232;

interface MenuPosition {
  left: number;
  bottom: number;
  width: number;
  maxHeight: number;
}

/**
 * Location scope, anchored in the sidebar footer. `null` means "all locations
 * you can access" — a real scope, not an unset field, so it reads as an option
 * rather than an error. Adapts to the collapsed rail; the menu opens upward
 * through a portal so the sidebar's transform and overflow can't trap it.
 */
export function LocationPicker() {
  const { tenantId, locationId, setLocationId } = useWorkspaceStore();
  const { collapsed } = useSidebarStore();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const current = locations.find((l) => l.id === locationId);
  const label = current ? current.name : 'All locations';
  const showFilter = locations.length > FILTER_THRESHOLD;

  // `null` is the all-locations option. It drops out while filtering — typing a
  // name means you want one site.
  const options = useMemo<(Location | null)[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [null, ...locations];
    return locations.filter((l) => `${l.name} ${l.address}`.toLowerCase().includes(q));
  }, [locations, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }, []);

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, MIN_MENU_WIDTH);
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      bottom: window.innerHeight - rect.top + 8,
      width,
      maxHeight: Math.max(160, rect.top - 16),
    });
  }, []);

  function toggle() {
    if (open) {
      close();
      return;
    }
    measure();
    setActiveIndex(Math.max(0, locations.findIndex((l) => l.id === locationId) + 1));
    setOpen(true);
  }

  // Close on outside pointerdown. The menu is portalled outside the trigger's
  // subtree, so both roots have to be checked.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // The footer doesn't scroll, but a resize or a sidebar collapse moves it.
  useEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, collapsed, measure]);

  // Move focus into the menu so the arrow keys land somewhere sensible.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => menuRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function select(option: Location | null) {
    setLocationId(option?.id ?? null);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.stopPropagation();
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (options.length ? (i + 1) % options.length : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (options.length ? (i - 1 + options.length) % options.length : 0));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(Math.max(0, options.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex < options.length) select(options[activeIndex]);
        break;
    }
  }

  return (
    <>
      {collapsed ? (
        <Tooltip label={`Location: ${label}`} className="mx-auto">
          <button
            ref={triggerRef}
            onClick={toggle}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Location: ${label}`}
            className={cn(
              'relative w-9 h-9 flex items-center justify-center rounded-md transition-colors duration-150',
              open
                ? 'bg-sidebar-accent text-sidebar-foreground'
                : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            <MapPin size={18} aria-hidden="true" className="shrink-0" />
            {/* Rail can't show the name, so mark that the scope is narrowed. */}
            {current && (
              <span
                aria-hidden="true"
                className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-sidebar-primary ring-2 ring-sidebar"
              />
            )}
          </button>
        </Tooltip>
      ) : (
        <button
          ref={triggerRef}
          onClick={toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'w-[calc(100%-24px)] mx-3 flex items-center gap-2.5 px-3 py-1.75 rounded-md border text-left',
            'transition-colors duration-150',
            open
              ? 'border-sidebar-ring/60 bg-sidebar-accent text-sidebar-foreground'
              : 'border-sidebar-border bg-sidebar-accent/70 text-sidebar-foreground hover:bg-sidebar-accent hover:border-sidebar-ring/40',
          )}
        >
          <MapPin size={18} aria-hidden="true" className="shrink-0 text-sidebar-foreground/70" />
          <span className="min-w-0 flex-1">
            <span className="block text-micro font-semibold uppercase tracking-micro text-sidebar-foreground/55 leading-none">
              Location
            </span>
            <span className="block truncate text-sm font-medium leading-tight mt-0.5">{label}</span>
          </span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cn('shrink-0 text-sidebar-foreground/55 transition-transform duration-150', open && 'rotate-180')}
          />
        </button>
      )}

      {open && position && menu(position)}
    </>
  );

  function menu(pos: MenuPosition) {
    optionRefs.current = [];

    const content = (
      <div
        ref={menuRef}
        role="listbox"
        aria-label="Location"
        aria-activedescendant={options.length ? `location-option-${activeIndex}` : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{ position: 'fixed', left: pos.left, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight }}
        className={cn(
          'z-50 flex flex-col overflow-hidden outline-none',
          'bg-surface border border-rule rounded-md shadow-lg',
          'animate-in fade-in slide-in-from-bottom-1 duration-150',
        )}
      >
        <div className="flex items-baseline justify-between gap-2 px-3 pt-2.5 pb-1.5 shrink-0">
          <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Location scope</p>
          {locations.length > 0 && (
            <span data-figure className="text-micro text-muted-foreground">
              {locations.length}
            </span>
          )}
        </div>

        {showFilter && (
          <div className="relative px-3 pb-2 shrink-0">
            <Search size={13} aria-hidden="true" className="absolute left-5.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder="Filter locations"
              aria-label="Filter locations"
              className="w-full h-8 pl-7 pr-2 rounded-sm bg-background border border-rule text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        )}

        <div className="overflow-y-auto pb-1">
          {options.map((option, index) => {
            const selected = option ? option.id === locationId : !locationId;
            const isActive = index === activeIndex;

            return (
              <button
                key={option?.id ?? '__all__'}
                id={`location-option-${index}`}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                role="option"
                aria-selected={selected}
                onClick={() => select(option)}
                onPointerEnter={() => setActiveIndex(index)}
                className={cn('w-full flex items-start gap-2 px-3 py-2 text-left transition-colors', isActive && 'bg-band')}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={cn('truncate text-sm', selected ? 'font-medium text-foreground' : 'text-foreground/85')}>
                      {option ? option.name : 'All locations'}
                    </span>
                    {option && !option.isActive && (
                      <span className="shrink-0 text-micro font-semibold uppercase tracking-micro text-muted-foreground">Inactive</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground mt-0.5">
                    {option ? option.address : 'Every site you can access'}
                  </span>
                </span>
                {selected && <Check size={14} aria-hidden="true" className="mt-1 shrink-0 text-primary" />}
              </button>
            );
          })}

          {options.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">No location matches “{query.trim()}”.</p>}
        </div>

        {/* Super admins aren't bound to a tenant, so there are no locations to
            scope to until they pick a workspace. Say so, and offer the way there. */}
        {!tenantId ? (
          <Link
            href="/settings/workspaces"
            onClick={close}
            className="flex items-center justify-between gap-2 px-3 py-2.5 border-t border-rule text-xs text-muted-foreground hover:bg-band transition-colors shrink-0"
          >
            No workspace selected — choose one
            <ArrowRight size={13} aria-hidden="true" className="shrink-0 text-primary" />
          </Link>
        ) : (
          locations.length === 0 && (
            <p className="px-3 py-2.5 border-t border-rule text-xs text-muted-foreground shrink-0">No locations in this workspace.</p>
          )
        )}
      </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
  }
}
