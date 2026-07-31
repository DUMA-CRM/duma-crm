'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldOff } from 'lucide-react';
import { useState } from 'react';

import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { addMarketingSuppression, getMarketingSuppressions, liftMarketingSuppression } from '@/lib/api/email.service';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const REASONS = [
  { value: 'customer_request', label: 'Customer request' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'invalid_address', label: 'Invalid address' },
  { value: 'other', label: 'Other' },
];

export function SuppressionsPanel() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('customer_request');
  const { data = [], isLoading } = useQuery({
    queryKey: ['marketing-suppressions', tenantId],
    queryFn: () => getMarketingSuppressions(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['marketing-suppressions'] });
  const add = useMutation({
    mutationFn: () => addMarketingSuppression({ tenantId: tenantId ?? undefined, email, reason, source: 'staff' }),
    onSuccess: () => { void refresh(); setOpen(false); setEmail(''); toast('success', 'Email added to the suppression list.'); },
    onError: (error) => toast('error', error.message || 'Could not add the suppression.'),
  });
  const lift = useMutation({
    mutationFn: (id: string) => liftMarketingSuppression(id, tenantId ?? undefined),
    onSuccess: () => { void refresh(); toast('success', 'Suppression lifted. Record explicit opt-in on the customer profile before marketing again.'); },
    onError: (error) => toast('error', error.message || 'Could not lift the suppression.'),
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <div><h2 className="font-semibold text-foreground">Marketing suppression list</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Active entries are excluded from promotional and lifecycle email, including manual marketing sends. Transactional order messages remain available.</p></div>
        <Button onClick={() => setOpen(true)}><Plus />Add email</Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading ? <p className="p-5 text-sm text-muted-foreground">Loading suppressions…</p> : data.length === 0 ? <div className="p-8 text-center"><ShieldOff className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No active suppressions</p><p className="mt-1 text-xs text-muted-foreground">Customer opt-outs and manual suppressions will appear here.</p></div> : data.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{item.customer ? `${item.customer.firstName} ${item.customer.lastName}` : item.maskedValue}</p><p className="text-xs text-muted-foreground">{item.maskedValue} · {item.source.replaceAll('_', ' ')} · {new Date(item.createdAt).toLocaleDateString('en-GB')}</p></div>
            <Badge variant="destructive">{item.reason.replaceAll('_', ' ')}</Badge>
            <Button variant="outline" size="sm" onClick={() => lift.mutate(item.id)} disabled={lift.isPending}>Lift</Button>
          </div>
        ))}
      </div>
      {open && <Modal title="Add marketing suppression" onClose={() => setOpen(false)}><div className="space-y-4"><Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus /><Select value={reason} onValueChange={setReason} options={REASONS} ariaLabel="Suppression reason" className="w-full" /><div className="flex gap-2"><Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button><Button onClick={() => add.mutate()} disabled={add.isPending || !email.includes('@')} className="flex-1">{add.isPending ? 'Adding…' : 'Suppress email'}</Button></div></div></Modal>}
    </div>
  );
}
