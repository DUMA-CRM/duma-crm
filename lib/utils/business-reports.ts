export type BusinessReportSection = 'labour' | 'inventory' | 'purchasing' | 'profitability';

export const BUSINESS_REPORT_SECTIONS: BusinessReportSection[] = ['labour', 'inventory', 'purchasing', 'profitability'];

export function isBusinessReportSection(value: string): value is BusinessReportSection {
  return (BUSINESS_REPORT_SECTIONS as string[]).includes(value);
}
