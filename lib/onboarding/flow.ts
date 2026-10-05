/**
 * The sign-up questionnaire as data: which questions exist, which ones a given
 * business sees, and how far through it someone is.
 *
 * Pure on purpose — the page is only a renderer for `visibleSteps(draft)`, so
 * the branching (the part that is easy to get wrong) is testable without React.
 */
import type { WorkspaceModuleId } from '../api/workspace-composition.service';

export type BusinessType =
  | 'cafe'
  | 'restaurant'
  | 'bar'
  | 'bakery'
  | 'food_truck'
  | 'retail'
  | 'online_retail'
  | 'services'
  | 'other';

export type Presence = 'in_person' | 'online' | 'both';
export type ExtraChannel = 'phone' | 'marketplace';
export type Fulfilment = 'table_service' | 'collection' | 'delivery' | 'pick_pack';
export type PaymentMethod = 'cash' | 'card' | 'invoice';
export type StockTracking = 'none' | 'simple' | 'batch_expiry' | 'serial';
export type TeamSize = 'solo' | 'small' | 'medium' | 'large';
export type TeamNeed = 'scheduling' | 'attendance' | 'leave' | 'payroll' | 'peopleRecords';
export type CustomerNeed = 'customers' | 'loyalty' | 'communications';
export type Extra = 'analytics' | 'agent' | 'support' | 'compliance';

/** Everything the questionnaire collects. The password is deliberately absent — it is never persisted. */
export interface OnboardingDraft {
  businessName: string;
  presence?: Presence;
  servesFood?: boolean;
  businessType?: BusinessType;
  locationCount: number;
  extraChannels: ExtraChannel[];
  fulfilment: Fulfilment[];
  kitchenScreen?: boolean;
  qrOrdering?: boolean;
  paymentMethods: PaymentMethod[];
  stockTracking?: StockTracking;
  automaticConsumption?: boolean;
  purchasing?: boolean;
  teamSize?: TeamSize;
  teamNeeds: TeamNeed[];
  customerNeeds: CustomerNeed[];
  extras: Extra[];
  /** Optional modules the owner switched on at the reveal. */
  addedModules: WorkspaceModuleId[];
  ownerName: string;
  email: string;
  locationName: string;
  locationAddress: string;
  workspaceSlug: string;
  slugTouched: boolean;
}

export const EMPTY_DRAFT: OnboardingDraft = {
  businessName: '',
  locationCount: 1,
  extraChannels: [],
  fulfilment: [],
  paymentMethods: [],
  teamNeeds: [],
  customerNeeds: [],
  extras: [],
  addedModules: [],
  ownerName: '',
  email: '',
  locationName: '',
  locationAddress: '',
  workspaceSlug: '',
  slugTouched: false,
};

export type SectionId = 'business' | 'operations' | 'people' | 'account';

export const SECTIONS: ReadonlyArray<{ id: SectionId; label: string }> = [
  { id: 'business', label: 'Business' },
  { id: 'operations', label: 'Operations' },
  { id: 'people', label: 'Team & customers' },
  { id: 'account', label: 'Account' },
];

export type StepId =
  | 'welcome'
  | 'name'
  | 'presence'
  | 'food'
  | 'kind'
  | 'locations'
  | 'channels'
  | 'fulfilment'
  | 'kitchen'
  | 'qr'
  | 'payments'
  | 'stock'
  | 'consumption'
  | 'suppliers'
  | 'team'
  | 'teamNeeds'
  | 'customers'
  | 'extras'
  | 'reveal'
  | 'owner'
  | 'email'
  | 'password'
  | 'location'
  | 'review';

interface StepDefinition {
  id: StepId;
  /** Null for the interstitials (welcome, reveal) that do not count towards progress. */
  section: SectionId | null;
  visible?: (draft: OnboardingDraft) => boolean;
  /** Whether the step holds enough to move past it. `password` is passed separately because it is never in the draft. */
  complete: (draft: OnboardingDraft, password: string) => boolean;
}

export const hasPremises = (draft: OnboardingDraft) => draft.presence !== 'online';
export const sellsOnline = (draft: OnboardingDraft) => draft.presence === 'online' || draft.presence === 'both';
const foodOnPremises = (draft: OnboardingDraft) => draft.servesFood === true && hasPremises(draft);
const tracksStock = (draft: OnboardingDraft) => draft.stockTracking !== undefined && draft.stockTracking !== 'none';

export const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const STEPS: readonly StepDefinition[] = [
  { id: 'welcome', section: null, complete: () => true },

  { id: 'name', section: 'business', complete: (d) => d.businessName.trim().length >= 2 },
  { id: 'presence', section: 'business', complete: (d) => d.presence !== undefined },
  { id: 'food', section: 'business', complete: (d) => d.servesFood !== undefined },
  { id: 'kind', section: 'business', complete: (d) => d.businessType !== undefined },
  { id: 'locations', section: 'business', visible: hasPremises, complete: (d) => d.locationCount >= 1 },

  // Multi-selects that may legitimately be empty are always complete.
  { id: 'channels', section: 'operations', complete: () => true },
  { id: 'fulfilment', section: 'operations', visible: (d) => d.businessType !== 'services', complete: () => true },
  { id: 'kitchen', section: 'operations', visible: foodOnPremises, complete: (d) => d.kitchenScreen !== undefined },
  { id: 'qr', section: 'operations', visible: foodOnPremises, complete: (d) => d.qrOrdering !== undefined },
  { id: 'payments', section: 'operations', complete: (d) => d.paymentMethods.length > 0 },
  { id: 'stock', section: 'operations', complete: (d) => d.stockTracking !== undefined },
  { id: 'consumption', section: 'operations', visible: tracksStock, complete: (d) => d.automaticConsumption !== undefined },
  { id: 'suppliers', section: 'operations', visible: tracksStock, complete: (d) => d.purchasing !== undefined },

  { id: 'team', section: 'people', complete: (d) => d.teamSize !== undefined },
  { id: 'teamNeeds', section: 'people', visible: (d) => d.teamSize !== undefined && d.teamSize !== 'solo', complete: () => true },
  { id: 'customers', section: 'people', complete: () => true },
  { id: 'extras', section: 'people', complete: () => true },

  { id: 'reveal', section: null, complete: () => true },

  { id: 'owner', section: 'account', complete: (d) => d.ownerName.trim().length >= 2 },
  { id: 'email', section: 'account', complete: (d) => EMAIL_PATTERN.test(d.email.trim()) },
  { id: 'password', section: 'account', complete: (_d, password) => password.length >= MIN_PASSWORD_LENGTH && password.length <= 128 },
  {
    id: 'location',
    section: 'account',
    complete: (d) => d.locationName.trim().length >= 2 && d.locationAddress.trim().length >= 3,
  },
  {
    id: 'review',
    section: 'account',
    complete: (d) => {
      const slug = slugFrom(d.workspaceSlug);
      return slug.length >= 3 && SLUG_PATTERN.test(slug);
    },
  },
];

const STEP_IDS = new Set<string>(STEPS.map((step) => step.id));
export const isStepId = (value: string | null | undefined): value is StepId => value != null && STEP_IDS.has(value);

export function isStepVisible(id: StepId, draft: OnboardingDraft): boolean {
  const step = STEPS.find((entry) => entry.id === id);
  return step !== undefined && (step.visible?.(draft) ?? true);
}

export function visibleSteps(draft: OnboardingDraft): StepDefinition[] {
  return STEPS.filter((step) => step.visible?.(draft) ?? true);
}

export function isStepComplete(id: StepId, draft: OnboardingDraft, password: string): boolean {
  return STEPS.find((step) => step.id === id)?.complete(draft, password) ?? false;
}

export function nextStep(current: StepId, draft: OnboardingDraft): StepId | null {
  const steps = visibleSteps(draft);
  const index = steps.findIndex((step) => step.id === current);
  return index >= 0 && index < steps.length - 1 ? steps[index + 1].id : null;
}

export function previousStep(current: StepId, draft: OnboardingDraft): StepId | null {
  const steps = visibleSteps(draft);
  const index = steps.findIndex((step) => step.id === current);
  return index > 0 ? steps[index - 1].id : null;
}

/**
 * Where someone may actually stand. A deep link or a restored session can point
 * past an unanswered question — or at a step a later answer hid — so the target
 * is clamped to the first incomplete visible step before it.
 */
export function resolveStep(requested: StepId | null, draft: OnboardingDraft, password: string): StepId {
  const steps = visibleSteps(draft);
  const target = requested ? steps.findIndex((step) => step.id === requested) : 0;
  const limit = target < 0 ? steps.length - 1 : target;
  for (let index = 0; index < limit; index += 1) {
    if (!steps[index].complete(draft, password)) return steps[index].id;
  }
  return steps[target < 0 ? 0 : target].id;
}

/** Seconds a typical person spends per question — only used for the "minutes left" hint. */
const SECONDS_PER_STEP = 25;

export interface FlowProgress {
  /** 0–1 across every counted step. */
  overall: number;
  /** 0–1 per section, in `SECTIONS` order. */
  sections: number[];
  activeSection: SectionId | null;
  minutesLeft: number;
}

export function progressFor(current: StepId, draft: OnboardingDraft): FlowProgress {
  const counted = visibleSteps(draft).filter((step) => step.section !== null);
  const all = visibleSteps(draft);
  const currentIndex = all.findIndex((step) => step.id === current);
  // Steps strictly before the current one are done; the interstitials count as a position, not as work.
  const done = new Set(all.slice(0, Math.max(currentIndex, 0)).map((step) => step.id));
  const sections = SECTIONS.map(({ id }) => {
    const inSection = counted.filter((step) => step.section === id);
    return inSection.length === 0 ? 1 : inSection.filter((step) => done.has(step.id)).length / inSection.length;
  });
  const doneCount = counted.filter((step) => done.has(step.id)).length;
  return {
    overall: counted.length === 0 ? 0 : doneCount / counted.length,
    sections,
    activeSection: all[currentIndex]?.section ?? null,
    minutesLeft: Math.max(1, Math.ceil(((counted.length - doneCount) * SECONDS_PER_STEP) / 60)),
  };
}

export function slugFrom(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '');
}
