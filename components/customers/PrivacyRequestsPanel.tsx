'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  completePrivacyRequest,
  createPrivacyRequest,
  getPrivacyRequests,
  privacyExportUrl,
  updatePrivacyRequest,
  type PrivacyRequest,
  type PrivacyRequestType,
} from '@/lib/api/privacy.service';
import { toast } from '@/stores/toastStore';

const TYPE_OPTIONS = [
  { value: 'access', label: 'Access request' },
  { value: 'portability', label: 'Data portability' },
  { value: 'erasure', label: 'Erasure' },
  { value: 'rectification', label: 'Rectification' },
  { value: 'restriction', label: 'Restrict processing' },
  { value: 'objection', label: 'Objection' },
];
const CHANNEL_OPTIONS = [
  { value: 'in_person', label: 'In person' }, { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' },
  { value: 'web', label: 'Web' }, { value: 'staff', label: 'Staff recorded' },
];

export function PrivacyRequestsPanel({ customerId, tenantId }: { customerId?: string; tenantId?: string }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<PrivacyRequest | null>(null);
  const [type, setType] = useState<PrivacyRequestType>('access');
  const [channel, setChannel] = useState('in_person');
  const [details, setDetails] = useState('');
  const [resolution, setResolution] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['privacy-requests', tenantId, customerId],
    queryFn: () => getPrivacyRequests({ tenantId, customerId }),
    enabled: Boolean(tenantId || customerId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['privacy-requests'] });
  const create = useMutation({
    mutationFn: () => createPrivacyRequest({ tenantId, customerId: customerId!, type, requestChannel: channel, details: details.trim() || undefined }),
    onSuccess: () => { void refresh(); setCreating(false); setDetails(''); toast('success', 'Privacy request recorded.'); },
    onError: (error) => toast('error', error.message || 'Could not create the request.'),
  });
  const progress = useMutation({
    mutationFn: (request: PrivacyRequest) => updatePrivacyRequest(request.id, { status: 'in_progress' }),
    onSuccess: () => void refresh(),
    onError: (error) => toast('error', error.message || 'Could not update the request.'),
  });
  const complete = useMutation({
    mutationFn: () => completePrivacyRequest(completing!.id, resolution),
    onSuccess: () => { void refresh(); setCompleting(null); setResolution(''); toast('success', 'Privacy request completed.'); },
    onError: (error) => toast('error', error.message || 'Could not complete the request.'),
  });
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold text-foreground">Privacy requests</h2><p className="mt-1 text-xs text-muted-foreground">Track access, portability, correction, restriction and erasure requests.</p></div>
        {customerId && <Button size="sm" onClick={() => setCreating(true)}><Plus />New request</Button>}
      </div>
      <div className="mt-4 space-y-2">
        {isLoading ? <p className="text-sm text-muted-foreground">Loading requests…</p> : data.length === 0 ? <p className="text-sm text-muted-foreground">No privacy requests recorded.</p> : data.map((request) => {
          const name = request.customer ? `${request.customer.firstName} ${request.customer.lastName}` : request.customerSnapshot?.name;
          return <div key={request.id} className="rounded-xl border border-border bg-surface-offset p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-foreground">{TYPE_OPTIONS.find((option) => option.value === request.type)?.label}{!customerId && name ? ` · ${name}` : ''}</p><p className="mt-0.5 text-xs text-muted-foreground">Received {new Date(request.receivedAt).toLocaleDateString('en-GB')} · due {new Date(request.dueAt).toLocaleDateString('en-GB')}</p></div><Badge variant={request.status === 'completed' ? 'success' : new Date(request.dueAt) < new Date() ? 'destructive' : 'warning'}>{request.status.replaceAll('_', ' ')}</Badge></div>
            {request.details && <p className="mt-2 text-xs text-muted-foreground">{request.details}</p>}
            {request.status !== 'completed' && request.status !== 'declined' && <div className="mt-3 flex flex-wrap gap-2">
              {request.status === 'received' && <Button variant="outline" size="sm" onClick={() => progress.mutate(request)}>Start work</Button>}
              {(request.type === 'access' || request.type === 'portability') && <Button asChild variant="outline" size="sm"><a href={privacyExportUrl(request.id)} download><Download />Export JSON</a></Button>}
              <Button size="sm" onClick={() => setCompleting(request)}><ShieldCheck />Complete</Button>
            </div>}
          </div>;
        })}
      </div>
      {creating && <Modal title="New privacy request" onClose={() => setCreating(false)}><div className="space-y-4"><Select value={type} onValueChange={(value) => setType(value as PrivacyRequestType)} options={TYPE_OPTIONS} ariaLabel="Request type" className="w-full" /><Select value={channel} onValueChange={setChannel} options={CHANNEL_OPTIONS} ariaLabel="Request channel" className="w-full" /><textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={2000} placeholder="What did the customer ask for?" className="min-h-28 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /><div className="flex gap-2"><Button variant="outline" onClick={() => setCreating(false)} className="flex-1">Cancel</Button><Button onClick={() => create.mutate()} disabled={create.isPending} className="flex-1">{create.isPending ? 'Recording…' : 'Record request'}</Button></div></div></Modal>}
      {completing && <Modal title="Complete privacy request" onClose={() => setCompleting(null)}><div className="space-y-4">{completing.type === 'erasure' && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">Completing this request permanently anonymises the customer’s contact details and loyalty balance. Orders remain linked to the anonymised record for financial reporting.</p>}<textarea value={resolution} onChange={(event) => setResolution(event.target.value)} maxLength={2000} placeholder="Describe the checks performed and outcome…" className="min-h-28 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /><div className="flex gap-2"><Button variant="outline" onClick={() => setCompleting(null)} className="flex-1">Cancel</Button><Button variant={completing.type === 'erasure' ? 'destructive' : 'default'} onClick={() => complete.mutate()} disabled={complete.isPending || !resolution.trim()} className="flex-1">{complete.isPending ? 'Completing…' : 'Complete request'}</Button></div></div></Modal>}
    </section>
  );
}
