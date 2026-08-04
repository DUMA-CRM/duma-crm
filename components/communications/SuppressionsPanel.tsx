'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Info, Plus, Search, ShieldOff } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { addMarketingSuppression, getMarketingSuppressions, liftMarketingSuppression } from '@/lib/api/email.service';
import { formatDate } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { PanelHeader, PanelSearch, PanelToolbar, ResultCount } from './PanelChrome';

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
  const [search, setSearch] = useState('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['marketing-suppressions', tenantId],
    queryFn: () => getMarketingSuppressions(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['marketing-suppressions'] });
  const add = useMutation({
    mutationFn: () => addMarketingSuppression({ tenantId: tenantId ?? undefined, email, reason, source: 'staff' }),
    onSuccess: () => {
      void refresh();
      setOpen(false);
      setEmail('');
      toast('success', 'Email added to the suppression list.');
    },
    onError: (error) => toast('error', error.message || 'Could not add the suppression.'),
  });
  const lift = useMutation({
    mutationFn: (id: string) => liftMarketingSuppression(id, tenantId ?? undefined),
    onSuccess: () => {
      void refresh();
      toast('success', 'Suppression lifted. Record explicit opt-in on the customer profile before marketing again.');
    },
    onError: (error) => toast('error', error.message || 'Could not lift the suppression.'),
  });

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;
    return data.filter((item) => {
      const name = item.customer ? `${item.customer.firstName} ${item.customer.lastName}` : '';
      return `${name} ${item.maskedValue} ${item.reason} ${item.source}`.toLowerCase().includes(query);
    });
  }, [data, search]);

  return (
    <div className="space-y-4">
      <PanelHeader
        title="Suppressions"
        count={data.length}
        description="Addresses excluded from promotional and lifecycle email, including manual marketing sends."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Add email
          </Button>
        }
      />

      <div className="flex items-start gap-3 rounded-2xl border border-info/30 bg-info/5 p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-foreground">
          Transactional order messages still go out — receipts and “your order is ready” are never suppressed. Lifting an entry does not
          restore consent: record explicit opt-in on the customer profile first.
        </p>
      </div>

      {data.length > 0 && (
        <PanelToolbar
          trailing={
            <>
              <PanelSearch value={search} onChange={setSearch} placeholder="Search suppressions…" label="Search suppressions" />
              {search.trim() && <ResultCount shown={visible.length} total={data.length} />}
            </>
          }
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-border" aria-hidden="true">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 p-4">
                <div className="size-9 animate-pulse rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-56 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            icon={ShieldOff}
            title="No active suppressions"
            description="Customer opt-outs and manual suppressions will appear here."
          />
        ) : visible.length === 0 ? (
          <EmptyState icon={Search} title="Nothing matches" description="Try a different search." />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
                  aria-hidden="true"
                >
                  <ShieldOff size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {item.customer ? `${item.customer.firstName} ${item.customer.lastName}` : item.maskedValue}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{item.maskedValue}</span> · via {item.source.replaceAll('_', ' ')} ·{' '}
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <Badge variant="destructive" className="capitalize">
                  {item.reason.replaceAll('_', ' ')}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lift.mutate(item.id)}
                  disabled={lift.isPending}
                  title="Allow marketing email to this address again"
                >
                  Lift
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && (
        <Modal title="Add marketing suppression" onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
              hint="Marketing and lifecycle email to this address stops immediately."
            />
            <div className="space-y-1.5">
              <p className="text-xs font-bold tracking-widest text-muted-foreground">Reason</p>
              <Select value={reason} onValueChange={setReason} options={REASONS} ariaLabel="Suppression reason" className="w-full" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={() => add.mutate()} disabled={add.isPending || !email.includes('@')} className="flex-1">
                {add.isPending ? 'Adding…' : 'Suppress email'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
