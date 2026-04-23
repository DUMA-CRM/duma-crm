import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Badge } from '@/components/ui/badge';

import { TIER_CONFIG } from '@/lib/constants/customers';
import { cn } from '@/lib/utils/cn';
import type { Customer } from '@/types/customers';

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
        'w-full flex items-center gap-4 px-4 py-3 text-left rounded-xl border transition-colors duration-150',
        isSelected ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:border-primary/30 hover:bg-surface-offset',
      )}
    >
      <InitialsAvatar firstName={customer.firstName} lastName={customer.lastName} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate leading-tight">
          {customer.firstName} {customer.lastName}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{customer.email ?? customer.phone}</p>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <Badge variant={tier.variant}>{tier.label}</Badge>
        <p className="text-xs font-semibold text-muted-foreground tabular-nums">{customer.pointsBalance.toLocaleString()} pts</p>
      </div>
    </button>
  );
}
