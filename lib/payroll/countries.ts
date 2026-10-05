/**
 * Country presets for payslip deduction lines.
 *
 * **Names only — never rates or rules.** This app computes gross pay from hours;
 * the tax and contributions are worked out by whoever runs payroll properly (an
 * accountant, BrightPay, Gusto, a local bureau) and typed in. A preset exists
 * so an owner in Kraków sees "ZUS emerytalne" instead of a blank box, not so the
 * app can pretend to know this year's thresholds. Every label can be renamed,
 * removed or added to on the payslip itself.
 *
 * Pure data, so it is tested and can be extended without touching a component.
 */
import type { PayItemKind, PayItemPayer, PayrollPeriod } from '../api/payroll.service.ts';

export interface PresetLine {
  label: string;
  kind: PayItemKind;
  paidBy: PayItemPayer;
}

export interface PayrollCountry {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** The currency usually used there — shown as a hint, never changed automatically. */
  currency: string;
  /** How most employers there pay, as a starting suggestion. */
  commonPeriod: PayrollPeriod;
  lines: PresetLine[];
}

const employee = (label: string, kind: PayItemKind): PresetLine => ({ label, kind, paidBy: 'employee' });
const employer = (label: string, kind: PayItemKind): PresetLine => ({ label, kind, paidBy: 'employer' });

export const PAYROLL_COUNTRIES: PayrollCountry[] = [
  {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    commonPeriod: 'monthly',
    lines: [
      employee('Income tax (PAYE)', 'tax'),
      employee('National Insurance', 'social'),
      employee('Pension (employee)', 'pension'),
      employee('Student loan', 'other'),
      employer('Employer National Insurance', 'social'),
      employer('Pension (employer)', 'pension'),
    ],
  },
  {
    code: 'IE',
    name: 'Ireland',
    currency: 'EUR',
    commonPeriod: 'weekly',
    lines: [employee('PAYE', 'tax'), employee('USC', 'tax'), employee('PRSI (employee)', 'social'), employer('PRSI (employer)', 'social')],
  },
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    commonPeriod: 'fortnightly',
    lines: [
      employee('Federal income tax', 'tax'),
      employee('State income tax', 'tax'),
      employee('Social Security', 'social'),
      employee('Medicare', 'social'),
      employee('401(k)', 'pension'),
      employer('Social Security (employer)', 'social'),
      employer('Medicare (employer)', 'social'),
      employer('FUTA', 'social'),
      employer('State unemployment (SUTA)', 'social'),
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    commonPeriod: 'fortnightly',
    lines: [
      employee('Federal tax', 'tax'),
      employee('Provincial tax', 'tax'),
      employee('CPP', 'pension'),
      employee('EI', 'social'),
      employer('CPP (employer)', 'pension'),
      employer('EI (employer)', 'social'),
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    commonPeriod: 'fortnightly',
    lines: [employee('PAYG withholding', 'tax'), employer('Superannuation guarantee', 'pension')],
  },
  {
    code: 'UA',
    name: 'Ukraine',
    currency: 'UAH',
    commonPeriod: 'semi_monthly',
    lines: [
      employee('ПДФО (personal income tax)', 'tax'),
      employee('Військовий збір (military levy)', 'tax'),
      employer('ЄСВ (social contribution)', 'social'),
    ],
  },
  {
    code: 'PL',
    name: 'Poland',
    currency: 'PLN',
    commonPeriod: 'monthly',
    lines: [
      employee('Zaliczka na PIT', 'tax'),
      employee('ZUS emerytalne', 'pension'),
      employee('ZUS rentowe', 'social'),
      employee('ZUS chorobowe', 'social'),
      employee('Składka zdrowotna', 'social'),
      employee('PPK (employee)', 'pension'),
      employer('ZUS emerytalne (pracodawca)', 'pension'),
      employer('ZUS rentowe (pracodawca)', 'social'),
      employer('ZUS wypadkowe', 'social'),
      employer('FP i FGŚP', 'social'),
      employer('PPK (employer)', 'pension'),
    ],
  },
  {
    code: 'FR',
    name: 'France',
    currency: 'EUR',
    commonPeriod: 'monthly',
    lines: [
      employee('Prélèvement à la source', 'tax'),
      employee('CSG / CRDS', 'tax'),
      employee('Cotisations salariales', 'social'),
      employee('Retraite complémentaire', 'pension'),
      employer('Cotisations patronales', 'social'),
      employer('Retraite complémentaire (employeur)', 'pension'),
    ],
  },
  {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    commonPeriod: 'monthly',
    lines: [
      employee('Lohnsteuer', 'tax'),
      employee('Solidaritätszuschlag', 'tax'),
      employee('Kirchensteuer', 'tax'),
      employee('Rentenversicherung', 'pension'),
      employee('Krankenversicherung', 'social'),
      employee('Pflegeversicherung', 'social'),
      employee('Arbeitslosenversicherung', 'social'),
      employer('Arbeitgeberanteil Sozialversicherung', 'social'),
    ],
  },
  {
    code: 'ES',
    name: 'Spain',
    currency: 'EUR',
    commonPeriod: 'monthly',
    lines: [employee('IRPF', 'tax'), employee('Seguridad Social (trabajador)', 'social'), employer('Seguridad Social (empresa)', 'social')],
  },
  {
    code: 'IT',
    name: 'Italy',
    currency: 'EUR',
    commonPeriod: 'monthly',
    lines: [
      employee('IRPEF', 'tax'),
      employee('Contributi INPS (dipendente)', 'social'),
      employer('Contributi INPS (azienda)', 'social'),
      employer('TFR', 'pension'),
    ],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    currency: 'EUR',
    commonPeriod: 'monthly',
    lines: [employee('Loonheffing', 'tax'), employee('Pensioen (werknemer)', 'pension'), employer('Werkgeverspremies', 'social')],
  },
  {
    code: 'PT',
    name: 'Portugal',
    currency: 'EUR',
    commonPeriod: 'monthly',
    lines: [
      employee('IRS', 'tax'),
      employee('Segurança Social (trabalhador)', 'social'),
      employer('Segurança Social (entidade)', 'social'),
    ],
  },
];

/** Anywhere not listed: generic names that work in any payroll. */
export const GENERIC_LINES: PresetLine[] = [
  employee('Income tax', 'tax'),
  employee('Social contributions', 'social'),
  employee('Pension', 'pension'),
  employer('Employer contributions', 'social'),
];

export function countryByCode(code: string | null | undefined): PayrollCountry | null {
  return PAYROLL_COUNTRIES.find((country) => country.code === code) ?? null;
}

/** The lines to suggest for a workspace's country, or the generic set. */
export function presetLinesFor(code: string | null | undefined): PresetLine[] {
  return countryByCode(code)?.lines ?? GENERIC_LINES;
}
