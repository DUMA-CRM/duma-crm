import type { StaffProfile } from '@/lib/modules/identity/client';
import type { HrEmployee } from '@/lib/modules/people/client';
import type { EmployeeDocument } from '@/lib/modules/people/client';

// Relative, not aliased: the test runner strips types but resolves value
// imports, and it has no path mapping.
import { formatDate } from './date.ts';

export type ComplianceTone = 'success' | 'warning' | 'destructive' | 'muted';

export interface ComplianceCheck {
  id: string;
  label: string;
  detail: string;
  complete: boolean;
  tone: ComplianceTone;
}

export const UK_MINIMUM_WAGE_2026 = {
  effectiveFrom: '2026-04-01',
  age21AndOver: 12.71,
  age18To20: 10.85,
  under18: 8,
  apprentice: 8,
} as const;

export function ageOn(dateOfBirth: string, onDate: Date): number {
  const birth = new Date(`${dateOfBirth.slice(0, 10)}T12:00:00`);
  let age = onDate.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    onDate.getMonth() < birth.getMonth() || (onDate.getMonth() === birth.getMonth() && onDate.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * The UK's age-based National Minimum Wage, for a workspace that pays in the
 * UK. `null` anywhere else: a Kraków café is not held to £12.71, and quoting it
 * at them would be wrong, not cautious. An unset country still gets the check —
 * every workspace before multi-country payroll was a UK one, and 0081 only
 * backfilled `GB` for tenants that had already run payroll.
 */
export function ageBasedMinimumWage(dateOfBirth: string | undefined, onDate: Date, country?: string | null) {
  if (!dateOfBirth) return null;
  if (country && country !== 'GB') return null;
  const age = ageOn(dateOfBirth, onDate);
  if (age >= 21) return { age, rate: UK_MINIMUM_WAGE_2026.age21AndOver, label: 'Age 21+' };
  if (age >= 18) return { age, rate: UK_MINIMUM_WAGE_2026.age18To20, label: 'Age 18–20' };
  return { age, rate: UK_MINIMUM_WAGE_2026.under18, label: 'Under 18' };
}

export function employeeSetupChecks(
  member: StaffProfile | null,
  employee: HrEmployee | null,
  documents: EmployeeDocument[] = [],
  onDate = new Date(),
  /** The payroll country (ISO alpha-2), which decides the wage rule and the ID's name. */
  country: string | null = null,
): ComplianceCheck[] {
  const hasPay =
    !!employee?.payType && (employee.payType === 'hourly' ? Number(employee.hourlyRate) > 0 : Number(employee.annualSalary) > 0);
  const rightToWork = documents.find((document) => `${document.documentType} ${document.title}`.toLowerCase().includes('right to work'));
  const contract = documents.find((document) => `${document.documentType} ${document.title}`.toLowerCase().includes('contract'));
  const rightToWorkExpired = !!rightToWork?.expiresAt && new Date(rightToWork.expiresAt).getTime() < onDate.getTime();
  const wage = employee?.payType === 'hourly' ? ageBasedMinimumWage(employee.dateOfBirth, onDate, country) : null;
  const idLabel = statutoryIdLabel(country);
  const belowAgeRate = !!wage && Number(employee?.hourlyRate ?? 0) < wage.rate;

  return [
    {
      id: 'profile',
      label: 'Employee record',
      detail: employee ? 'Employment record is linked to this account.' : 'Create an employment record before scheduling work.',
      complete: !!employee,
      tone: employee ? 'success' : 'destructive',
    },
    {
      id: 'right-to-work',
      label: 'Right to work',
      detail: rightToWorkExpired
        ? 'Evidence has expired — stop and complete the required follow-up check.'
        : rightToWork
          ? `Evidence recorded${rightToWork.expiresAt ? `; follow up by ${formatDate(rightToWork.expiresAt)}` : '.'}`
          : 'Record the check date, method and evidence before employment begins.',
      complete: !!rightToWork && !rightToWorkExpired,
      tone: rightToWorkExpired ? 'destructive' : rightToWork ? 'success' : 'warning',
    },
    {
      id: 'contract',
      label: 'Written particulars',
      detail: contract ? 'Contract or written statement is recorded.' : 'Issue the principal statement no later than day one.',
      complete: !!contract,
      tone: contract ? 'success' : 'warning',
    },
    {
      id: 'pay',
      label: 'Pay setup',
      detail: belowAgeRate
        ? `Hourly rate is below the £${wage.rate.toFixed(2)} age-based statutory rate from 1 April 2026.`
        : hasPay
          ? 'A pay basis and rate are recorded.'
          : 'Add a valid hourly rate or annual salary.',
      complete: hasPay && !belowAgeRate,
      tone: belowAgeRate ? 'destructive' : hasPay ? 'success' : 'warning',
    },
    {
      id: 'statutory',
      label: 'Payroll identity',
      detail: employee?.hasNiNumber
        ? `${idLabel} is held.`
        : country && country !== 'GB'
          ? `${idLabel} is missing — payroll will need it.`
          : 'NI number is missing; confirm the starter declaration/P45 separately.',
      complete: !!employee?.hasNiNumber,
      tone: employee?.hasNiNumber ? 'success' : 'warning',
    },
    {
      id: 'access',
      label: 'Access scope',
      detail:
        member?.scope === 'location' && !member.locationIds?.length
          ? 'Location-scoped account has no assigned location.'
          : 'Role and workplace access are assigned.',
      complete: !!member && (member.scope !== 'location' || !!member.locationIds?.length),
      tone: member && (member.scope !== 'location' || !!member.locationIds?.length) ? 'success' : 'warning',
    },
  ];
}

/**
 * The name of the identifier held in `niNumber`. The column was built for the
 * UK, but it is the one place a social-security / tax number is stored, so
 * everywhere else it is called by the local name — or a neutral one.
 */
const STATUTORY_ID: Record<string, string> = {
  GB: 'National Insurance',
  IE: 'PPS number',
  US: 'SSN',
  CA: 'SIN',
  AU: 'Tax file number',
  UA: 'РНОКПП (tax number)',
  PL: 'PESEL',
  FR: 'Numéro de sécurité sociale',
  DE: 'Steuer-ID',
  ES: 'NAF / NIE',
  IT: 'Codice fiscale',
  NL: 'BSN',
  PT: 'NIF',
};

export const statutoryIdLabel = (country: string | null | undefined): string => (country && STATUTORY_ID[country]) || 'Tax / social ID';

export function setupProgress(checks: ComplianceCheck[]) {
  if (checks.length === 0) return 0;
  return Math.round((checks.filter((check) => check.complete).length / checks.length) * 100);
}
