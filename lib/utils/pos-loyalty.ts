import type { AppliedLoyaltyReward } from '@/types/pos';

// The loyalty rewards a till can actually honour right now. The cashier picks
// rewards; the cart and the customer's wallet then decide which still apply —
// a line removed, a quantity lowered, a balance spent elsewhere. This is
// derived on every render rather than written back into state from an effect,
// so the discount on screen and the one sent with the order can never be a
// render apart.

interface ProgrammeLike {
  id: string;
  canRedeem?: boolean;
  balance: number;
  rewards?: unknown[] | null;
  rewardRule: {
    kind: string;
    cost: number;
    modifierGroupIds: string[];
    menuItemIds: string[];
    categoryIds: string[];
  };
}

interface LineLike {
  cartId: string;
  quantity: number;
  item: { id: string; category: string };
  selected: { id: string; groupId?: string | null }[];
}

/**
 * Trim `chosen` to what the cart and wallet still allow. Returns `chosen`
 * itself when nothing changed, so a memo or an effect keyed on it stays still.
 */
export function validLoyaltyRewards(
  chosen: AppliedLoyaltyReward[],
  cart: LineLike[],
  programmes: ProgrammeLike[] | undefined,
): AppliedLoyaltyReward[] {
  if (chosen.length === 0) return chosen;
  const used = new Map<string, number>();
  const valid: AppliedLoyaltyReward[] = [];

  for (const reward of chosen) {
    const programme = programmes?.find((row) => row.id === reward.programId);
    const line = cart.find((row) => row.cartId === reward.cartId);
    if (!programme?.canRedeem || !line) continue;

    const available = programme.rewards?.length ?? Math.floor(programme.balance / programme.rewardRule.cost);
    const spent = used.get(programme.id) ?? 0;
    const quantity = Math.min(reward.quantity, line.quantity, Math.max(0, available - spent));
    if (quantity < 1) continue;

    const rule = programme.rewardRule;
    if (rule.kind === 'free_modifier') {
      const modifier = line.selected.find((row) => row.id === reward.modifierId);
      if (!modifier?.groupId || !rule.modifierGroupIds.includes(modifier.groupId)) continue;
    } else {
      const itemAllowed = rule.menuItemIds.length === 0 || rule.menuItemIds.includes(line.item.id);
      const categoryAllowed = rule.categoryIds.length === 0 || rule.categoryIds.includes(line.item.category);
      if (!itemAllowed || !categoryAllowed) continue;
    }

    used.set(programme.id, spent + quantity);
    valid.push({ ...reward, quantity, discountCents: reward.unitDiscountCents * quantity });
  }

  const unchanged =
    valid.length === chosen.length &&
    valid.every((reward, index) => {
      const current = chosen[index];
      return (
        reward.programId === current.programId &&
        reward.cartId === current.cartId &&
        reward.modifierId === current.modifierId &&
        reward.quantity === current.quantity &&
        reward.discountCents === current.discountCents
      );
    });
  return unchanged ? chosen : valid;
}
