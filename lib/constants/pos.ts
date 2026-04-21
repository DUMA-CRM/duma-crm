import type { Category } from '@/types/pos';

export const LOYALTY_DISCOUNT = 0.05;

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'coffee', label: 'Coffee' },
  { value: 'other-hot-drinks', label: 'Other Hot Drinks' },
  { value: 'coffee-over-ice', label: 'Coffee Over Ice' },
  { value: 'tea', label: 'Tea' },
  { value: 'snacks', label: 'Snacks' },
];
