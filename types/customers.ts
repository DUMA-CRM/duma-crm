export type Tier = 'vip' | 'gold' | 'silver' | 'bronze';
export type FilterOption = 'all' | Tier;

// Re-export the canonical Customer type from the service layer
export type { Customer } from '@/lib/api/customers.service';
