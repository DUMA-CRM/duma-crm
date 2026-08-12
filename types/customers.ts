export type Tier = 'vip' | 'gold' | 'silver' | 'bronze';
export type FilterOption = 'all' | Tier;

/** UK FSA allergen slugs — the same vocabulary as stock item allergens. */
export const FSA_ALLERGENS = [
  'celery',
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'lupin',
  'milk',
  'molluscs',
  'mustard',
  'nuts',
  'peanuts',
  'sesame',
  'soya',
  'sulphites',
] as const;
export type Allergen = (typeof FSA_ALLERGENS)[number];

export const DIETARY_PREFERENCES = [
  'vegan',
  'vegetarian',
  'pescatarian',
  'halal',
  'kosher',
  'gluten_free',
  'dairy_free',
  'low_calorie',
] as const;
export type DietaryPreference = (typeof DIETARY_PREFERENCES)[number];

export type AlertSeverity = 'info' | 'warning' | 'critical';

/** A pinned flag on a guest record. `critical` is do-not-serve / safeguarding. */
export interface CustomerAlert {
  severity: AlertSeverity;
  label: string;
  note?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dob?: string;
  marketingOptIn: boolean;
  marketingOptInAt?: string;
  emailUnsubscribedAt?: string;
  notes?: string;
  tier: Tier;
  pointsBalance: number;
  totalVisits: number;
  totalSpent: number;
  lastVisitAt?: string;
  createdAt: string;
  updatedAt: string;

  // Guest service facts — shown with weight, not buried in `notes`.
  allergies?: Allergen[] | null;
  dietary?: DietaryPreference[] | null;
  seatingPreference?: string | null;
  alerts?: CustomerAlert[] | null;

  // Set when this record was folded into another as a duplicate. Present on a
  // row only when the query asked for merged records (an exact phone lookup
  // does, so an old number still resolves).
  mergedIntoId?: string | null;
  mergedAt?: string | null;
  // Set when a GDPR erasure was fulfilled. Such rows are excluded from lists.
  anonymisedAt?: string | null;
}

export interface CustomersResponse {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const CUSTOMER_SORTS = ['recent', 'name', 'spend', 'visits', 'last_visit', 'points'] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];
export type SortDirection = 'asc' | 'desc';

/**
 * The filter block understood by both the customer list and a saved segment.
 *
 * Mirrors the API's filter schema exactly. Anything expressible here can be
 * saved as a segment and previewed, because the server runs one builder for
 * both — see src/lib/customer-filters.ts in duma-api.
 */
export interface CustomerFilters {
  search?: string;
  tier?: Tier;
  /** Visited once, but not in this many days. Excludes never-visited guests. */
  lapsedDays?: number;
  activeWithinDays?: number;
  neverVisited?: boolean;
  /** 1–12. */
  birthdayMonth?: number;
  marketing?: 'opted_in' | 'opted_out';
  minTotalSpent?: number;
  maxTotalSpent?: number;
  minTotalVisits?: number;
  maxTotalVisits?: number;
  allergies?: Allergen[];
  dietary?: DietaryPreference[];
  sort?: CustomerSort;
  direction?: SortDirection;
  includeMerged?: boolean;
}

export interface CustomersParams extends CustomerFilters {
  page?: number;
  limit?: number;
  tenantId?: string;
  /** Exact match. Distinct from `search`, which is fuzzy. */
  phoneNumber?: string;
}

// ── Loyalty ledger ──────────────────────────────────────────────────────────

export type LedgerSource = 'order' | 'manual' | 'reversal' | 'redemption' | 'opening' | 'merge' | 'expiry';

export interface LedgerEntry {
  id: string;
  customerId: string;
  delta: number;
  balanceAfter: number;
  source: LedgerSource;
  reason?: string | null;
  orderId?: string | null;
  actorUserId?: string | null;
  createdAt: string;
}

export interface LedgerResponse {
  data: LedgerEntry[];
  pointsBalance: number;
  ledgerTotal: number;
  /** False when the cached balance and the ledger disagree — worth surfacing. */
  reconciles: boolean;
}

// ── Timeline ────────────────────────────────────────────────────────────────

export type TimelineKind = 'order' | 'points' | 'email' | 'consent' | 'privacy';

export interface TimelineEntry {
  kind: TimelineKind;
  id: string;
  at: string;
  // order
  status?: string;
  total?: string;
  source?: string;
  paymentStatus?: string;
  refundStatus?: string;
  customerId?: string;
  // points
  delta?: number;
  balanceAfter?: number;
  reason?: string | null;
  actorUserId?: string | null;
  // email
  subject?: string;
  trigger?: string;
  toEmail?: string;
  // consent
  action?: string;
  // privacy
  type?: string;
  dueAt?: string;
}

export interface TimelineResponse {
  data: TimelineEntry[];
  /** Customer ids whose history is included — the record plus anything merged in. */
  group: string[];
}

// ── Duplicates ──────────────────────────────────────────────────────────────

export interface DuplicatePair {
  aId: string;
  aFirstName: string;
  aLastName: string;
  aEmail: string | null;
  aPhone: string;
  aTotalSpent: string;
  aTotalVisits: number;
  aLastVisitAt: string | null;
  bId: string;
  bFirstName: string;
  bLastName: string;
  bEmail: string | null;
  bPhone: string;
  bTotalSpent: string;
  bTotalVisits: number;
  bLastVisitAt: string | null;
  signal: 'email' | 'name';
}

// ── Segments ────────────────────────────────────────────────────────────────

export interface CustomerSegment {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  filters: CustomerFilters;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentEvaluation {
  total: number;
  /** Holds marketing consent AND an email address — the sendable audience. */
  emailReachable: number;
  sample: Customer[];
  evaluatedAt: string;
  /** Filter keys dropped because they no longer validate. */
  staleFilters?: string[];
}

export interface SegmentRecipients {
  data: { customerId: string; email: string; firstName: string; lastName: string }[];
  total: number;
  /** Selected by the segment but removed for lacking consent or an address. */
  excludedByConsent: number;
  evaluatedAt: string;
}

export interface CustomerPayload {
  tenantId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dob?: string;
  notes?: string;
  marketingOptIn?: boolean;
}

/**
 * Fields PATCH /customers/:id accepts.
 *
 * Separate from the create payload rather than a Partial of it: creating never
 * sets guest service facts (a new record is captured at speed with a guest
 * waiting), and consent is only ever changed through the marketing-preferences
 * endpoint, which records a source and a reason. Reusing one type would imply
 * both are editable here.
 */
export interface CustomerUpdatePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  dob?: string;
  notes?: string;
  /** An empty array clears the field — distinct from omitting the key. */
  allergies?: Allergen[];
  dietary?: DietaryPreference[];
  seatingPreference?: string | null;
  alerts?: CustomerAlert[];
}
