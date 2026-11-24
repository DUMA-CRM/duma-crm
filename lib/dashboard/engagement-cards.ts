import { needsAttention } from '../utils/marketing-status.ts';
import { type PromotionFields, promotionStanding } from '../utils/promotions.ts';

/**
 * The arithmetic behind the dashboard's engagement cards — Promotions, Form
 * responses and Social posts. The cards fetch with the screens' own queries;
 * this decides what is worth saying, so the windows and the ordering are
 * pinned by a test.
 */

const DAY = 86_400_000;

/** A promotion ending inside this many days is "ending soon". */
export const ENDING_SOON_DAYS = 7;
/** "Uses this week": redemptions in the last seven days. */
export const USES_WINDOW_DAYS = 7;

type PromotionLike = Pick<PromotionFields, 'name' | 'status' | 'startsAt' | 'endsAt' | 'maxRedemptions'> & {
  id: string;
  redemptionCount: number;
};

interface RedemptionLike {
  status: 'applied' | 'reversed';
  createdAt: string;
}

/**
 * Uses that still stand in the last seven days, from the first (newest-first)
 * page of a promotion's redemptions. When the whole page falls inside the
 * window there may be more on the next one, so the count is a floor and
 * `capped` says so — "50+" rather than a figure that could be short.
 */
export function recentUses(
  page: { data: readonly RedemptionLike[]; pagination: { limit: number; total: number } },
  now: number,
): { uses: number; capped: boolean } {
  const since = now - USES_WINDOW_DAYS * DAY;
  const inWindow = page.data.filter((row) => Date.parse(row.createdAt) >= since);
  const capped = page.data.length > 0 && inWindow.length === page.data.length && page.pagination.total > page.data.length;
  return { uses: inWindow.filter((row) => row.status === 'applied').length, capped };
}

/**
 * The live promotions as the card reads them: how many are live, scheduled,
 * paused or ended (archived ones are out of it), and the live ones in the
 * order to look at — ending soonest first, then the rest by most used.
 */
export function promotionsCardSummary<T extends PromotionLike>(promotions: readonly T[], now: number) {
  const counts = { live: 0, scheduled: 0, paused: 0, ended: 0 };
  const live: T[] = [];
  for (const promotion of promotions) {
    const standing = promotionStanding(promotion, now);
    if (standing === 'archived') continue;
    if (standing === 'live') {
      counts.live += 1;
      live.push(promotion);
    } else if (standing === 'scheduled') counts.scheduled += 1;
    else if (standing === 'paused') counts.paused += 1;
    else counts.ended += 1; // ended or used up: either way it no longer works
  }
  const endsIn = (promotion: T) => (promotion.endsAt ? Date.parse(promotion.endsAt) - now : Infinity);
  const isEndingSoon = (promotion: T) => endsIn(promotion) <= ENDING_SOON_DAYS * DAY;
  live.sort((a, b) => {
    const soonA = isEndingSoon(a);
    const soonB = isEndingSoon(b);
    if (soonA !== soonB) return soonA ? -1 : 1;
    if (soonA) return endsIn(a) - endsIn(b);
    return b.redemptionCount - a.redemptionCount || a.name.localeCompare(b.name);
  });
  return {
    ...counts,
    total: counts.live + counts.scheduled + counts.paused + counts.ended,
    live,
    endingSoon: live.filter(isEndingSoon).length,
  };
}

interface FormLike {
  id: string;
  name: string;
  responseCount: number;
  newResponses: number;
  lastResponseAt: string | null;
}

/** Forms with responses nobody has looked at, the newest response first, and the totals for the split. */
export function formResponsesSummary<T extends FormLike>(forms: readonly T[]) {
  const waiting = forms
    .filter((form) => form.newResponses > 0)
    .sort((a, b) => (b.lastResponseAt ? Date.parse(b.lastResponseAt) : 0) - (a.lastResponseAt ? Date.parse(a.lastResponseAt) : 0));
  const fresh = forms.reduce((sum, form) => sum + form.newResponses, 0);
  const stored = forms.reduce((sum, form) => sum + form.responseCount, 0);
  return { fresh, seen: Math.max(0, stored - fresh), stored, waiting };
}

interface TargetLike {
  id: string;
  connectionId: string;
  caption: string;
  scheduledAt: string | null;
  status: string;
  error: string | null;
}

interface PostLike<T extends TargetLike> {
  id: string;
  title: string;
  caption: string;
  targets: readonly T[];
}

/** Waiting to go out and nothing wrong — a draft is not on its way, so it doesn't count. */
const ON_ITS_WAY = ['scheduled', 'processing', 'uploading'];

/**
 * Every destination of every post, sorted two ways: what failed or can't be
 * confirmed and needs someone, the most recently due first, and what is still
 * to go out, soonest first. Published counts for the split only.
 */
export function socialPostsSummary<T extends TargetLike, P extends PostLike<T>>(posts: readonly P[], now: number) {
  const attention: { post: P; target: T }[] = [];
  const upcoming: { post: P; target: T }[] = [];
  let published = 0;
  for (const post of posts) {
    for (const target of post.targets) {
      if (target.status === 'published') published += 1;
      else if (needsAttention(target.status)) attention.push({ post, target });
      else if (ON_ITS_WAY.includes(target.status) && target.scheduledAt && Date.parse(target.scheduledAt) > now)
        upcoming.push({ post, target });
    }
  }
  const at = (entry: { target: T }) => (entry.target.scheduledAt ? Date.parse(entry.target.scheduledAt) : 0);
  attention.sort((a, b) => at(b) - at(a));
  upcoming.sort((a, b) => at(a) - at(b));
  return { attention, upcoming, published, next: upcoming[0]?.target.scheduledAt ?? null };
}

/** The first words of a post, for a one-line row: its own caption, else the post's, else its title. */
export function firstWords(text: string, max = 48): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '')}…`;
}
