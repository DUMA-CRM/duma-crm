import type { HrEmployee } from '@/lib/api/hr.service';
import type { EmployeeDocument } from '@/lib/api/people-ops.service';
import type { StaffProfile } from '@/lib/api/staff.service';

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

export function ageBasedMinimumWage(dateOfBirth: string | undefined, onDate: Date) {
  if (!dateOfBirth) return null;
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
): ComplianceCheck[] {
  const hasPay =
    !!employee?.payType && (employee.payType === 'hourly' ? Number(employee.hourlyRate) > 0 : Number(employee.annualSalary) > 0);
  const rightToWork = documents.find((document) => `${document.documentType} ${document.title}`.toLowerCase().includes('right to work'));
  const contract = documents.find((document) => `${document.documentType} ${document.title}`.toLowerCase().includes('contract'));
  const rightToWorkExpired = !!rightToWork?.expiresAt && new Date(rightToWork.expiresAt).getTime() < onDate.getTime();
  const wage = employee?.payType === 'hourly' ? ageBasedMinimumWage(employee.dateOfBirth, onDate) : null;
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
          ? `Evidence recorded${rightToWork.expiresAt ? `; follow up by ${new Date(rightToWork.expiresAt).toLocaleDateString('en-GB')}` : '.'}`
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
        ? 'National Insurance number is held.'
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

export function setupProgress(checks: ComplianceCheck[]) {
  if (checks.length === 0) return 0;
  return Math.round((checks.filter((check) => check.complete).length / checks.length) * 100);
}
