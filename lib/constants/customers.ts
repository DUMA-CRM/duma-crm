import { VariantProps } from 'class-variance-authority';

import { badgeVariants } from '@/components/ui/badge';

import { Tier } from '@/types/customers';


export const TIER_THRESHOLDS: Record<Tier, { from: number; to: number; nextTier: string; fromLabel: string }> = {
  bronze: { from: 0, to: 100, nextTier: 'Silver', fromLabel: 'None' },
  silver: { from: 100, to: 300, nextTier: 'Gold', fromLabel: 'Bronze' },
  gold: { from: 300, to: 800, nextTier: 'VIP', fromLabel: 'Silver' },
  vip: { from: 800, to: 2000, nextTier: 'Platinum', fromLabel: 'Gold' },
};

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

export const TIER_CONFIG: Record<Tier, { label: string; variant: BadgeVariant; dot: string }> = {
  vip: { label: 'VIP', variant: 'success', dot: 'bg-primary' },
  gold: { label: 'GOLD', variant: 'warning', dot: 'bg-warning' },
  silver: { label: 'SILVER', variant: 'muted', dot: 'bg-muted-foreground' },
  // `amber` is an alias of the measured/apricot variant, so the dot matches it
  // rather than reaching for Tailwind's own amber-500.
  bronze: { label: 'BRONZE', variant: 'amber', dot: 'bg-measured' },
};

export const TIER_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'vip', label: 'VIP' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'bronze', label: 'Bronze' },
] as const;
