'use client';

import { AlertTriangle, Banknote, Calculator, CreditCard, Receipt, Wallet } from '@/components/icons';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';

import { getPaymentMethodSales, getTaxAnalytics } from '@/lib/modules/analytics/client';
import { REPORTS } from '@/lib/reports/catalogue';
import { exportFileName, ordersHref, share, toCsv } from '@/lib/utils/report-filters';

import { ReportFrame, downloadFile } from '../kit/ReportFrame';
import { BarList, KpiGrid, ReportBlock, ReportError, ReportLoading, ReportTable } from '../kit/parts';
import { useRangeQuery } from '../kit/useRangeQuery';
import type { ReportFilterState } from '../kit/useReportFilters';

import { rangeKeys } from './SalesReports';

const def = (id: string) => REPORTS.find((report) => report.id === id)!;
const count = (value: number) => value.toLocaleString('en-GB');

const METHOD: Record<string, string> = {
  card: 'Card',
  cash: 'Cash',
  unrecorded: 'Not recorded',
  voucher: 'Voucher',
  gift_card: 'Gift card',
};
const methodLabel = (method: string) => METHOD[method] ?? method.charAt(0).toUpperCase() + method.slice(1).replaceAll('_', ' ');

// ── Payment methods ──────────────────────────────────────────────────────────

export function PaymentMethodsReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('payment-methods');
  const query = useRangeQuery('payments', getPaymentMethodSales, filters);
  const rows = (query.data ?? []).map((row) => ({
    ...row,
    previous: query.previous?.find((entry) => entry.method === row.method)?.revenue ?? null,
  }));
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  const of = (method: string) => rows.find((row) => row.method === method)?.revenue ?? 0;
  const unrecorded = rows.find((row) => row.method === 'unrecorded');

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        rows.length
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(rows, [
                  { header: 'Method', value: (row) => methodLabel(row.method) },
                  { header: 'Orders', value: (row) => row.orders },
                  { header: 'Gross', value: (row) => row.gross.toFixed(2) },
                  { header: 'Refunded', value: (row) => row.refunded.toFixed(2) },
                  { header: 'Net', value: (row) => row.revenue.toFixed(2) },
                ]),
              )
          : undefined
      }
    >
      {query.isError ? (
        <ReportError onRetry={query.refetch} />
      ) : query.isPending ? (
        <ReportLoading />
      ) : (
        <>
          <KpiGrid
            kpis={[
              {
                label: 'Card',
                icon: CreditCard,
                value: money(of('card')),
                hint: `${Math.round(share(of('card'), total) * 100)}% of net sales`,
              },
              {
                label: 'Cash',
                icon: Banknote,
                value: money(of('cash')),
                hint: `${Math.round(share(of('cash'), total) * 100)}% of net sales`,
              },
              {
                label: 'Net taken',
                icon: Wallet,
                value: money(total),
                current: total,
                previous: query.previous ? query.previous.reduce((sum, row) => sum + row.revenue, 0) : null,
              },
            ]}
          />
          {unrecorded && unrecorded.orders > 0 && (
            <p className="flex items-start gap-2.5 rounded-lg border border-measured/30 bg-measured/6 px-3.5 py-3 text-sm text-foreground">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />
              {count(unrecorded.orders)} orders ({money(unrecorded.revenue)}) have no payment method recorded, so they can’t be matched to a
              card settlement or the till.
            </p>
          )}
          <ReportBlock title="Share of net sales">
            <BarList
              rows={rows.map((row) => ({
                key: row.method,
                label: methodLabel(row.method),
                value: row.revenue,
                previous: row.previous,
                detail: `${count(row.orders)} orders`,
              }))}
              format={(value) => money(value)}
            />
          </ReportBlock>
          <ReportBlock title="By method" description="Gross is what was charged; net is after refunds made against those orders." flush>
            <ReportTable
              rows={rows}
              rowKey={(row) => row.method}
              defaultSort={{ key: 'revenue', direction: 'desc' }}
              rowHref={(row) =>
                row.method === 'card' || row.method === 'cash'
                  ? ordersHref(...rangeKeys(filters.range), filters.filters.locationId, { paymentMethod: row.method })
                  : undefined
              }
              columns={[
                {
                  key: 'method',
                  header: 'Method',
                  // The Orders page filters by card and cash; other tenders show as text.
                  render: (row) => methodLabel(row.method),
                  sort: (row) => methodLabel(row.method),
                },
                {
                  key: 'orders',
                  header: 'Orders',
                  align: 'right',
                  render: (row) => count(row.orders),
                  sort: (row) => row.orders,
                  total: count(rows.reduce((sum, row) => sum + row.orders, 0)),
                },
                {
                  key: 'gross',
                  header: 'Gross',
                  align: 'right',
                  render: (row) => money(row.gross),
                  sort: (row) => row.gross,
                  total: money(rows.reduce((sum, row) => sum + row.gross, 0)),
                },
                {
                  key: 'refunded',
                  header: 'Refunded',
                  align: 'right',
                  render: (row) => (row.refunded ? money(row.refunded) : '—'),
                  sort: (row) => row.refunded,
                  total: money(rows.reduce((sum, row) => sum + row.refunded, 0)),
                },
                {
                  key: 'revenue',
                  header: 'Net',
                  align: 'right',
                  render: (row) => <span className="font-semibold">{money(row.revenue)}</span>,
                  sort: (row) => row.revenue,
                  total: money(total),
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
    </ReportFrame>
  );
}

// ── VAT ──────────────────────────────────────────────────────────────────────

export function VatReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('vat');
  const query = useRangeQuery('tax', getTaxAnalytics, filters);
  const tax = query.data;

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        tax?.byRate.length
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(
                  [...tax.byRate, { rate: 'Total', ...tax.byRateTotal }],
                  [
                    { header: 'VAT rate', value: (row) => (typeof row.rate === 'number' ? `${row.rate}%` : row.rate) },
                    { header: 'Lines', value: (row) => row.lines },
                    { header: 'Gross', value: (row) => row.gross.toFixed(2) },
                    { header: 'VAT', value: (row) => row.vat.toFixed(2) },
                    { header: 'Net', value: (row) => row.net.toFixed(2) },
                  ],
                ),
              )
          : undefined
      }
    >
      {query.isError ? (
        <ReportError onRetry={query.refetch} />
      ) : query.isPending || !tax ? (
        <ReportLoading />
      ) : (
        <>
          {!tax.vatRegistered && (
            <p className="flex items-start gap-2.5 rounded-lg border border-rule/60 bg-field px-3.5 py-3 text-sm text-foreground">
              <Calculator size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              This workspace isn’t set as VAT-registered, so no VAT is charged on sales. Change it in Settings → Trading &amp; tax.
            </p>
          )}
          <KpiGrid
            kpis={[
              {
                label: 'VAT charged',
                icon: Calculator,
                value: money(tax.recorded.vat),
                current: tax.recorded.vat,
                previous: query.previous ? query.previous.recorded.vat : null,
                hint: 'As recorded on each order',
              },
              { label: 'Sales inc. VAT', icon: Receipt, value: money(tax.recorded.gross) },
              { label: 'Sales ex. VAT', icon: Wallet, value: money(tax.recorded.gross - tax.recorded.vat) },
            ]}
          />
          <ReportBlock
            title="By rate"
            description={`${tax.pricesIncludeTax ? 'Menu prices include VAT.' : 'VAT is added to menu prices.'}${tax.vatNumber ? ` VAT number ${tax.vatNumber}.` : ''}`}
            flush
          >
            <ReportTable
              rows={tax.byRate}
              rowKey={(row) => String(row.rate)}
              columns={[
                {
                  key: 'rate',
                  header: 'Rate',
                  render: (row) => <span className="font-semibold">{row.rate}%</span>,
                  sort: (row) => row.rate,
                },
                {
                  key: 'lines',
                  header: 'Lines',
                  align: 'right',
                  render: (row) => count(row.lines),
                  sort: (row) => row.lines,
                  total: count(tax.byRateTotal.lines),
                },
                {
                  key: 'gross',
                  header: 'Gross',
                  align: 'right',
                  render: (row) => money(row.gross),
                  sort: (row) => row.gross,
                  total: money(tax.byRateTotal.gross),
                },
                {
                  key: 'vat',
                  header: 'VAT',
                  align: 'right',
                  render: (row) => money(row.vat),
                  sort: (row) => row.vat,
                  total: money(tax.byRateTotal.vat),
                },
                {
                  key: 'net',
                  header: 'Net',
                  align: 'right',
                  render: (row) => money(row.net),
                  sort: (row) => row.net,
                  total: money(tax.byRateTotal.net),
                },
              ]}
              empty="No sales in this period."
            />
          </ReportBlock>
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            The total VAT above is exact — it is what each order recorded when it was taken. The split by rate uses each item’s current VAT
            rate, because order lines don’t store the rate they were sold at; if a rate changed during the period, the split (not the total)
            may differ slightly. Refunds are not netted off here — see the Refunds report. Check figures with your accountant before filing
            a return.
          </p>
        </>
      )}
    </ReportFrame>
  );
}
