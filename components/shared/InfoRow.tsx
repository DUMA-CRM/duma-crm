import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  copyable?: boolean;
}

interface InfoGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function InfoGroup({ children, className }: InfoGroupProps) {
  return <div className={cn('bg-background rounded-2xl border border-border px-3 py-1', className)}>{children}</div>;
}

export function InfoRow({ icon: Icon, label, value, copyable = false }: InfoRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon size={13} className="text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-0.5">{label}</p>
        <p className="text-sm text-foreground truncate">{value}</p>
      </div>

      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : `Copy ${label}`}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
        </button>
      )}
    </div>
  );
}
