// ---------------------------------------------------------------------------
// Promotions, as the editor shapes them: the form's draft and the API's
// fields, the checks a draft must pass before saving (the same ones the API
// makes, so a mistake is caught where it's typed), and the words the list
// uses for where a promotion stands. No discount arithmetic lives here — the
// API works out every amount (ADR-016); the till asks it.
// ---------------------------------------------------------------------------

export type PromotionKind = 'percentage' | 'fixed_amount' | 'free_item' | 'free_delivery';
export type PromotionScope = 'order' | 'items';
export type PromotionStatus = 'active' | 'paused' | 'archived';
export type PromotionChannel = 'pos' | 'mobile' | 'qr_code' | 'web' | 'manual';

export interface PromotionFields {
  name: string;
  description: string | null;
  kind: PromotionKind;
  value: string | null;
  maxDiscount: string | null;
  appliesTo: PromotionScope;
  menuItemIds: string[];
  categoryIds: string[];
  minSubtotal: string | null;
  locationIds: string[] | null;
  channels: PromotionChannel[] | null;
  startsAt: string | null;
  endsAt: string | null;
  status: PromotionStatus;
  maxRedemptions: number | null;
  maxRedemptionsPerCustomer: number | null;
  firstOrderOnly: boolean;
  combinesWithLoyalty: boolean;
}

/** The form: text where people type, so "" means "not set" until it's saved. */
export interface PromotionDraft {
  name: string;
  description: string;
  kind: PromotionKind;
  value: string;
  maxDiscount: string;
  appliesTo: PromotionScope;
  menuItemIds: string[];
  categoryIds: string[];
  minSubtotal: string;
  /** null: every location. */
  locationIds: string[] | null;
  /** null: every channel. */
  channels: PromotionChannel[] | null;
  startsAt: string;
  endsAt: string;
  status: PromotionStatus;
  maxRedemptions: string;
  maxRedemptionsPerCustomer: string;
  firstOrderOnly: boolean;
  combinesWithLoyalty: boolean;
  /** Only when creating: the first shared code. */
  code: string;
}

export const CHANNEL_LABELS: Record<PromotionChannel, string> = {
  pos: 'Till',
  manual: 'Orders taken by hand',
  web: 'Website',
  qr_code: 'QR ordering',
  mobile: 'App',
};

export function emptyPromotionDraft(): PromotionDraft {
  return {
    name: '',
    description: '',
    kind: 'percentage',
    value: '',
    maxDiscount: '',
    appliesTo: 'order',
    menuItemIds: [],
    categoryIds: [],
    minSubtotal: '',
    locationIds: null,
    channels: null,
    startsAt: '',
    endsAt: '',
    status: 'active',
    maxRedemptions: '',
    maxRedemptionsPerCustomer: '',
    firstOrderOnly: false,
    combinesWithLoyalty: true,
    code: '',
  };
}

const text = (value: string | number | null | undefined) => (value === null || value === undefined ? '' : String(value));
/** "10.00" → "10", "2.50" → "2.50": what someone would have typed. */
const amountText = (value: string | null) =>
  value === null ? '' : Number(value) % 1 === 0 ? String(Number(value)) : Number(value).toFixed(2);

export function draftFromPromotion(promotion: PromotionFields): PromotionDraft {
  return {
    name: promotion.name,
    description: text(promotion.description),
    kind: promotion.kind,
    value: amountText(promotion.value),
    maxDiscount: amountText(promotion.maxDiscount),
    appliesTo: promotion.appliesTo,
    menuItemIds: [...promotion.menuItemIds],
    categoryIds: [...promotion.categoryIds],
    minSubtotal: amountText(promotion.minSubtotal),
    locationIds: promotion.locationIds?.length ? [...promotion.locationIds] : null,
    channels: promotion.channels?.length ? [...promotion.channels] : null,
    startsAt: text(promotion.startsAt),
    endsAt: text(promotion.endsAt),
    status: promotion.status,
    maxRedemptions: text(promotion.maxRedemptions),
    maxRedemptionsPerCustomer: text(promotion.maxRedemptionsPerCustomer),
    firstOrderOnly: promotion.firstOrderOnly,
    combinesWithLoyalty: promotion.combinesWithLoyalty,
    code: '',
  };
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());
const intOrNull = (value: string) => (value.trim() === '' ? null : Number.parseInt(value, 10));

/** The draft as the API takes it. Fields that don't apply to the kind are sent empty. */
export function draftToFields(draft: PromotionDraft): PromotionFields {
  const freeItem = draft.kind === 'free_item';
  // Off the delivery fee: no amount, and nothing to choose among the lines.
  if (draft.kind === 'free_delivery') {
    return {
      ...draftToFields({ ...draft, kind: 'percentage' }),
      kind: 'free_delivery',
      value: null,
      maxDiscount: null,
      appliesTo: 'order',
      menuItemIds: [],
      categoryIds: [],
    };
  }
  return {
    name: draft.name.trim(),
    description: orNull(draft.description),
    kind: draft.kind,
    value: freeItem ? null : orNull(draft.value),
    maxDiscount: draft.kind === 'percentage' ? orNull(draft.maxDiscount) : null,
    appliesTo: freeItem ? 'items' : draft.appliesTo,
    menuItemIds: freeItem || draft.appliesTo === 'items' ? draft.menuItemIds : [],
    categoryIds: freeItem || draft.appliesTo === 'items' ? draft.categoryIds : [],
    minSubtotal: orNull(draft.minSubtotal),
    locationIds: draft.locationIds?.length ? draft.locationIds : null,
    channels: draft.channels?.length ? draft.channels : null,
    startsAt: orNull(draft.startsAt),
    endsAt: orNull(draft.endsAt),
    status: draft.status,
    maxRedemptions: intOrNull(draft.maxRedemptions),
    maxRedemptionsPerCustomer: intOrNull(draft.maxRedemptionsPerCustomer),
    firstOrderOnly: draft.firstOrderOnly,
    combinesWithLoyalty: draft.combinesWithLoyalty,
  };
}

export const normaliseCode = (code: string) => code.replace(/\s+/g, '').toUpperCase();

const AMOUNT = /^\d{1,8}(\.\d{1,2})?$/;

export type DraftField = keyof PromotionDraft;

/** What stops the draft being saved, field by field — the API's own rules, in the editor's words. */
export function promotionDraftProblems(draft: PromotionDraft, isNew: boolean): Partial<Record<DraftField, string>> {
  const problems: Partial<Record<DraftField, string>> = {};
  if (!draft.name.trim()) problems.name = 'Give it a name your team will recognise';
  if (draft.kind === 'percentage' || draft.kind === 'fixed_amount') {
    if (!AMOUNT.test(draft.value.trim()) || Number(draft.value) <= 0) {
      problems.value = draft.kind === 'percentage' ? 'Enter a percentage' : 'Enter an amount, like 5 or 5.50';
    } else if (draft.kind === 'percentage' && Number(draft.value) > 100) {
      problems.value = 'A percentage can’t be more than 100';
    }
  }
  if (
    draft.kind === 'percentage' &&
    draft.maxDiscount.trim() &&
    (!AMOUNT.test(draft.maxDiscount.trim()) || Number(draft.maxDiscount) <= 0)
  ) {
    problems.maxDiscount = 'Enter an amount, or leave it empty for no cap';
  }
  const needsItems = draft.kind === 'free_item' || (draft.kind !== 'free_delivery' && draft.appliesTo === 'items');
  if (needsItems && draft.menuItemIds.length === 0 && draft.categoryIds.length === 0) {
    problems.menuItemIds = draft.kind === 'free_item' ? 'Choose which items can be free' : 'Choose which items or categories it applies to';
  }
  if (draft.minSubtotal.trim() && !AMOUNT.test(draft.minSubtotal.trim())) problems.minSubtotal = 'Enter an amount, or leave it empty';
  for (const field of ['maxRedemptions', 'maxRedemptionsPerCustomer'] as const) {
    const value = draft[field].trim();
    if (value && (!/^\d+$/.test(value) || Number(value) < 1)) problems[field] = 'A whole number, 1 or more — or empty for no limit';
  }
  if (draft.startsAt && draft.endsAt && Date.parse(draft.endsAt) <= Date.parse(draft.startsAt)) {
    problems.endsAt = 'The end must come after the start';
  }
  if (draft.locationIds !== null && draft.locationIds.length === 0) problems.locationIds = 'Choose at least one location';
  if (draft.channels !== null && draft.channels.length === 0) problems.channels = 'Choose at least one place it can be used';
  if (isNew && !/^[A-Z0-9-]{3,50}$/.test(normaliseCode(draft.code))) {
    problems.code = 'A code of 3 to 50 letters, numbers or dashes';
  }
  return problems;
}

export type PromotionStanding = 'live' | 'scheduled' | 'ended' | 'used_up' | 'paused' | 'archived';

/** Where a promotion stands right now — what the list's badge says. */
export function promotionStanding(
  promotion: Pick<PromotionFields, 'status' | 'startsAt' | 'endsAt' | 'maxRedemptions'> & { redemptionCount: number },
  now: number = Date.now(),
): PromotionStanding {
  if (promotion.status === 'archived') return 'archived';
  if (promotion.status === 'paused') return 'paused';
  if (promotion.endsAt && Date.parse(promotion.endsAt) <= now) return 'ended';
  if (promotion.maxRedemptions !== null && promotion.redemptionCount >= promotion.maxRedemptions) return 'used_up';
  if (promotion.startsAt && Date.parse(promotion.startsAt) > now) return 'scheduled';
  return 'live';
}

export const STANDING_LABELS: Record<PromotionStanding, string> = {
  live: 'Live',
  scheduled: 'Scheduled',
  ended: 'Ended',
  used_up: 'Used up',
  paused: 'Paused',
  archived: 'Archived',
};

/** "12 uses", "12 of 100 used". */
export function usageLabel(promotion: Pick<PromotionFields, 'maxRedemptions'> & { redemptionCount: number }): string {
  if (promotion.maxRedemptions !== null) return `${promotion.redemptionCount} of ${promotion.maxRedemptions} used`;
  return `${promotion.redemptionCount} ${promotion.redemptionCount === 1 ? 'use' : 'uses'}`;
}

/** The rules a till has to know about, in a line: who it needs, and what it won't combine with. */
export function promotionConditions(
  promotion: Pick<PromotionFields, 'minSubtotal' | 'maxRedemptionsPerCustomer' | 'firstOrderOnly' | 'combinesWithLoyalty'>,
  symbol = '£',
): string[] {
  const conditions: string[] = [];
  if (promotion.minSubtotal !== null && Number(promotion.minSubtotal) > 0)
    conditions.push(`Min. spend ${symbol}${Number(promotion.minSubtotal).toFixed(2)}`);
  if (promotion.firstOrderOnly) conditions.push('First order only');
  if (promotion.maxRedemptionsPerCustomer === 1) conditions.push('Once per customer');
  else if (promotion.maxRedemptionsPerCustomer !== null) conditions.push(`${promotion.maxRedemptionsPerCustomer} per customer`);
  if (!promotion.combinesWithLoyalty) conditions.push('Not with loyalty rewards');
  return conditions;
}

/** The codes as a CSV file's text — for printing vouchers or loading into a mailing tool. */
export function codesCsv(
  codes: readonly { code: string; maxRedemptions: number | null; redemptionCount: number; isActive: boolean }[],
): string {
  const rows = codes.map((code) => [code.code, code.maxRedemptions ?? '', code.redemptionCount, code.isActive ? 'yes' : 'no'].join(','));
  return ['code,max_uses,uses,active', ...rows].join('\n');
}
