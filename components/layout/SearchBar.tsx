'use client';

import { Search } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative flex-1 max-w-[480px]">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Search orders, roast profiles, or customers…"
        aria-label="Global search"
        className="w-full h-9 bg-surface-offset border border-transparent rounded-lg pl-9 pr-12 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150"
      />
      <kbd className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 bg-card border border-border rounded text-[10px] text-muted-foreground px-1.5 py-0.5 leading-none pointer-events-none font-mono">
        ⌘K
      </kbd>
    </div>
  );
}
