export type Tier = 'vip' | 'gold' | 'silver' | 'bronze';
export type FilterOption = 'all' | Tier;

export interface Customer {
  id: string;
  tenantId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dob?: string;
  notes?: string;
  tier: Tier;
  pointsBalance: number;
  totalVisits: number;
  totalSpent: number;
  lastVisitAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomersResponse {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  tier?: Tier | 'all';
  tenantId?: string;
  phoneNumber?: string;
}

export interface CustomerPayload {
  tenantId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dob?: string;
  notes?: string;
}
