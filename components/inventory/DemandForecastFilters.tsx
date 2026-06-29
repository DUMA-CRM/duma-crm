'use client';

import { ChevronDown, ListFilter, Search, X } from 'lucide-react';
import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

// ── Constants ─────────────────────────────────────────────────────────────────

export const LOOKBACK_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
];

export const selectClass = cn(
  'w-full h-9 bg-surface-offset border border-transparent rounded-lg px-3 pr-8 text-sm text-foreground',
  'outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
  'transition-[border-color,box-shadow] duration-150 appearance-none cursor-pointer',
);

// ── Types ─────────────────────────────────────────────────────────────────────

export type StatusFilter = 'all' | 'critical' | 'low' | 'ok';

// ── Props ─────────────────────────────────────────────────────────────────────

interface DemandForecastFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  filterLocationId: string;
  onLocationChange: (v: string) => void;
  lookbackDays: number;
  onLookbackChange: (v: number) => void;
  statusFilter: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  locations: { id: string; name: string }[];
  statusTabs: { value: StatusFilter; label: string; count: number }[];
  hasFilters: boolean;
  onClearAll: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DemandForecastFilters({
  search,
  onSearchChange,
  filterLocationId,
  onLocationChange,
  lookbackDays,
  onLookbackChange,
  statusFilter,
  onStatusChange,
  locations,
  statusTabs,
  hasFilters,
  onClearAll,
}: DemandForecastFiltersProps) {
  const activeFilterCount = [filterLocationId].filter(Boolean).length;
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-2 mb-6">
      <div className="flex items-center gap-2">
        <div className="w-72">
          <Input
            placeholder="Search items…"
            leftIcon={<Search size={14} />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            rightAction={
              search
                ? <button onClick={() => onSearchChange('')} className="text-muted-foreground hover:text-foreground transition-colors"><X size={14} /></button>
                : undefined
            }
          />
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors',
            showFilters || activeFilterCount > 0
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          <ListFilter size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {hasFilters && (
          <button onClick={onClearAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X size={12} /> Clear all
          </button>
        )}

        {/* Lookback selector */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Lookback period:</span>
          <div className="relative">
            <select
              value={lookbackDays}
              onChange={(e) => onLookbackChange(Number(e.target.value))}
              className={cn(selectClass, 'w-28')}
            >
              {LOOKBACK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div className="flex flex-col gap-1.5">
              <Label uppercase>Location</Label>
              <div className="relative">
                <select
                  value={filterLocationId}
                  onChange={(e) => onLocationChange(e.target.value)}
                  className={selectClass}
                >
                  <option value="">All locations</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex items-center gap-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onStatusChange(tab.value)}
            className={cn(
              'flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-colors',
              statusFilter === tab.value
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-offset',
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                'flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold',
                statusFilter === tab.value ? 'bg-background/20 text-background' : 'bg-surface-offset text-muted-foreground',
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
