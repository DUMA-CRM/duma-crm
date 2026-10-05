// ---------------------------------------------------------------------------
// An item's physical containers: which to use first, how the views slice them,
// and how a split divides a balance exactly. Pure and tested.
// ---------------------------------------------------------------------------

export type ContainerStatus = 'AVAILABLE' | 'IN_USE' | 'EMPTY' | 'EXPIRED' | 'DISCARDED';
export type ContainerView = 'active' | 'expired' | 'finished' | 'all';

export interface ContainerLike {
  id: string;
  status: ContainerStatus;
  remainingQuantity: string;
  expiryDate?: string | null;
  createdAt: string;
}

export const isActive = (c: { status: ContainerStatus }) => c.status === 'AVAILABLE' || c.status === 'IN_USE';

export function inContainerView(view: ContainerView, c: { status: ContainerStatus }): boolean {
  if (view === 'all') return true;
  if (view === 'active') return isActive(c);
  if (view === 'expired') return c.status === 'EXPIRED';
  return c.status === 'EMPTY' || c.status === 'DISCARDED';
}

const RANK: Record<ContainerStatus, number> = { IN_USE: 0, AVAILABLE: 1, EXPIRED: 2, EMPTY: 3, DISCARDED: 4 };

/**
 * Use-first order: the open container, then sealed ones by earliest expiry
 * (undated last), then oldest received — first-expired, first-out. Expired and
 * finished containers follow.
 */
export function byUseFirst<T extends ContainerLike>(containers: T[]): T[] {
  return [...containers].sort((a, b) => {
    if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
    const ea = a.expiryDate ?? '9999';
    const eb = b.expiryDate ?? '9999';
    if (ea !== eb) return ea < eb ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

/** The container to reach for next: the first active one in use-first order. */
export const nextToUse = <T extends ContainerLike>(containers: T[]) => byUseFirst(containers.filter(isActive))[0] ?? null;

/**
 * A balance divided into `count` parts that add back up exactly, to the
 * thousandth: 1 into 3 is 0.334, 0.333, 0.333. Null when it can't be split.
 */
export function splitParts(total: number, count: number): number[] | null {
  const thousandths = Math.round(total * 1000);
  if (!Number.isInteger(count) || count < 2 || count > 100 || count > thousandths) return null;
  const base = Math.floor(thousandths / count);
  const remainder = thousandths % count;
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 1000);
}

/** Sum of remaining quantity, in thousandths so it has no float artefacts. */
export const totalRemaining = (containers: { remainingQuantity: string }[]) =>
  containers.reduce((sum, c) => sum + Math.round(Number(c.remainingQuantity) * 1000), 0) / 1000;
