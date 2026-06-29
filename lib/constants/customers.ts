import { VariantProps } from 'class-variance-authority';

import { badgeVariants } from '@/components/ui/badge';

import { Tier } from '@/types/customers';

import { OrderStatus } from '../api/orders.service';

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
  bronze: { label: 'BRONZE', variant: 'amber', dot: 'bg-amber-500' },
};

export const TIER_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'vip', label: 'VIP' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'bronze', label: 'Bronze' },
] as const;

export const PANEL_TIER_CONFIG: Record<
  Tier,
  {
    label: string;
    variant: BadgeVariant;
    progressFrom: string;
    progressTo: string;
    progressPct: number;
    nextTier: string;
    ptsToNext: number;
  }
> = {
  vip: {
    label: 'VIP',
    variant: 'success',
    progressFrom: 'Gold',
    progressTo: 'Platinum',
    progressPct: 72,
    nextTier: 'Platinum',
    ptsToNext: 750,
  },
  gold: {
    label: 'GOLD',
    variant: 'warning',
    progressFrom: 'Silver',
    progressTo: 'VIP',
    progressPct: 45,
    nextTier: 'VIP',
    ptsToNext: 500,
  },
  silver: {
    label: 'SILVER',
    variant: 'muted',
    progressFrom: 'Bronze',
    progressTo: 'Gold',
    progressPct: 30,
    nextTier: 'Gold',
    ptsToNext: 200,
  },
  bronze: {
    label: 'BRONZE',
    variant: 'amber',
    progressFrom: 'None',
    progressTo: 'Silver',
    progressPct: 15,
    nextTier: 'Silver',
    ptsToNext: 100,
  },
};

export const STATUS_CONFIG: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pending', variant: 'muted' },
  preparing: { label: 'Preparing', variant: 'warning' },
  ready: { label: 'Ready', variant: 'primary' },
  done: { label: 'Done', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};
