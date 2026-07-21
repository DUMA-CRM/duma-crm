'use client';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * In-page full-height editor shell (keeps the app sidebar + header visible).
 * Negative margins cancel the <main> padding so it fills the content area
 * edge-to-edge, with a sticky header (back + title + actions) over a scrollable
 * body. Shared by the menu item and modifier editors.
 */
export function EditorShell({
  eyebrow,
  title,
  onClose,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  onClose: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col -m-4 md:-m-8 h-[calc(100vh-var(--header-height))] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-3.5 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Back" className="size-11 shrink-0">
            <ArrowLeft size={20} />
          </Button>
          <div className="min-w-0">
            {eyebrow && <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{eyebrow}</p>}
            <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-8xl mx-auto p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
