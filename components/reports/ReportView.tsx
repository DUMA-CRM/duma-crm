'use client';

import type { ReportId } from '@/lib/reports/catalogue';

import { DiscountsVoidsReport, RefundsReport } from './catalogue/ExceptionReports';
import { ItemSalesReport, MenuEngineeringReport } from './catalogue/MenuReports';
import { EndOfDayReport, PurchasingReport, StockUsageReport, WasteReport } from './catalogue/OperationsReports';
import { PaymentMethodsReport, VatReport } from './catalogue/PaymentReports';
import { CustomerRetentionReport, LabourVsSalesReport, StaffHoursReport } from './catalogue/PeopleReports';
import { PrimeCostReport } from './catalogue/ProfitReports';
import { SalesByChannelReport, SalesByHourReport, SalesByLocationReport, SalesSummaryReport } from './catalogue/SalesReports';
import { type ReportFilterState, useReportFilters } from './kit/useReportFilters';

const VIEWS: Record<ReportId, (props: { filters: ReportFilterState }) => React.ReactNode> = {
  'sales-summary': SalesSummaryReport,
  'sales-by-hour': SalesByHourReport,
  'sales-by-channel': SalesByChannelReport,
  'sales-by-location': SalesByLocationReport,
  'payment-methods': PaymentMethodsReport,
  vat: VatReport,
  'item-sales': ItemSalesReport,
  'menu-engineering': MenuEngineeringReport,
  refunds: RefundsReport,
  'discounts-voids': DiscountsVoidsReport,
  'labour-vs-sales': LabourVsSalesReport,
  'staff-hours': StaffHoursReport,
  'customer-retention': CustomerRetentionReport,
  'stock-usage': StockUsageReport,
  waste: WasteReport,
  purchasing: PurchasingReport,
  'end-of-day': EndOfDayReport,
  'prime-cost': PrimeCostReport,
};

/** One report by id, with the shared filters read from the URL. */
export function ReportView({ id }: { id: ReportId }) {
  const filters = useReportFilters();
  const View = VIEWS[id];
  return <View filters={filters} />;
}
