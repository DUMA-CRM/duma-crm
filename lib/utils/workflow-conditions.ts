// ---------------------------------------------------------------------------
// A workflow condition, in people's words: which fact it checks, the
// comparisons that make sense for that fact, and — where the API stores a
// fixed set — the real values to pick from. The API compares equality as
// exact text (`String(actual) === String(expected)`), so a typed "Gold" would
// never match a stored "gold": choices are offered wherever they exist.
// Values mirror duma-api (customer-filters tier enum, orders status /
// paymentMethod, hr-employees employmentType).
// ---------------------------------------------------------------------------

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'contains'
  | 'is_empty'
  | 'is_not_empty';

export type ConditionKind = 'yesno' | 'choice' | 'number' | 'money' | 'location' | 'text';

export interface ConditionField {
  field: string;
  label: string;
  group: 'Customer' | 'Order' | 'Employee' | 'Booking' | 'Stock';
  kind: ConditionKind;
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** How a yes/no or a place reads in a sentence, both ways round. */
  phrase?: { yes: string; no: string };
}

export const CONDITION_FIELDS: readonly ConditionField[] = [
  { field: 'customer.email', label: 'Email address', group: 'Customer', kind: 'text' },
  { field: 'customer.totalSpent', label: 'Total spent', group: 'Customer', kind: 'money' },
  { field: 'customer.totalVisits', label: 'Total visits', group: 'Customer', kind: 'number' },
  { field: 'customer.daysSinceLastVisit', label: 'Days since last visit', group: 'Customer', kind: 'number' },
  { field: 'order.paymentStatus', label: 'Payment status', group: 'Order', kind: 'choice', options: [{ value: 'unpaid', label: 'Unpaid' }, { value: 'processing', label: 'Processing' }, { value: 'awaiting_payment', label: 'Awaiting payment' }, { value: 'awaiting_cash_approval', label: 'Awaiting cash approval' }, { value: 'paid', label: 'Paid' }, { value: 'failed', label: 'Failed' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'expired', label: 'Expired' }, { value: 'refunded', label: 'Refunded' }] },
  { field: 'order.source', label: 'Order source', group: 'Order', kind: 'choice', options: [{ value: 'pos', label: 'Pos' }, { value: 'mobile', label: 'Mobile' }, { value: 'qr_code', label: 'Qr code' }, { value: 'web', label: 'Web' }, { value: 'manual', label: 'Manual' }] },
  { field: 'order.fulfilmentType', label: 'Fulfilment type', group: 'Order', kind: 'choice', options: [{ value: 'collection', label: 'Collection' }, { value: 'delivery', label: 'Delivery' }, { value: 'shipping', label: 'Shipping' }] },
  { field: 'order.locationId', label: 'Order location', group: 'Order', kind: 'location' },
  { field: 'order.discountAmount', label: 'Discount amount', group: 'Order', kind: 'money' },
  { field: 'promotion.code', label: 'Promotion code', group: 'Order', kind: 'text' },
  { field: 'staff.department', label: 'Department', group: 'Employee', kind: 'text' },
  { field: 'staff.jobTitle', label: 'Job title', group: 'Employee', kind: 'text' },
  { field: 'booking.partySize', label: 'Party size', group: 'Booking', kind: 'number' },
  { field: 'booking.status', label: 'Booking status', group: 'Booking', kind: 'choice', options: [{ value: 'booked', label: 'Booked' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'seated', label: 'Seated' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'no_show', label: 'No show' }] },
  { field: 'booking.source', label: 'Booking source', group: 'Booking', kind: 'choice', options: [{ value: 'phone', label: 'Phone' }, { value: 'walk_in', label: 'Walk in' }, { value: 'online', label: 'Online' }, { value: 'other', label: 'Other' }] },
  { field: 'booking.locationId', label: 'Booking location', group: 'Booking', kind: 'location' },
  { field: 'booking.guestEmail', label: 'Guest email', group: 'Booking', kind: 'text' },
  { field: 'booking.hoursUntilStart', label: 'Hours until booking', group: 'Booking', kind: 'number' },
  { field: 'stock.name', label: 'Stock item name', group: 'Stock', kind: 'text' },
  { field: 'stock.quantity', label: 'Quantity remaining', group: 'Stock', kind: 'number' },
  { field: 'stock.threshold', label: 'Low-stock threshold', group: 'Stock', kind: 'number' },
  { field: 'stock.locationId', label: 'Stock location', group: 'Stock', kind: 'location' },

  {
    field: 'customer.marketingOptIn',
    label: 'Gets marketing emails',
    group: 'Customer',
    kind: 'yesno',
    phrase: { yes: 'gets marketing emails', no: 'doesn’t get marketing emails' },
  },
  {
    field: 'customer.tier',
    label: 'Loyalty tier',
    group: 'Customer',
    kind: 'choice',
    options: [
      { value: 'vip', label: 'VIP' },
      { value: 'gold', label: 'Gold' },
      { value: 'silver', label: 'Silver' },
      { value: 'bronze', label: 'Bronze' },
    ],
  },
  { field: 'customer.pointsBalance', label: 'Points balance', group: 'Customer', kind: 'number' },
  {
    field: 'order.status',
    label: 'Order status',
    group: 'Order',
    kind: 'choice',
    options: [
      { value: 'pending', label: 'New' },
      { value: 'preparing', label: 'Preparing' },
      { value: 'ready', label: 'Ready' },
      { value: 'done', label: 'Done' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'expired', label: 'Expired' },
    ],
  },
  { field: 'order.totalAmount', label: 'Order total', group: 'Order', kind: 'money' },
  {
    field: 'order.paymentMethod',
    label: 'Paid by',
    group: 'Order',
    kind: 'choice',
    options: [
      { value: 'card', label: 'Card' },
      { value: 'cash', label: 'Cash' },
      { value: 'stripe_online', label: 'Online (Stripe)' },
      { value: 'stripe_terminal', label: 'Stripe reader' },
      { value: 'sumup', label: 'SumUp' },
      { value: 'square', label: 'Square' },
      { value: 'manual_terminal', label: 'Card machine' },
      { value: 'bank_transfer', label: 'Bank transfer' },
      { value: 'custom', label: 'Other' },
    ],
  },
  {
    field: 'staff.employmentType',
    label: 'Employment type',
    group: 'Employee',
    kind: 'choice',
    options: [
      { value: 'full_time', label: 'Full time' },
      { value: 'part_time', label: 'Part time' },
      { value: 'contractor', label: 'Contractor' },
      { value: 'zero_hours', label: 'Zero hours' },
    ],
  },
  { field: 'staff.locationId', label: 'Works at', group: 'Employee', kind: 'location', phrase: { yes: 'works at', no: 'doesn’t work at' } },
  { field: 'staff.role', label: 'Access role', group: 'Employee', kind: 'text' },
];

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'is',
  not_equals: 'isn’t',
  greater_than: 'is more than',
  greater_than_or_equal: 'is at least',
  less_than: 'is less than',
  less_than_or_equal: 'is at most',
  contains: 'contains',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

/** The comparisons that make sense for a kind of fact — a yes/no is only ever "is". */
export function operatorsFor(kind: ConditionKind): ConditionOperator[] {
  if (kind === 'yesno') return ['equals'];
  if (kind === 'choice' || kind === 'location') return ['equals', 'not_equals'];
  if (kind === 'number' || kind === 'money')
    return ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'];
  return ['equals', 'not_equals', 'contains'];
}

export const conditionField = (field: string) => CONDITION_FIELDS.find((entry) => entry.field === field);

/** What a condition on `field` starts as: its first comparison and a value that can actually match. */
export function conditionDefaults(field: string): { operator: ConditionOperator; value: string | number | boolean } {
  const entry = conditionField(field);
  const kind = entry?.kind ?? 'text';
  const value = kind === 'yesno' ? true : kind === 'choice' ? (entry?.options?.[0]?.value ?? '') : kind === 'number' || kind === 'money' ? 0 : '';
  return { operator: operatorsFor(kind)[0]!, value };
}

/** Keep a comparison only if it suits the field; otherwise the field's first. */
export function validOperator(field: string, operator: string): ConditionOperator {
  const allowed = operatorsFor(conditionField(field)?.kind ?? 'text');
  return (allowed as string[]).includes(operator) ? (operator as ConditionOperator) : allowed[0]!;
}

/**
 * The condition as a sentence — "loyalty tier is Gold", "order total is at
 * least £20.00", "gets marketing emails" / "doesn't get marketing emails".
 * `money` formats an amount; `locationName` names a location id.
 */
export function conditionSentence(
  config: { field: string; operator: string; value: unknown },
  helpers: { money?: (amount: number) => string; locationName?: (id: string) => string | undefined } = {},
): string {
  const entry = conditionField(config.field);
  const label = (entry?.label ?? config.field).toLowerCase();
  const operator = OPERATOR_LABELS[config.operator as ConditionOperator] ?? config.operator;
  const raw = config.value;
  if (entry?.kind === 'yesno') {
    const yes = (raw === true || raw === 'true') === (config.operator !== 'not_equals');
    return yes ? (entry.phrase?.yes ?? label) : (entry.phrase?.no ?? `not ${label}`);
  }
  if (entry?.kind === 'location') {
    const place = raw === undefined || raw === null || String(raw) === '' ? '…' : (helpers.locationName?.(String(raw)) ?? 'a location');
    return `${config.operator === 'not_equals' ? (entry.phrase?.no ?? 'not at') : (entry.phrase?.yes ?? 'at')} ${place}`;
  }
  const blank = raw === undefined || raw === null || String(raw).trim() === '';
  let value = blank ? '…' : String(raw);
  if (!blank && entry?.kind === 'choice') value = entry.options?.find((option) => option.value === String(raw))?.label ?? value;
  if (!blank && entry?.kind === 'money' && helpers.money) value = helpers.money(Number(raw));
  return `${label} ${operator} ${value}`;
}
