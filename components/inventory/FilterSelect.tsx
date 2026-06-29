'use client';

import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

// ── Shared select class (duplicated here so FilterSelect is standalone) ────────

const selectClass = cn(
  'w-full h-9 bg-surface-offset border border-transparent rounded-lg px-3 pr-8 text-sm text-foreground',
  'outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
  'transition-[border-color,box-shadow] duration-150 appearance-none cursor-pointer',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FilterSelectProps {
  value: string;
  onChange: (v: string) => void;
  label: string;
  active: boolean;
  children: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FilterSelect({ value, onChange, children }: FilterSelectProps) {
  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
