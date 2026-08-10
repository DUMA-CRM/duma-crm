import { Check, Copy } from '@/components/icons';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  /** Omit or leave empty for a record that has no value yet — the row says so rather than rendering blank. */
  value?: string | null;
  /** Muted second line under the value, e.g. the relationship behind a phone number. */
  hint?: string;
  copyable?: boolean;
  missingLabel?: string;
}

interface InfoGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function InfoGroup({ children, className }: InfoGroupProps) {
  return <div className={cn('bg-background rounded-sm border border-rule px-3 py-1', className)}>{children}</div>;
}

export function InfoRow({ icon: Icon, label, value, hint, copyable = false, missingLabel = 'Not set' }: InfoRowProps) {
  const [copied, setCopied] = useState(false);
  const empty = value === undefined || value === null || value === '';

  const handleCopy = async () => {
    if (empty) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-rule last:border-0">
      <div className="size-9 rounded-sm bg-muted flex items-center justify-center shrink-0">
        <Icon size={15} className="text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro leading-none mb-0.5">{label}</p>
        <p className={cn('text-sm truncate', empty ? 'text-muted-foreground' : 'text-foreground')}>{empty ? missingLabel : value}</p>
        {hint && <p className="text-xs text-muted-foreground truncate">{hint}</p>}
      </div>

      {/* Nothing to copy from an empty record. */}
      {copyable && !empty && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : `Copy ${label}`}
          className="shrink-0 w-9 h-9 -my-1 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
        </button>
      )}
    </div>
  );
}
