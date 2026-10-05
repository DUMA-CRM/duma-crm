import { Coins, type IconComponent, Mail, ShieldCheck, ShoppingBag } from '@/components/icons';

import type { TimelineKind } from '@/types/customers';

/** Shared by the feed and its drawer, so a row and the detail it opens carry the same tile. */
export const TIMELINE_KINDS: { value: TimelineKind; label: string }[] = [
  { value: 'order', label: 'Orders' },
  { value: 'points', label: 'Points' },
  { value: 'email', label: 'Emails' },
  { value: 'consent', label: 'Consent' },
  { value: 'privacy', label: 'Privacy' },
];

/** The audit log's domain tints, one per kind. */
export const TIMELINE_KIND_META: Record<TimelineKind, { icon: IconComponent; tile: string }> = {
  order: { icon: ShoppingBag, tile: 'bg-momentum/8 text-momentum' },
  points: { icon: Coins, tile: 'bg-stock/10 text-stock' },
  email: { icon: Mail, tile: 'bg-reference/8 text-reference' },
  consent: { icon: ShieldCheck, tile: 'bg-measured/10 text-measured' },
  privacy: { icon: ShieldCheck, tile: 'bg-exception/8 text-exception' },
};

/** The audit log's status pill tones. */
export const PILL_TONE = {
  warning: 'bg-measured/10 text-measured',
  exception: 'bg-exception/8 text-exception',
} as const;
