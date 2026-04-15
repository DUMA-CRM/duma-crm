import { cn } from '@/lib/utils/cn';
import type { Customer, Tier } from '@/types/customers';

const TIER_CONFIG: Record<Tier, { label: string; className: string }> = {
  vip: { label: 'VIP Tier', className: 'bg-primary/10 text-primary' },
  gold: { label: 'Gold Tier', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  silver: { label: 'Silver Tier', className: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400' },
  bronze: { label: 'Bronze Tier', className: 'bg-amber-200 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
};

interface CustomerRowProps {
  customer: Customer;
  isSelected: boolean;
  onSelect: (c: Customer) => void;
}

export function CustomerRow({ customer, isSelected, onSelect }: CustomerRowProps) {
  const tier = TIER_CONFIG[customer.tier];

  return (
    <button
      onClick={() => onSelect(customer)}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
        'active:bg-muted/60',
        isSelected ? 'bg-primary/8 border-r-2 border-primary' : 'hover:bg-muted/40 border-r-2 border-transparent',
      )}
    >
      {/* Avatar */}
      <img src={customer.avatar} alt={customer.name} className="w-10 h-10 rounded-full shrink-0" />

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate leading-tight">{customer.name}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{customer.email}</p>
      </div>

      {/* Tier badge + spend */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide', tier.className)}>{tier.label}</span>
        <p className="text-xs font-semibold text-muted-foreground tabular-nums">₴{customer.totalSpent.toLocaleString()}</p>
      </div>
    </button>
  );
}
