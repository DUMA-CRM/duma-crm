'use client';

import { useState } from 'react';

import { Ban, Receipt, RotateCcw, Scissors, Tag } from '@/components/icons';
import { REFUND_REASON_OPTIONS, VOID_REASON_OPTIONS, optionLabel } from '@/components/orders/orderMeta';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';

import type { RefundReportRow } from '@/lib/api/refunds.service';
import { getExceptionsAnalytics } from '@/lib/modules/analytics/client';
import { getRefundReport } from '@/lib/modules/payments/client';
import { REPORTS } from '@/lib/reports/catalogue';
import { exportFileName, toCsv } from '@/lib/utils/report-filters';
import { formatInstant } from '@/lib/utils/workspace-time';

import { DrawerFacts, DrawerList, DrawerMark, DrawerNote, ReportDrawer } from '../kit/DetailDrawer';
import { ReportFrame, downloadFile } from '../kit/ReportFrame';
import { BarList, KpiGrid, ReportBlock, ReportError, ReportLoading, ReportTable, TenderIcon, tenderLabel } from '../kit/parts';
import { useRangeQuery } from '../kit/useRangeQuery';
import type { ReportFilterState } from '../kit/useReportFilters';

const def = (id: string) => REPORTS.find((report) => report.id === id)!;
const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const count = (value: number) => value.toLocaleString('en-GB');
const when = (iso: string) => formatInstant(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// ── Refunds ──────────────────────────────────────────────────────────────────

type Basis = 'refund' | 'sale';

export function RefundsReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('refunds');
  // Two honest questions: what was refunded in these days, and what refunds
  // hit sales made in these days. They differ whenever a refund lands later.
  const [basis, setBasis] = useState<Basis>('refund');
  const [open, setOpen] = useState<RefundReportRow | null>(null);
  const query = useRangeQuery(`refunds:${basis}`, (params) => getRefundReport({ ...params, basis }), filters, { compare: false });
  const rows = query.data?.data ?? [];
  const total = num(query.data?.totalAmount);
  const byReason = [
    ...rows.reduce((map, row) => map.set(row.reason, (map.get(row.reason) ?? 0) + num(row.amount)), new Map<string, number>()),
  ];

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        rows.length
          ? () =>
              downloadFile(
                exportFileName(`${report.id}-by-${basis}-date`, filters.range),
                toCsv(rows, [
                  { header: 'Refunded at', value: (row) => row.createdAt },
                  { header: 'Order', value: (row) => row.order.id.slice(0, 8).toUpperCase() },
                  { header: 'Ordered at', value: (row) => row.order.createdAt },
                  { header: 'Location', value: (row) => row.order.location?.name ?? '' },
                  { header: 'Reason', value: (row) => optionLabel(REFUND_REASON_OPTIONS, row.reason) },
                  { header: 'Kind', value: (row) => row.kind },
                  { header: 'Method', value: (row) => row.paymentMethod ?? '' },
                  { header: 'Status', value: (row) => row.status },
                  { header: 'Amount', value: (row) => num(row.amount).toFixed(2) },
                  { header: 'Notes', value: (row) => row.notes ?? '' },
                ]),
              )
          : undefined
      }
    >
      <SegmentedControl<Basis>
        options={[
          { value: 'refund', label: 'Refunded in these days' },
          { value: 'sale', label: 'Against sales in these days' },
        ]}
        value={basis}
        onChange={setBasis}
        ariaLabel="Count refunds by"
      />
      {query.isError ? (
        <ReportError onRetry={query.refetch} />
      ) : query.isPending ? (
        <ReportLoading />
      ) : (
        <>
          <KpiGrid
            kpis={[
              {
                label: 'Refunded',
                icon: RotateCcw,
                value: money(total),
                hint: basis === 'refund' ? 'Given back in these days' : 'Against sales in these days',
              },
              {
                label: 'Refunds',
                icon: Receipt,
                value: count(rows.length),
                hint: `${count(rows.filter((row) => row.kind === 'full').length)} full · ${count(rows.filter((row) => row.kind === 'partial').length)} partial`,
              },
              { label: 'Average refund', icon: Tag, value: rows.length ? money(total / rows.length) : '—' },
            ]}
          />
          {byReason.length > 0 && (
            <ReportBlock title="By reason">
              <BarList
                rows={byReason
                  .sort((a, b) => b[1] - a[1])
                  .map(([reason, value]) => ({ key: reason, label: optionLabel(REFUND_REASON_OPTIONS, reason), value }))}
                format={(value) => money(value)}
              />
            </ReportBlock>
          )}
          <ReportBlock title="Every refund" flush>
            <ReportTable
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={setOpen}
              activeKey={open?.id}
              defaultSort={{ key: 'at', direction: 'desc' }}
              limit={25}
              empty="No refunds in this period."
              columns={[
                {
                  key: 'at',
                  header: 'Refunded',
                  leading: (row) => <RefundKind kind={row.kind} />,
                  render: (row) => when(row.createdAt),
                  sort: (row) => row.createdAt,
                },
                {
                  key: 'order',
                  header: 'Order',
                  render: (row) => <span className="font-mono text-xs uppercase">#{row.order.id.slice(0, 8)}</span>,
                },
                {
                  key: 'location',
                  header: 'Location',
                  render: (row) => <span className="text-muted-foreground">{row.order.location?.name ?? '—'}</span>,
                },
                {
                  key: 'reason',
                  header: 'Reason',
                  render: (row) => optionLabel(REFUND_REASON_OPTIONS, row.reason),
                  sort: (row) => row.reason,
                },
                {
                  key: 'method',
                  header: 'Method',
                  leading: (row) => (row.paymentMethod ? <TenderIcon method={row.paymentMethod} /> : null),
                  render: (row) => (row.paymentMethod ? tenderLabel(row.paymentMethod) : '—'),
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  align: 'right',
                  render: (row) => <span className="font-semibold">{money(row.amount)}</span>,
                  sort: (row) => num(row.amount),
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
      {open && <RefundDrawer refund={open} onClose={() => setOpen(null)} />}
    </ReportFrame>
  );
}

const PROCESSING: Record<string, string> = {
  internal_placeholder: 'Recorded only — no money moved in the app',
  internal: 'Refunded in the app',
  stripe: 'Back to the card, through Stripe',
  cash_manual: 'Cash handed back from the till',
};
/** Full or part, as a glyph before the row. Not focusable: it sits inside the
    row's own button, and its word is the accessible name and the tooltip. */
function RefundKind({ kind }: { kind: string }) {
  const full = kind === 'full';
  const Icon = full ? RotateCcw : Scissors;
  const label = full ? 'Full refund' : 'Part refund';
  return (
    <span role="img" aria-label={label} title={label} className={full ? 'text-exception' : 'text-measured'}>
      <Icon size={14} aria-hidden="true" />
    </span>
  );
}

const STATUS: Record<string, string> = { succeeded: 'Done', recorded: 'Recorded', failed: 'Failed' };

/** One refund in full, and the way to the order it came off. */
function RefundDrawer({ refund, onClose }: { refund: RefundReportRow; onClose: () => void }) {
  const money = useWorkspaceMoney();
  const order = refund.order.id.slice(0, 8).toUpperCase();
  const lag = Math.round((new Date(refund.createdAt).getTime() - new Date(refund.order.createdAt).getTime()) / 86_400_000);

  return (
    <ReportDrawer
      title={`${money(refund.amount)} refund`}
      description={`Order #${order}${refund.order.location?.name ? ` · ${refund.order.location.name}` : ''}`}
      leading={<DrawerMark icon={RotateCcw} tone="bg-exception/8 text-exception" />}
      links={[{ label: 'Open the order', href: `/orders?order=${refund.order.id}&location=all`, icon: Receipt, primary: true }]}
      onClose={onClose}
    >
      <DrawerFacts
        facts={[
          { label: 'Refund', value: refund.kind === 'full' ? 'Full' : 'Part' },
          {
            label: 'Reason',
            value: optionLabel(REFUND_REASON_OPTIONS, refund.reason),
            hint: refund.lines?.length ? `${refund.lines.length} ${refund.lines.length === 1 ? 'line' : 'lines'} refunded` : undefined,
          },
        ]}
      />
      <DrawerList
        rows={[
          { label: 'Refunded', icon: RotateCcw, value: <RelativeTime iso={refund.createdAt} /> },
          {
            label: 'Ordered',
            icon: Receipt,
            value: (
              <span>
                <RelativeTime iso={refund.order.createdAt} />
                {lag > 0 && (
                  <span className="text-muted-foreground">
                    {' '}
                    · {lag} {lag === 1 ? 'day' : 'days'} before the refund
                  </span>
                )}
              </span>
            ),
          },
          {
            label: 'Method',
            value: (
              <span className="inline-flex items-center gap-1.5">
                <TenderIcon method={refund.paymentMethod} />
                {refund.paymentMethod ? tenderLabel(refund.paymentMethod) : 'Not recorded'}
              </span>
            ),
          },
          { label: 'How', value: PROCESSING[refund.processingMode] ?? refund.processingMode },
          {
            label: 'Status',
            value: (
              <span className={refund.status === 'failed' ? 'font-semibold text-exception' : undefined}>
                {STATUS[refund.status] ?? refund.status}
              </span>
            ),
          },
        ]}
      />
      {refund.notes && <DrawerNote>{refund.notes}</DrawerNote>}
    </ReportDrawer>
  );
}

// ── Discounts & voids ────────────────────────────────────────────────────────

export function DiscountsVoidsReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('discounts-voids');
  const query = useRangeQuery('exceptions', getExceptionsAnalytics, filters);
  const discounts = query.data?.discounts ?? [];
  const voids = query.data?.voids ?? [];
  const discounted = discounts.reduce((sum, row) => sum + row.amount, 0);
  const voided = voids.reduce((sum, row) => sum + row.amount, 0);
  const voidCount = voids.reduce((sum, row) => sum + row.orders, 0);
  const before = query.previous;

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        query.data
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(
                  [
                    ...discounts.map((row) => ({
                      type: row.kind === 'markdown' ? 'Markdown' : 'Discount',
                      name: row.label,
                      count: row.lines,
                      amount: row.amount,
                    })),
                    ...voids.map((row) => ({
                      type: 'Void',
                      name: optionLabel(VOID_REASON_OPTIONS, row.reason),
                      count: row.orders,
                      amount: row.amount,
                    })),
                  ],
                  [
                    { header: 'Type', value: (row) => row.type },
                    { header: 'Name or reason', value: (row) => row.name },
                    { header: 'Count', value: (row) => row.count },
                    { header: 'Amount', value: (row) => row.amount.toFixed(2) },
                  ],
                ),
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
                label: 'Discounts given',
                icon: Tag,
                value: money(discounted),
                current: discounted,
                previous: before ? before.discounts.reduce((sum, row) => sum + row.amount, 0) : null,
                inverse: true,
                hint: `${count(discounts.reduce((sum, row) => sum + row.lines, 0))} discounted lines`,
              },
              {
                label: 'Voided orders',
                icon: Ban,
                value: count(voidCount),
                current: voidCount,
                previous: before ? before.voids.reduce((sum, row) => sum + row.orders, 0) : null,
                inverse: true,
              },
              { label: 'Voided value', icon: Receipt, value: money(voided), inverse: true },
            ]}
          />
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <ReportBlock title="Discounts" description="Loyalty rewards, promotions and markdowns, by name." flush>
              <ReportTable
                rows={discounts}
                rowKey={(row) => `${row.kind}:${row.label}`}
                defaultSort={{ key: 'amount', direction: 'desc' }}
                empty="No discounts in this period."
                columns={[
                  {
                    key: 'label',
                    header: 'Discount',
                    render: (row) => row.label,
                    sort: (row) => row.label,
                  },
                  {
                    key: 'kind',
                    header: 'Kind',
                    render: (row) => <span className="text-muted-foreground">{row.kind === 'markdown' ? 'Markdown' : 'Discount'}</span>,
                  },
                  { key: 'lines', header: 'Lines', align: 'right', render: (row) => count(row.lines), sort: (row) => row.lines },
                  {
                    key: 'amount',
                    header: 'Amount',
                    align: 'right',
                    render: (row) => money(row.amount),
                    sort: (row) => row.amount,
                  },
                ]}
              />
            </ReportBlock>
            <ReportBlock title="Voids" description="Cancelled orders, by the reason given." flush>
              <ReportTable
                rows={voids}
                rowKey={(row) => row.reason}
                defaultSort={{ key: 'amount', direction: 'desc' }}
                empty="No voided orders in this period."
                columns={[
                  {
                    key: 'reason',
                    header: 'Reason',
                    render: (row) => optionLabel(VOID_REASON_OPTIONS, row.reason),
                    sort: (row) => row.reason,
                  },
                  {
                    key: 'orders',
                    header: 'Orders',
                    align: 'right',
                    render: (row) => count(row.orders),
                    sort: (row) => row.orders,
                  },
                  {
                    key: 'amount',
                    header: 'Value',
                    align: 'right',
                    render: (row) => money(row.amount),
                    sort: (row) => row.amount,
                  },
                ]}
              />
            </ReportBlock>
          </div>
        </>
      )}
    </ReportFrame>
  );
}
