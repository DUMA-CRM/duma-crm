'use client';

import { AlertTriangle, Banknote, Clock, Gauge, Repeat, Sparkles, Timer, Users } from '@/components/icons';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';

import { hasAnyCapability } from '@/lib/auth/capabilities';
import { getCustomerRetention, getLabourAnalytics, getStaffHours } from '@/lib/modules/analytics/client';
import { REPORTS } from '@/lib/reports/catalogue';
import { exportFileName, share, toCsv } from '@/lib/utils/report-filters';
import { useAuthStore } from '@/stores/authStore';

import { ReportFrame, downloadFile } from '../kit/ReportFrame';
import { BarList, KpiGrid, ReportBlock, ReportError, ReportLoading, ReportTable } from '../kit/parts';
import { useRangeQuery } from '../kit/useRangeQuery';
import type { ReportFilterState } from '../kit/useReportFilters';

import { useOrderAnalytics } from './SalesReports';

const def = (id: string) => REPORTS.find((report) => report.id === id)!;
const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const count = (value: number) => value.toLocaleString('en-GB');
const hours = (value: number) => `${(Math.round(value * 10) / 10).toLocaleString('en-GB')}h`;
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

// ── Labour vs sales ──────────────────────────────────────────────────────────

export function LabourVsSalesReport({ filters }: { filters: ReportFilterState }) {
  const money = useWorkspaceMoney();
  const report = def('labour-vs-sales');
  const labour = useRangeQuery('labour', getLabourAnalytics, filters);
  const sales = useOrderAnalytics(filters);

  const net = num(sales.data?.summary.totalRevenue);
  const previousNet = sales.previous ? num(sales.previous.summary.totalRevenue) : null;
  const cost = labour.data?.estimatedCost ?? 0;
  const paid = labour.data?.paidHours ?? 0;
  const labourShare = net > 0 ? cost / net : null;
  const previousShare = labour.previous && previousNet ? labour.previous.estimatedCost / previousNet : null;
  const splh = paid > 0 ? net / paid : null;
  const previousSplh =
    labour.previous && previousNet !== null && labour.previous.paidHours > 0 ? previousNet / labour.previous.paidHours : null;

  const breakdown = labour.data
    ? [
        { key: 'clocked', label: 'Clocked hours', value: hours(labour.data.clockedHours), note: 'Everything on the clock' },
        { key: 'paid', label: 'Paid hours', value: hours(labour.data.paidHours), note: 'Capped at the rota slot, less unpaid breaks' },
        { key: 'uncosted', label: 'Uncosted hours', value: hours(labour.data.uncostedHours), note: 'Clocked outside a rota slot' },
        {
          key: 'headcount',
          label: 'People who worked',
          value: count(labour.data.headcount),
          note: `${count(labour.data.salariedHeadcount)} salaried`,
        },
        { key: 'open', label: 'Open shifts', value: count(labour.data.openShifts), note: 'Still on the clock' },
      ]
    : [];

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        labour.data
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(
                  [
                    { measure: 'Net sales', value: net.toFixed(2) },
                    { measure: 'Labour cost', value: cost.toFixed(2) },
                    { measure: 'Labour % of sales', value: labourShare === null ? '' : (labourShare * 100).toFixed(1) },
                    { measure: 'Sales per labour hour', value: splh === null ? '' : splh.toFixed(2) },
                    ...breakdown.map((row) => ({ measure: row.label, value: row.value })),
                  ],
                  [
                    { header: 'Measure', value: (row) => row.measure },
                    { header: 'Value', value: (row) => row.value },
                  ],
                ),
              )
          : undefined
      }
    >
      {labour.isError || sales.isError ? (
        <ReportError
          onRetry={() => {
            labour.refetch();
            sales.refetch();
          }}
        />
      ) : labour.isPending || sales.isPending ? (
        <ReportLoading />
      ) : (
        <>
          {labour.data && !labour.data.costComplete && (
            <p className="flex items-start gap-2.5 rounded-lg border border-measured/30 bg-measured/6 px-3.5 py-3 text-sm text-foreground">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />
              {count(labour.data.staffMissingPayData)} {labour.data.staffMissingPayData === 1 ? 'person has' : 'people have'} no pay rate on
              file, so the labour cost is short by whatever they earned. Add their pay in Staff.
            </p>
          )}
          <KpiGrid
            kpis={[
              {
                label: 'Labour cost',
                icon: Banknote,
                value: money(cost),
                current: cost,
                previous: labour.previous?.estimatedCost ?? null,
                inverse: true,
                hint: 'Estimated, from pay rates',
              },
              {
                label: 'Labour %',
                icon: Gauge,
                value: labourShare === null ? '—' : pct(labourShare),
                current: labourShare ?? undefined,
                previous: previousShare,
                inverse: true,
                hint: 'Of net sales',
              },
              {
                label: 'Sales per labour hour',
                icon: Timer,
                value: splh === null ? '—' : money(splh),
                current: splh ?? undefined,
                previous: previousSplh,
              },
              { label: 'Net sales', icon: Sparkles, value: money(net), current: net, previous: previousNet },
            ]}
          />
          <ReportBlock title="Hours" flush>
            <ReportTable
              rows={breakdown}
              rowKey={(row) => row.key}
              columns={[
                { key: 'label', header: 'Measure', render: (row) => <span className="font-medium">{row.label}</span> },
                { key: 'note', header: 'What it counts', render: (row) => <span className="text-muted-foreground">{row.note}</span> },
                { key: 'value', header: 'Value', align: 'right', render: (row) => <span className="font-semibold">{row.value}</span> },
              ]}
            />
          </ReportBlock>
        </>
      )}
    </ReportFrame>
  );
}

// ── Staff hours ──────────────────────────────────────────────────────────────

export function StaffHoursReport({ filters }: { filters: ReportFilterState }) {
  const canOpenStaff = hasAnyCapability(
    useAuthStore((state) => state.capabilities),
    'staff:read',
    'hr.people:read',
  );
  const report = def('staff-hours');
  const query = useRangeQuery('staff-hours', getStaffHours, filters, { compare: false });
  const rows = query.data ?? [];
  const total = rows.reduce((sum, row) => sum + num(row.totalHours), 0);
  const shifts = rows.reduce((sum, row) => sum + row.totalShifts, 0);

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
                  { header: 'Name', value: (row) => row.userName ?? row.userId },
                  { header: 'Shifts', value: (row) => row.totalShifts },
                  { header: 'Hours', value: (row) => num(row.totalHours).toFixed(2) },
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
              { label: 'Hours worked', icon: Clock, value: hours(total) },
              {
                label: 'People',
                icon: Users,
                value: count(rows.length),
                hint: rows.length ? `${hours(total / rows.length)} each on average` : undefined,
              },
              { label: 'Shifts', icon: Timer, value: count(shifts), hint: shifts ? `${hours(total / shifts)} per shift` : undefined },
            ]}
          />
          <ReportBlock title="By person" description="From completed shifts on the clock." flush>
            <ReportTable
              rows={rows}
              rowKey={(row) => row.userId}
              // One person's own report — only for those who may open it.
              rowHref={canOpenStaff ? (row) => `/reports/staff/${row.userId}${filters.query ? `?${filters.query}` : ''}` : undefined}
              defaultSort={{ key: 'hours', direction: 'desc' }}
              empty="Nobody clocked a completed shift in this period."
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  render: (row) => row.userName ?? 'Unnamed',
                  sort: (row) => row.userName ?? '',
                },
                {
                  key: 'shifts',
                  header: 'Shifts',
                  align: 'right',
                  render: (row) => count(row.totalShifts),
                  sort: (row) => row.totalShifts,
                  total: count(shifts),
                },
                {
                  key: 'average',
                  header: 'Per shift',
                  align: 'right',
                  render: (row) => (row.totalShifts ? hours(num(row.totalHours) / row.totalShifts) : '—'),
                },
                {
                  key: 'hours',
                  header: 'Hours',
                  align: 'right',
                  render: (row) => <span className="font-semibold">{hours(num(row.totalHours))}</span>,
                  sort: (row) => num(row.totalHours),
                  total: hours(total),
                },
                {
                  key: 'share',
                  header: 'Share',
                  align: 'right',
                  render: (row) => `${Math.round(share(num(row.totalHours), total) * 100)}%`,
                  meter: (row) => share(num(row.totalHours), total),
                },
              ]}
            />
          </ReportBlock>
        </>
      )}
    </ReportFrame>
  );
}

// ── Customer retention ───────────────────────────────────────────────────────

export function CustomerRetentionReport({ filters }: { filters: ReportFilterState }) {
  const report = def('customer-retention');
  const query = useRangeQuery('customer-retention', getCustomerRetention, filters);
  const data = query.data;
  const before = query.previous;

  return (
    <ReportFrame
      report={report}
      filters={filters}
      onExport={
        data
          ? () =>
              downloadFile(
                exportFileName(report.id, filters.range),
                toCsv(
                  [
                    { measure: 'Customers who ordered', value: data.totalWithOrders },
                    { measure: 'New customers', value: data.newCustomers },
                    { measure: 'Returning customers', value: data.returningCustomers },
                    { measure: 'Repeat rate %', value: num(data.repeatRate).toFixed(1) },
                  ],
                  [
                    { header: 'Measure', value: (row) => row.measure },
                    { header: 'Value', value: (row) => row.value },
                  ],
                ),
              )
          : undefined
      }
    >
      {query.isError ? (
        <ReportError onRetry={query.refetch} />
      ) : query.isPending || !data ? (
        <ReportLoading />
      ) : (
        <>
          <KpiGrid
            kpis={[
              {
                label: 'Customers',
                icon: Users,
                value: count(data.totalWithOrders),
                current: data.totalWithOrders,
                previous: before?.totalWithOrders ?? null,
                hint: 'Known customers who ordered',
              },
              {
                label: 'New',
                icon: Sparkles,
                value: count(data.newCustomers),
                current: data.newCustomers,
                previous: before?.newCustomers ?? null,
                hint: 'First order in this period',
              },
              {
                label: 'Returning',
                icon: Repeat,
                value: count(data.returningCustomers),
                current: data.returningCustomers,
                previous: before?.returningCustomers ?? null,
              },
              {
                label: 'Repeat rate',
                icon: Gauge,
                value: `${num(data.repeatRate).toFixed(1)}%`,
                current: num(data.repeatRate),
                previous: before ? num(before.repeatRate) : null,
              },
            ]}
          />
          <ReportBlock
            title="New and returning"
            description="Only orders linked to a customer record count — walk-in sales without one are not in these figures."
          >
            <BarList
              rows={[
                {
                  key: 'returning',
                  label: 'Returning',
                  icon: Repeat,
                  value: data.returningCustomers,
                  previous: before?.returningCustomers ?? null,
                },
                { key: 'new', label: 'New', icon: Sparkles, value: data.newCustomers, previous: before?.newCustomers ?? null },
              ]}
              format={(value) => `${count(value)} customers`}
            />
          </ReportBlock>
        </>
      )}
    </ReportFrame>
  );
}
