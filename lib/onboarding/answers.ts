/**
 * Draft → the answers the API's recommendation rules accept, and the business
 * profile shown back at the reveal.
 *
 * An answer given on a step that a later answer hid is ignored here, not
 * deleted from the draft: going back and forth must not lose anything, but a
 * café that became an online-only shop must not keep its kitchen screen.
 */
import type { WorkspaceModuleId, WorkspaceOnboardingAnswers, WorkspaceRecommendation } from '../api/workspace-composition.service';

import { type BusinessType, type OnboardingDraft, hasPremises, isStepVisible, sellsOnline } from './flow.ts';

export function toOnboardingAnswers(draft: OnboardingDraft): WorkspaceOnboardingAnswers {
  const shown = (step: Parameters<typeof isStepVisible>[0]) => isStepVisible(step, draft);

  const salesChannels = new Set<WorkspaceOnboardingAnswers['salesChannels'][number]>();
  if (hasPremises(draft)) salesChannels.add('counter');
  if (sellsOnline(draft)) salesChannels.add('online');
  if (shown('qr') && draft.qrOrdering) salesChannels.add('qr');
  for (const channel of draft.extraChannels) salesChannels.add(channel);

  const fulfilment = new Set<WorkspaceOnboardingAnswers['fulfilment'][number]>();
  if (draft.servesFood) fulfilment.add('prepare');
  if (shown('fulfilment')) {
    for (const option of draft.fulfilment) {
      // Table service needs a room to serve in.
      if (option === 'table_service' && !hasPremises(draft)) continue;
      fulfilment.add(option);
    }
  }

  const stockTracking = draft.stockTracking ?? 'none';
  const team = shown('teamNeeds') ? new Set(draft.teamNeeds) : new Set<string>();
  const customers = new Set(draft.customerNeeds);
  const extras = new Set(draft.extras);

  return {
    businessType: draft.businessType,
    locationCount: hasPremises(draft) ? Math.max(1, Math.round(draft.locationCount)) : 1,
    salesChannels: [...salesChannels].sort(),
    // Cash needs a counter to take it over.
    paymentMethods: draft.paymentMethods.filter((method) => method !== 'cash' || hasPremises(draft)).sort(),
    fulfilment: [...fulfilment].sort(),
    liveFulfilmentQueue: shown('kitchen') && draft.kitchenScreen === true,
    stockTracking,
    automaticConsumption: stockTracking !== 'none' && draft.automaticConsumption === true,
    purchasing: stockTracking !== 'none' && draft.purchasing === true,
    peopleRecords: team.has('peopleRecords'),
    scheduling: team.has('scheduling'),
    attendance: team.has('attendance'),
    leave: team.has('leave'),
    payroll: team.has('payroll'),
    customers: customers.has('customers'),
    loyalty: customers.has('loyalty'),
    communications: customers.has('communications'),
    compliance: extras.has('compliance'),
    analytics: extras.has('analytics'),
    support: extras.has('support'),
    agent: extras.has('agent'),
    declinedModules: [],
  };
}

/**
 * The module set to activate: everything the rules require, plus the optional
 * modules the owner switched on — but only ones the recommendation still offers,
 * so an add-on left over from an earlier set of answers cannot sneak in.
 */
export function selectedModulesFor(
  recommendation: Pick<WorkspaceRecommendation, 'requiredModules' | 'optionalModules'>,
  addedModules: readonly WorkspaceModuleId[],
): WorkspaceModuleId[] {
  const offered = new Set(recommendation.optionalModules);
  return [...new Set([...recommendation.requiredModules, ...addedModules.filter((id) => offered.has(id))])].sort();
}

const BUSINESS_NOUNS: Record<BusinessType, string> = {
  cafe: 'coffee shop',
  restaurant: 'restaurant',
  bar: 'bar',
  bakery: 'bakery',
  food_truck: 'food truck',
  retail: 'shop',
  online_retail: 'online store',
  services: 'service business',
  other: 'business',
};

export interface BusinessProfile {
  /** e.g. "coffee shop group" */
  noun: string;
  article: 'a' | 'an';
  /** Short facts that shaped the proposal, e.g. "3 locations", "table ordering". */
  traits: string[];
}

export function businessProfile(draft: OnboardingDraft): BusinessProfile {
  const answers = toOnboardingAnswers(draft);
  let noun = BUSINESS_NOUNS[draft.businessType ?? 'other'];
  if ((answers.locationCount ?? 1) > 1 && draft.businessType !== 'online_retail') noun = `${noun} group`;
  if (draft.presence === 'both' && draft.businessType === 'retail') noun = `${noun} with an online store`;

  const traits: string[] = [];
  if ((answers.locationCount ?? 1) > 1) traits.push(`${answers.locationCount} locations`);
  if (draft.presence === 'both' && draft.businessType !== 'retail') traits.push('in person and online');
  if (answers.liveFulfilmentQueue) traits.push('kitchen screen');
  if (answers.salesChannels.includes('qr')) traits.push('table ordering');
  if (answers.fulfilment.includes('delivery')) traits.push('delivery');
  if (answers.fulfilment.includes('pick_pack')) traits.push('shipping');
  if (answers.automaticConsumption) traits.push(draft.servesFood ? 'recipe stock' : 'live stock');
  if (answers.scheduling || answers.payroll) traits.push('team of staff');
  if (answers.loyalty) traits.push('loyalty');

  return { noun, article: /^[aeiou]/.test(noun) ? 'an' : 'a', traits };
}

const BUSINESS_TYPES = new Set<BusinessType>([
  'cafe', 'restaurant', 'bar', 'bakery', 'food_truck', 'retail', 'online_retail', 'services', 'other',
]);
const FOOD_TYPES = new Set<BusinessType>(['cafe', 'restaurant', 'bar', 'bakery', 'food_truck']);

/**
 * The saved answers of an earlier setup, back into a questionnaire draft — so
 * re-running setup from settings starts from what the owner already said rather
 * than from blank. Answers the questionnaire cannot express are dropped; a
 * question it cannot infer (team size) is left for the owner to answer.
 */
export function draftFromAnswers(answers: Partial<WorkspaceOnboardingAnswers> | null | undefined): Partial<OnboardingDraft> {
  if (!answers) return {};
  const channels = new Set(answers.salesChannels ?? []);
  const fulfilment = new Set(answers.fulfilment ?? []);
  const businessType =
    answers.businessType && BUSINESS_TYPES.has(answers.businessType as BusinessType) ? (answers.businessType as BusinessType) : answers.businessType ? 'other' : undefined;
  const presence = channels.has('counter') && channels.has('online') ? 'both' : channels.has('online') ? 'online' : channels.has('counter') ? 'in_person' : undefined;
  const teamNeeds = (['scheduling', 'attendance', 'leave', 'payroll', 'peopleRecords'] as const).filter((need) => answers[need]);
  const stock = answers.stockTracking === 'container' ? 'simple' : answers.stockTracking;

  return {
    ...(businessType ? { businessType, servesFood: FOOD_TYPES.has(businessType) || fulfilment.has('prepare') } : fulfilment.has('prepare') ? { servesFood: true } : {}),
    ...(presence ? { presence } : {}),
    ...(answers.locationCount ? { locationCount: answers.locationCount } : {}),
    extraChannels: (['phone', 'marketplace'] as const).filter((channel) => channels.has(channel)),
    fulfilment: (['table_service', 'collection', 'delivery', 'pick_pack'] as const).filter((option) => fulfilment.has(option)),
    ...(answers.liveFulfilmentQueue !== undefined ? { kitchenScreen: answers.liveFulfilmentQueue } : {}),
    ...(answers.salesChannels ? { qrOrdering: channels.has('qr') } : {}),
    paymentMethods: [...(answers.paymentMethods ?? [])],
    ...(stock ? { stockTracking: stock } : {}),
    ...(answers.automaticConsumption !== undefined ? { automaticConsumption: answers.automaticConsumption } : {}),
    ...(answers.purchasing !== undefined ? { purchasing: answers.purchasing } : {}),
    // Team size is never stored; someone with team tools has a team, otherwise ask again.
    ...(teamNeeds.length > 0 ? { teamSize: 'small' as const } : {}),
    teamNeeds: [...teamNeeds],
    customerNeeds: (['customers', 'loyalty', 'communications'] as const).filter((need) => answers[need]),
    extras: (['analytics', 'agent', 'support', 'compliance'] as const).filter((extra) => answers[extra]),
  };
}
