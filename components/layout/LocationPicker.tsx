'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function LocationPicker({ align = 'right', sidebar = false }: { align?: 'left' | 'right'; sidebar?: boolean }) {
  const { tenantId, locationId, setLocationId } = useWorkspaceStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // In sidebar mode the menu is rendered in a portal on <body> and positioned
  // with `fixed`, so it escapes the sidebar's overflow clipping and narrow
  // width (the sidebar's transform would otherwise trap a plain fixed child).
  const [fixedPos, setFixedPos] = useState<{ left: number; bottom: number } | null>(null);

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const current = locations.find((l) => l.id === locationId);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      // The sidebar menu lives in a portal outside `ref`, so check it too.
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function toggle() {
    if (!open && sidebar && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setFixedPos({ left: r.left, bottom: window.innerHeight - r.top + 6 });
    }
    setOpen((v) => !v);
  }

  if (!tenantId) return null;

  return (
    <div
      ref={ref}
      className={cn('relative', sidebar && 'w-full')}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors',
          sidebar && 'w-full',
          open ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-transparent text-foreground hover:bg-surface-offset',
        )}
      >
        <MapPin size={15} className={cn('shrink-0', current ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
        <span className={cn('truncate', sidebar ? 'flex-1 text-left' : 'max-w-40')}>{current ? current.name : 'No location'}</span>
        <ChevronDown
          size={14}
          className={cn('text-muted-foreground transition-transform duration-150 shrink-0', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && menu()}
    </div>
  );

  function menu() {
    const content = (
      <div
        ref={menuRef}
        style={sidebar && fixedPos ? { position: 'fixed', left: fixedPos.left, bottom: fixedPos.bottom } : undefined}
        className={cn(
          'w-56 bg-surface border border-border rounded-xl shadow-lg py-1 z-50',
          sidebar ? 'max-h-80 overflow-y-auto' : cn('absolute top-full mt-1.5', align === 'right' ? 'right-0' : 'left-0'),
        )}
      >
        <p className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</p>

        {/* No location option */}
        <button
          onClick={() => {
            setLocationId(null);
            setOpen(false);
          }}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-surface-offset',
            !locationId ? 'text-foreground font-medium' : 'text-muted-foreground',
          )}
        >
          <span>No location</span>
          {!locationId && <Check size={14} className="text-primary shrink-0" aria-hidden="true" />}
        </button>

        {locations.length > 0 && <div className="my-1 h-px bg-divider mx-3" aria-hidden="true" />}

        {locations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => {
              setLocationId(loc.id);
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-surface-offset',
              loc.id === locationId ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
          >
            <span className="truncate">{loc.name}</span>
            {loc.id === locationId && <Check size={14} className="text-primary shrink-0" aria-hidden="true" />}
          </button>
        ))}

        {locations.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No locations for this tenant.</p>}
      </div>
    );

    // Sidebar mode: portal to <body> so the sidebar's transform/overflow can't
    // trap or clip the fixed-positioned menu. Header mode stays inline.
    return sidebar && typeof document !== 'undefined' ? createPortal(content, document.body) : content;
  }
}
