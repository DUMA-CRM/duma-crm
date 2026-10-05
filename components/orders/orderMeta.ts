import { Bell, CheckCircle2, Clock, Flame, Monitor, QrCode, Smartphone, XCircle } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import type { SelectOption } from '@/components/ui/select';

import type { OrderSource, OrderStatus } from '@/lib/modules/ordering/client';

/*
 * How an order's status and channel read, everywhere on the orders screens.
 * The tints are the audit log's: a light role wash under role-coloured ink,
 * so a list of orders scans the way the rest of the back office does.
 */

export const STATUS_META: Record<OrderStatus, { label: string; tint: string; dot: string; ring: string; icon: IconComponent }> = {
  pending: { label: 'Pending', tint: 'bg-reference/8 text-reference', dot: 'bg-reference', ring: 'ring-reference/35', icon: Clock },
  preparing: { label: 'Preparing', tint: 'bg-measured/10 text-measured', dot: 'bg-measured', ring: 'ring-measured/40', icon: Flame },
  ready: { label: 'Ready', tint: 'bg-primary/8 text-primary', dot: 'bg-primary', ring: 'ring-primary/35', icon: Bell },
  done: { label: 'Done', tint: 'bg-momentum/8 text-momentum', dot: 'bg-momentum', ring: 'ring-momentum/35', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', tint: 'bg-exception/8 text-exception', dot: 'bg-exception', ring: 'ring-exception/35', icon: XCircle },
  expired: { label: 'Expired', tint: 'bg-band text-muted-foreground', dot: 'bg-muted-foreground/60', ring: 'ring-muted-foreground/30', icon: Clock },
};

/** Where an order came from, named the way a café says it. */
export const SOURCE_META: Record<OrderSource, { label: string; icon: IconComponent }> = {
  pos: { label: 'Counter', icon: Monitor },
  mobile: { label: 'Mobile', icon: Smartphone },
  qr_code: { label: 'QR table', icon: QrCode },
};

export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['done', 'cancelled'],
  done: [],
  cancelled: [],
  expired: [],
};

export const LIVE_STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready'];

export const VOID_REASON_OPTIONS: SelectOption[] = [
  { value: 'customer_request', label: 'Customer asked to cancel' },
  { value: 'duplicate', label: 'Duplicate order' },
  { value: 'payment_failed', label: 'Payment failed' },
  { value: 'item_unavailable', label: 'Item unavailable' },
  { value: 'staff_error', label: 'Entered by mistake' },
  { value: 'other', label: 'Other' },
];

export const REFUND_REASON_OPTIONS: SelectOption[] = [
  { value: 'customer_request', label: 'Customer request' },
  { value: 'item_issue', label: 'Problem with an item' },
  { value: 'service_issue', label: 'Service issue' },
  { value: 'duplicate_charge', label: 'Charged twice' },
  { value: 'pricing_error', label: 'Wrong price' },
  { value: 'other', label: 'Other' },
];

export const optionLabel = (options: SelectOption[], value: string) => options.find((option) => option.value === value)?.label ?? value;
