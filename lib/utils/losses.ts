// ---------------------------------------------------------------------------
// An item's losses: one reason vocabulary over the three the data carries, and
// the period summary the Losses tab leads with. Pure and tested.
//
// `POST /loss-log` stores reason in upper case (EXPIRY, DAMAGE, THEFT, OTHER);
// container waste (`/inventory/:id/waste`) uses EXPIRED, SPILL, DAMAGED,
// QUALITY, OTHER; and old entries put "reason: note" in `notes` with no reason.
// ---------------------------------------------------------------------------

export type LossKind = 'expired' | 'damaged' | 'spilt' | 'quality' | 'theft' | 'other';

export const LOSS_LABEL: Record<LossKind, string> = {
  expired: 'Expired',
  damaged: 'Damaged',
  spilt: 'Spilt',
  quality: 'Quality',
  theft: 'Theft',
  other: 'Other',
};

const KIND: Record<string, LossKind> = {
  expiry: 'expired',
  expired: 'expired',
  damage: 'damaged',
  damaged: 'damaged',
  spill: 'spilt',
  quality: 'quality',
  theft: 'theft',
  other: 'other',
  waste: 'other',
};

export interface LossLike {
  quantity: number | string;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
}

/** The reason and the human note, whichever of the three shapes the entry is in. */
export function readLoss(loss: LossLike): { kind: LossKind; note: string | null } {
  if (loss.reason) return { kind: KIND[loss.reason.toLowerCase()] ?? 'other', note: loss.notes?.trim() || null };
  const raw = loss.notes?.trim() ?? '';
  const colon = raw.indexOf(':');
  if (colon > 0) {
    const legacy = KIND[raw.slice(0, colon).trim().toLowerCase()];
    if (legacy) return { kind: legacy, note: raw.slice(colon + 1).trim() || null };
  }
  return { kind: 'other', note: raw || null };
}

export interface LossSummary {
  /** Total written off, positive, to the thousandth. */
  quantity: number;
  count: number;
  /** At the item's last cost; null when it has none. */
  valuePence: number | null;
  /** The reason with the most quantity lost, when there is one. */
  topKind: LossKind | null;
}

export function summariseLosses(losses: LossLike[], cost: number | null): LossSummary {
  let thousandths = 0;
  const byKind = new Map<LossKind, number>();
  for (const loss of losses) {
    const q = Math.round(Math.abs(Number(loss.quantity)) * 1000);
    thousandths += q;
    const { kind } = readLoss(loss);
    byKind.set(kind, (byKind.get(kind) ?? 0) + q);
  }
  const quantity = thousandths / 1000;
  const top = [...byKind.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    quantity,
    count: losses.length,
    valuePence: cost == null ? null : Math.round(quantity * cost * 100),
    topKind: top ? top[0] : null,
  };
}

export type LossPeriod = '30d' | '90d' | '12m' | 'all';

/** The `from` for a period, as the API's ISO datetime; undefined for all time. */
export function periodFrom(period: LossPeriod, now: Date): string | undefined {
  if (period === 'all') return undefined;
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === '30d') from.setDate(from.getDate() - 30);
  else if (period === '90d') from.setDate(from.getDate() - 90);
  else from.setFullYear(from.getFullYear() - 1);
  return from.toISOString();
}
