/**
 * Onboarding a new team member, as data: the questions, which are answered,
 * how far through someone is, and the `POST /onboarding` body they add up to.
 *
 * The same shape as the workspace sign-up (`lib/onboarding/flow.ts`) — one
 * question per screen, grouped into sections — so the screen is only a
 * renderer and the rules (the part that is easy to get wrong) are testable.
 * The limits are the API's own (`duma-api/src/routes/onboarding.ts`).
 */
import type { OnboardPayload } from '../api/onboarding.service.ts';
import type { EmploymentType, PayType } from '../api/hr.service.ts';
import type { StaffScope } from '../api/staff.service.ts';
import {
  isValidAccountNumber, isValidNiNumber, isValidSortCode, normaliseAccountNumber, normaliseNiNumber, normaliseSortCode,
} from './my-hr.ts';

export type StaffSectionId = 'account' | 'personal' | 'job' | 'statutory';

export const STAFF_SECTIONS: ReadonlyArray<{ id: StaffSectionId; label: string }> = [
  { id: 'account', label: 'Account' },
  { id: 'personal', label: 'Personal' },
  { id: 'job', label: 'Job & pay' },
  { id: 'statutory', label: 'Tax & bank' },
];

export type StaffStepId =
  | 'name' | 'email' | 'role' | 'access'
  | 'birthday' | 'address' | 'emergency'
  | 'job' | 'contract' | 'start' | 'pay' | 'breaks'
  | 'tax' | 'bank'
  | 'review';

export const STAFF_STEPS: ReadonlyArray<{ id: StaffStepId; section: StaffSectionId | null; optional?: boolean }> = [
  { id: 'name', section: 'account' },
  { id: 'email', section: 'account' },
  { id: 'role', section: 'account' },
  { id: 'access', section: 'account' },
  { id: 'birthday', section: 'personal', optional: true },
  { id: 'address', section: 'personal', optional: true },
  { id: 'emergency', section: 'personal', optional: true },
  { id: 'job', section: 'job' },
  { id: 'contract', section: 'job' },
  { id: 'start', section: 'job' },
  { id: 'pay', section: 'job' },
  { id: 'breaks', section: 'job' },
  { id: 'tax', section: 'statutory', optional: true },
  { id: 'bank', section: 'statutory', optional: true },
  { id: 'review', section: null },
];

/** Everything the flow collects. Numbers stay strings while they are being typed. */
export interface StaffDraft {
  name: string;
  email: string;
  role: string;
  scope?: StaffScope;
  locationIds: string[];
  dateOfBirth: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  jobTitle: string;
  department: string;
  employmentType?: EmploymentType;
  startDate: string;
  payType?: PayType;
  hourlyRate: string;
  annualSalary: string;
  unpaidBreakMins: number;
  breakThresholdMins: number;
  niNumber: string;
  taxCode: string;
  accountHolder: string;
  bankName: string;
  sortCode: string;
  accountNumber: string;
}

export const emptyStaffDraft = (today: string): StaffDraft => ({
  name: '',
  email: '',
  role: '',
  locationIds: [],
  dateOfBirth: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  jobTitle: '',
  department: '',
  startDate: today,
  hourlyRate: '',
  annualSalary: '',
  unpaidBreakMins: 30,
  breakThresholdMins: 360,
  niNumber: '',
  taxCode: '',
  accountHolder: '',
  bankName: '',
  sortCode: '',
  accountNumber: '',
});

/** Workspace payroll country: UK formats are checked as UK formats, elsewhere only the API's lengths apply. */
export interface StaffContext {
  uk: boolean;
  /** Today, `YYYY-MM-DD` — a birthday cannot be after it. */
  today: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const within = (value: string, max: number) => value.trim().length <= max;
const amount = (value: string) => (value.trim() === '' ? NaN : Number(value.replace(/,/g, '')));

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

export const payAmount = (draft: StaffDraft) => amount(draft.payType === 'salaried' ? draft.annualSalary : draft.hourlyRate);

export function payValid(draft: StaffDraft): boolean {
  if (!draft.payType) return false;
  const value = payAmount(draft);
  const max = draft.payType === 'salaried' ? 10_000_000 : 10_000;
  return Number.isFinite(value) && value > 0 && value <= max;
}

export const niValid = (draft: StaffDraft, uk: boolean) =>
  !draft.niNumber.trim() || (uk ? isValidNiNumber(draft.niNumber) : within(draft.niNumber, 13));

export const bankStarted = (draft: StaffDraft) => !!(draft.accountHolder.trim() || draft.sortCode.trim() || draft.accountNumber.trim());

/**
 * Bank details are all-or-nothing — a sort code with no account number cannot
 * be paid into — the same rule the employee record and My HR apply.
 */
export function bankIssues(draft: StaffDraft, uk: boolean): { holder?: string; sortCode?: string; accountNumber?: string } {
  if (!bankStarted(draft)) return {};
  const issues: { holder?: string; sortCode?: string; accountNumber?: string } = {};
  if (!draft.accountHolder.trim()) issues.holder = 'Add the name on the account.';
  const sort = uk ? isValidSortCode(draft.sortCode) : draft.sortCode.trim().length > 0 && within(draft.sortCode, 10);
  if (!sort) issues.sortCode = uk ? 'Six digits, like 04-00-04.' : 'Add the bank code — up to 10 characters.';
  const digits = draft.accountNumber.replace(/\s/g, '');
  const account = uk ? isValidAccountNumber(draft.accountNumber) : digits.length > 0 && digits.length <= 20;
  if (!account) issues.accountNumber = uk ? 'Eight digits.' : 'Add the account number — up to 20 characters.';
  return issues;
}

export function isStaffStepComplete(step: StaffStepId, draft: StaffDraft, ctx: StaffContext): boolean {
  switch (step) {
    case 'name':
      return draft.name.trim().length >= 2 && within(draft.name, 255);
    case 'email':
      return EMAIL.test(draft.email.trim());
    case 'role':
      return !!draft.role;
    case 'access':
      return !!draft.scope && (draft.scope !== 'location' || draft.locationIds.length > 0);
    case 'birthday':
      return !draft.dateOfBirth || draft.dateOfBirth <= ctx.today;
    case 'address':
      return within(draft.address, 1000);
    case 'emergency':
      return within(draft.emergencyContactName, 255) && within(draft.emergencyContactPhone, 30) && within(draft.emergencyContactRelation, 100);
    case 'job':
      return draft.jobTitle.trim().length > 0 && within(draft.jobTitle, 255) && within(draft.department, 100);
    case 'contract':
      return !!draft.employmentType;
    case 'start':
      return !!draft.startDate;
    case 'pay':
      return payValid(draft);
    case 'breaks':
      return Number.isInteger(draft.unpaidBreakMins) && draft.unpaidBreakMins >= 0 && draft.unpaidBreakMins <= 480
        && Number.isInteger(draft.breakThresholdMins) && draft.breakThresholdMins >= 0 && draft.breakThresholdMins <= 1440;
    case 'tax':
      return niValid(draft, ctx.uk) && within(draft.taxCode, 20);
    case 'bank':
      return Object.keys(bankIssues(draft, ctx.uk)).length === 0 && within(draft.bankName, 255);
    case 'review':
      return STAFF_STEPS.every((entry) => entry.id === 'review' || isStaffStepComplete(entry.id, draft, ctx));
  }
}

/** An optional step with nothing entered — its Continue reads "Skip". */
export function isStepSkipped(step: StaffStepId, draft: StaffDraft): boolean {
  switch (step) {
    case 'birthday':
      return !draft.dateOfBirth;
    case 'address':
      return !draft.address.replace(/[,\s]/g, '');
    case 'emergency':
      return !(draft.emergencyContactName.trim() || draft.emergencyContactPhone.trim() || draft.emergencyContactRelation.trim());
    case 'tax':
      return !(draft.niNumber.trim() || draft.taxCode.trim());
    case 'bank':
      return !bankStarted(draft) && !draft.bankName.trim();
    default:
      return false;
  }
}

const indexOf = (step: StaffStepId) => STAFF_STEPS.findIndex((entry) => entry.id === step);

export const nextStaffStep = (step: StaffStepId): StaffStepId | null => STAFF_STEPS[indexOf(step) + 1]?.id ?? null;
export const previousStaffStep = (step: StaffStepId): StaffStepId | null => STAFF_STEPS[indexOf(step) - 1]?.id ?? null;

/** The first question still missing an answer — where a "Change" or a failed create should land. */
export const firstIncompleteStep = (draft: StaffDraft, ctx: StaffContext): StaffStepId =>
  STAFF_STEPS.find((entry) => entry.id !== 'review' && !isStaffStepComplete(entry.id, draft, ctx))?.id ?? 'review';

/** A step past an unanswered required question resolves back to that question. */
export function resolveStaffStep(requested: StaffStepId, draft: StaffDraft, ctx: StaffContext): StaffStepId {
  const target = indexOf(requested);
  const blocking = STAFF_STEPS.slice(0, target).find((entry) => !isStaffStepComplete(entry.id, draft, ctx));
  return blocking?.id ?? requested;
}

export interface StaffProgress {
  /** 0–1 per section, in `STAFF_SECTIONS` order. */
  sections: number[];
  overall: number;
  activeSection: StaffSectionId | null;
  /** 1-based position within the active section, and that section's size. */
  position: number;
  total: number;
}

export function staffProgressFor(step: StaffStepId): StaffProgress {
  const current = indexOf(step);
  const counted = STAFF_STEPS.filter((entry) => entry.section !== null);
  const done = new Set(STAFF_STEPS.slice(0, Math.max(current, 0)).map((entry) => entry.id));
  const activeSection = STAFF_STEPS[current]?.section ?? null;
  const inActive = counted.filter((entry) => entry.section === activeSection);
  return {
    sections: STAFF_SECTIONS.map(({ id }) => {
      const inSection = counted.filter((entry) => entry.section === id);
      return inSection.filter((entry) => done.has(entry.id)).length / inSection.length;
    }),
    overall: counted.filter((entry) => done.has(entry.id)).length / counted.length,
    activeSection,
    position: inActive.findIndex((entry) => entry.id === step) + 1,
    total: inActive.length,
  };
}

const optional = (value: string) => value.trim() || undefined;

/** The `POST /onboarding` body. UK identifiers are normalised; elsewhere they are sent as typed. */
export function staffOnboardPayload(draft: StaffDraft, uk: boolean): OnboardPayload {
  const salaried = draft.payType === 'salaried';
  const bank = bankStarted(draft);
  return {
    email: draft.email.trim(),
    name: draft.name.trim(),
    role: draft.role,
    scope: draft.scope ?? 'location',
    locationIds: draft.scope === 'location' ? draft.locationIds : undefined,
    jobTitle: draft.jobTitle.trim(),
    department: optional(draft.department),
    employmentType: draft.employmentType ?? 'part_time',
    startDate: draft.startDate,
    dateOfBirth: draft.dateOfBirth || undefined,
    address: optional(draft.address.replace(/^[,\s]+|[,\s]+$/g, '')),
    emergencyContactName: optional(draft.emergencyContactName),
    emergencyContactPhone: optional(draft.emergencyContactPhone),
    emergencyContactRelation: optional(draft.emergencyContactRelation),
    payType: draft.payType ?? 'hourly',
    hourlyRate: salaried ? undefined : payAmount(draft),
    annualSalary: salaried ? payAmount(draft) : undefined,
    unpaidBreakMins: draft.unpaidBreakMins,
    breakThresholdMins: draft.breakThresholdMins,
    niNumber: draft.niNumber.trim() ? (uk ? normaliseNiNumber(draft.niNumber) : draft.niNumber.trim()) : undefined,
    taxCode: optional(draft.taxCode.toUpperCase()),
    accountHolder: bank ? draft.accountHolder.trim() : undefined,
    bankName: optional(draft.bankName),
    sortCode: bank ? (uk ? normaliseSortCode(draft.sortCode) : draft.sortCode.trim()) : undefined,
    accountNumber: bank ? (uk ? normaliseAccountNumber(draft.accountNumber) : draft.accountNumber.replace(/\s/g, '')) : undefined,
  };
}
