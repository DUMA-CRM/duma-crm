// ---------------------------------------------------------------------------
// A loyalty programme as words: the promise a customer reads, the one-line
// summary on the programme list, and what stops a draft being saved. Pure and
// tested; the setup page only draws it.
// ---------------------------------------------------------------------------
import type { LoyaltyEarnRule, LoyaltyRewardRule, LoyaltyRewardValidity } from '@/lib/api/loyalty.service';
import { plural } from './format.ts';

export interface ProgrammeRules {
  name: string;
  unitSingular: string;
  unitPlural: string;
  earnRule: LoyaltyEarnRule;
  rewardRule: LoyaltyRewardRule;
  locationIds: string[] | null;
}

/** What `spendOn` says when a reward isn't limited — the promise then leaves it unsaid. */
export const ANY_ITEM = 'any item';

/** "Coffee", "Coffee and Tea", "Coffee, Tea and 2 more" — or the fallback when nothing is named. */
export function sentenceList(names: string[], fallback: string) {
  if (!names.length) return fallback;
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

export function rewardName(rule: Pick<LoyaltyRewardRule, 'kind' | 'discountPercent'>) {
  if (rule.kind === 'percentage_off') return `${rule.discountPercent ?? 0}% off`;
  return rule.kind === 'free_modifier' ? 'a free extra' : 'a free item';
}

/**
 * What the customer is promised, as one sentence — the way Square words its
 * earn rule ("Earn 1 Star for every visit"). `earnOn` and `spendOn` are the
 * names the caller resolved ("Coffee and Tea", "any drink").
 */
export function programmePromise(rules: ProgrammeRules, { earnOn, spendOn }: { earnOn: string; spendOn: string }): string {
  const { earnRule, rewardRule } = rules;
  const mode = earnRule.benefitMode ?? 'rewards';
  const points = plural(earnRule.unitsPerItem, 'point', 'points');
  const reward = rewardName(rewardRule);
  const onWhat = rewardRule.kind === 'free_modifier' || spendOn === ANY_ITEM ? '' : ` on ${spendOn}`;

  if (earnRule.trigger === 'birthday') {
    if (mode === 'points') return `Get ${points} on your birthday.`;
    return `Get ${mode === 'both' ? `${points} and ` : ''}${reward}${onWhat} on your birthday.`;
  }
  const each = earnRule.scope === 'all_items' ? 'every item' : earnRule.scope === 'menu_items' ? `every ${earnOn}` : `every ${earnOn} item`;
  if (mode === 'points') return `Earn ${points} for ${each} you buy.`;
  const units = plural(earnRule.unitsPerItem, rules.unitSingular, rules.unitPlural);
  const collect = `Collect ${plural(rewardRule.cost, rules.unitSingular, rules.unitPlural)}, get ${reward}${onWhat}.`;
  return `Earn ${mode === 'both' ? `${points} and ` : ''}${units} for ${each} you buy. ${collect}`;
}

export function validityLabel(validity: LoyaltyRewardValidity | undefined) {
  if (!validity || validity.type === 'never') return 'Rewards don’t expire.';
  if (validity.type === 'days') return `Rewards last ${plural(validity.days ?? 1, 'day', 'days')}.`;
  if (validity.type === 'end_of_year') return 'Rewards expire at the end of the year.';
  return validity.date
    ? `Rewards expire on ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${validity.date}T12:00:00Z`))}.`
    : 'Rewards expire on a set date.';
}

export type ProgrammeSection = 'details' | 'earn' | 'reward' | 'locations';

/**
 * The first thing stopping the draft from saving, in the order the page asks
 * for it, with the section it belongs to — the page shows it at that section's
 * foot — or null.
 */
export function programmeProblem(rules: ProgrammeRules): { section: ProgrammeSection; message: string } | null {
  const { earnRule, rewardRule } = rules;
  const rewards = (earnRule.benefitMode ?? 'rewards') !== 'points';
  const purchase = earnRule.trigger !== 'birthday';
  const problem = (section: ProgrammeSection, message: string) => ({ section, message });
  if (!rules.name.trim()) return problem('details', 'Give the programme a name.');
  if (purchase && earnRule.scope === 'categories' && !earnRule.categoryIds.length)
    return problem('earn', 'Choose at least one section that earns.');
  if (purchase && earnRule.scope === 'menu_items' && !earnRule.menuItemIds.length)
    return problem('earn', 'Choose at least one item that earns.');
  if (rewards && (!rules.unitSingular.trim() || !rules.unitPlural.trim()))
    return problem('earn', 'Name what customers collect, like stamp and stamps.');
  if (rewards && rewardRule.kind === 'free_modifier' && !rewardRule.modifierGroupIds.length)
    return problem('reward', 'Choose at least one modifier group for the reward.');
  if (rewards && rewardRule.validity?.type === 'date' && !rewardRule.validity.date)
    return problem('reward', 'Choose the date rewards expire.');
  if (rules.locationIds !== null && rules.locationIds.length === 0)
    return problem('locations', 'Choose at least one location, or use all of them.');
  return null;
}

/** "1 stamp", "9 stamps" — a count with its word, for a row's value. */
export function countOf(count: number, one: string, many: string) {
  return plural(count, one, many);
}

/** When rewards expire, as a row's closed value: "Never", "After 7 days", "At the end of the year", "On 5 Jan 2027". */
export function expiryShort(validity: LoyaltyRewardValidity | undefined) {
  if (!validity || validity.type === 'never') return 'Never';
  if (validity.type === 'days') return `After ${plural(validity.days ?? 1, 'day', 'days')}`;
  if (validity.type === 'end_of_year') return 'At the end of the year';
  return validity.date
    ? `On ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${validity.date}T12:00:00Z`))}`
    : 'On a date';
}
