import { cn } from '@/lib/utils/cn';
import type { Customer } from '@/lib/api/customers.service';
import type { Tier } from '@/types/customers';

const TIER_CONFIG: Record<Tier, { label: string; className: string; dot: string }> = {
  vip: { label: 'VIP', className: 'bg-primary/10 text-primary', dot: 'bg-primary' },
  gold: { label: 'Gold', className: 'bg-warning/10 text-warning', dot: 'bg-warning' },
  silver: { label: 'Silver', className: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  bronze: { label: 'Bronze', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400', dot: 'bg-amber-500' },
};

function Initials({ firstName, lastName }: { firstName: string; lastName: string }) {
  return (
    <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-primary-hover flex items-center justify-center text-white text-sm font-bold shrink-0 select-none">
      {firstName[0]?.toUpperCase()}
      {lastName[0]?.toUpperCase()}
    </div>
  );
}

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
        'w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl border transition-colors duration-150',
        isSelected ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:border-primary/30 hover:bg-surface-offset',
      )}
    >
      <Initials firstName={customer.firstName} lastName={customer.lastName} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate leading-tight">
          {customer.firstName} {customer.lastName}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{customer.email ?? customer.phone}</p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide', tier.className)}>{tier.label}</span>
        <p className="text-xs font-semibold text-muted-foreground tabular-nums">{customer.pointsBalance.toLocaleString()} pts</p>
      </div>
    </button>
  );
}
