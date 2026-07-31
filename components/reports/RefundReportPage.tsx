'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getRefundReport, refundReportCsvUrl } from '@/lib/api/refunds.service';

const reasons = [
  { value: 'all', label: 'All reasons' }, { value: 'customer_request', label: 'Customer request' },
  { value: 'item_issue', label: 'Item issue' }, { value: 'service_issue', label: 'Service issue' },
  { value: 'duplicate_charge', label: 'Duplicate charge' }, { value: 'pricing_error', label: 'Pricing error' },
  { value: 'other', label: 'Other' },
];

export function RefundReportPage() {
  const router = useRouter();
  const [asOf] = useState(() => Date.now());
  const [basis, setBasis] = useState<'refund' | 'sale'>('refund');
  const [reason, setReason] = useState('all');
  const [from, setFrom] = useState(() => new Date(asOf - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date(asOf).toISOString().slice(0, 10));
  const range = useMemo(() => ({ from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59.999`).toISOString() }), [from, to]);
  const params = { ...range, basis, ...(reason !== 'all' ? { reason } : {}) };
  const { data, isPending, error } = useQuery({ queryKey: ['refund-report', params], queryFn: () => getRefundReport(params) });

  return <EditorShell eyebrow="Report" title="Refunds" icon={<RotateCcw size={20} />} onClose={() => router.push('/reports/library')}>
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <Input label="From" type="date" value={from} onChange={(event) => event.target.value && setFrom(event.target.value)} className="w-40" />
        <Input label="To" type="date" value={to} onChange={(event) => event.target.value && setTo(event.target.value)} className="w-40" />
        <div><p className="mb-1 text-xs font-semibold text-muted-foreground">Date attribution</p><Select value={basis} onValueChange={(value) => setBasis(value as 'refund' | 'sale')} options={[{ value: 'refund', label: 'Refund date' }, { value: 'sale', label: 'Original sale date' }]} ariaLabel="Date attribution" /></div>
        <div><p className="mb-1 text-xs font-semibold text-muted-foreground">Reason</p><Select value={reason} onValueChange={setReason} options={reasons} ariaLabel="Refund reason" /></div>
        <Button variant="outline" asChild><a href={refundReportCsvUrl(params)} download><Download size={15} /> Export CSV</a></Button>
        <div className="ml-auto text-right"><p className="text-xs text-muted-foreground">Refunded in period</p><p className="text-2xl font-bold text-destructive">£{Number(data?.totalAmount ?? 0).toFixed(2)}</p></div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-3">Refund date</th><th className="p-3">Sale date</th><th className="p-3">Location / order</th><th className="p-3">Items and modifiers</th><th className="p-3">Reason</th><th className="p-3 text-right">Amount</th></tr></thead>
          <tbody>{isPending ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading refunds…</td></tr> : error ? <tr><td colSpan={6} className="p-8 text-center text-destructive">Could not load the refund report.</td></tr> : data?.data.length ? data.data.map((refund) => <tr key={refund.id} className="border-b border-border last:border-0"><td className="p-3">{new Date(refund.createdAt).toLocaleString('en-GB')}</td><td className="p-3">{new Date(refund.order.createdAt).toLocaleDateString('en-GB')}</td><td className="p-3"><p className="font-medium">{refund.order.location?.name ?? 'Unknown location'}</p><p className="text-xs text-muted-foreground">#{refund.orderId.slice(0, 8).toUpperCase()}</p></td><td className="p-3">{refund.lines?.map((line) => <p key={line.id}>{line.quantity}× {line.name} <span className="text-muted-foreground">£{Number(line.amount).toFixed(2)}</span></p>)}</td><td className="p-3 capitalize">{refund.reason.replaceAll('_', ' ')}</td><td className="p-3 text-right font-bold text-destructive">−£{Number(refund.amount).toFixed(2)}</td></tr>) : <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No refunds in this period.</td></tr>}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Refund-date view supports cash/accounting reconciliation. Sale-date view restates the original sales period after refunds.</p>
    </div>
  </EditorShell>;
}
