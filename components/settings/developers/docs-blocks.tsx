'use client';

import { useEffect, useState } from 'react';

import { copyText } from '@/components/cms/shared';
import { CopyGlyph } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';

import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';

// What the Developers page still shares from the old in-app API reference: the
// API origin and a copy button. The reference itself lives in the public docs.

export const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777';

/** A copy button that confirms in place for a moment. */
export function DocCopyButton({
  text,
  label,
  variant = 'ghost',
  className,
  children,
}: {
  text: string;
  label: string;
  variant?: 'ghost' | 'outline' | 'default';
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant={variant}
      size={children ? 'sm' : 'icon-sm'}
      className={cn(!children && 'text-muted-foreground', className)}
      aria-label={children ? undefined : `Copy ${label}`}
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) setCopied(true);
        else toast('error', 'Copy failed — select the text instead.');
      }}
    >
      <CopyGlyph copied={copied} className={children ? 'size-3.5' : 'size-4'} />
      {children && (copied ? 'Copied' : children)}
    </Button>
  );
}
