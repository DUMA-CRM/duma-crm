'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function LocationPicker() {
  const { tenantId, locationId, setLocationId } = useWorkspaceStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const current = locations.find((l) => l.id === locationId);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  if (!tenantId) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors',
          open ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-transparent text-foreground hover:bg-surface-offset',
        )}
      >
        <MapPin size={15} className={current ? 'text-primary' : 'text-muted-foreground'} aria-hidden="true" />
        <span className="hidden sm:inline max-w-[160px] truncate">{current ? current.name : 'No location'}</span>
        <ChevronDown
          size={14}
          className={cn('text-muted-foreground transition-transform duration-150', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-surface border border-border rounded-xl shadow-lg py-1 z-50">
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
      )}
    </div>
  );
}
