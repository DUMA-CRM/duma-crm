export type Tier = 'vip' | 'gold' | 'silver' | 'bronze';
export type OrderStatus = 'pending' | 'ready' | 'done' | 'cancelled';
export type FilterOption = 'all' | Tier;

export interface Visit {
  date: string; // 'YYYY-MM-DD'
  spend: number;
}

export interface RecentOrder {
  id: string;
  items: string;
  total: number;
  date: string;
  status: OrderStatus;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: Tier;
  loyaltyPoints: number;
  totalSpent: number;
  totalOrders: number;
  lastVisit: string;
  joinedAt: string;
  avatar: string;
  visits: Visit[];
  tags: string[];
  recentOrders: RecentOrder[];
}
