'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Ban, CheckCircle2, Mail, ShieldAlert } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type MarketingPreferenceStatus, getMarketingPreferences, updateMarketingPreferences } from '@/lib/api/customers.service';
import { formatDate } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';

const STATUS_OPTIONS = [
  { value: 'opted_in', label: 'Opted in' },
  { value: 'opted_out', label: 'Opted out' },
  { value: 'suppressed', label: 'Suppressed — do not contact' },
];
const SOURCE_OPTIONS = [
  { value: 'customer_request', label: 'Customer request' },
  { value: 'in_person', label: 'In person' },
  { value: 'phone', label: 'Phone' },
  { value: 'email_unsubscribe', label: 'Email unsubscribe' },
  { value: 'web_form', label: 'Web form' },
  { value: 'staff_correction', label: 'Staff correction' },
];

export function MarketingPreferencesPanel({ customerId, hasEmail }: { customerId: string; hasEmail: boolean }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<MarketingPreferenceStatus>('opted_out');
  const [source, setSource] = useState('customer_request');
  const [reason, setReason] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['marketing-preferences', customerId],
    queryFn: () => getMarketingPreferences(customerId),
  });
  const save = useMutation({
    mutationFn: () => updateMarketingPreferences(customerId, { status, source, reason: reason.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['marketing-preferences', customerId] });
      void qc.invalidateQueries({ queryKey: ['customer', customerId] });
      toast('success', 'Marketing preference recorded.');
      setReason('');
    },
    onError: (error) => toast('error', error.message || 'Marketing preferences weren’t updated. Try again.'),
  });
  const current = data?.suppression ? 'suppressed' : data?.marketingOptIn ? 'opted_in' : 'opted_out';
  return (
    <section className="rounded-lg border border-rule/65 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Marketing preferences</h2>
          <p className="mt-1 text-xs text-muted-foreground">Consent changes are retained as an audit history.</p>
        </div>
        <Badge variant={current === 'opted_in' ? 'success' : current === 'suppressed' ? 'destructive' : 'muted'}>
          {current === 'opted_in' ? <CheckCircle2 /> : current === 'suppressed' ? <ShieldAlert /> : <Ban />}
          {STATUS_OPTIONS.find((option) => option.value === current)?.label ?? 'Loading…'}
        </Badge>
      </div>
      {!hasEmail ? (
        <p className="mt-4 text-sm text-muted-foreground">Add an email address before recording email marketing preferences.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="marketing-status" className="mb-1.5 block text-xs font-semibold text-foreground">
              Preference
            </label>
            <Select
              id="marketing-status"
              value={status}
              onValueChange={(value) => setStatus(value as MarketingPreferenceStatus)}
              options={STATUS_OPTIONS}
              ariaLabel="Marketing status"
              className="h-10 w-full rounded-md"
            />
          </div>
          <div>
            <label htmlFor="marketing-source" className="mb-1.5 block text-xs font-semibold text-foreground">
              How it was recorded
            </label>
            <Select
              id="marketing-source"
              value={source}
              onValueChange={setSource}
              options={SOURCE_OPTIONS}
              ariaLabel="Consent source"
              className="h-10 w-full rounded-md"
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Reason or customer wording (optional)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="For example: asked at the till"
            />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading} className="md:col-span-2 md:justify-self-end">
            {save.isPending ? 'Recording…' : 'Record preference'}
          </Button>
        </div>
      )}
      {(data?.history.length ?? 0) > 0 && (
        <div className="mt-5 border-t border-rule pt-4">
          <p className="mb-2 text-xs font-semibold text-foreground">Consent history</p>
          <div className="space-y-2">
            {data!.history.map((event) => (
              <div key={event.id} className="flex items-start gap-3 rounded-md bg-band/55 px-3 py-2.5 text-xs">
                <Mail size={14} className="mt-0.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold capitalize text-foreground">{event.action.replaceAll('_', ' ')}</p>
                  <p className="text-muted-foreground">
                    {event.source.replaceAll('_', ' ')}
                    {event.reason ? ` · ${event.reason}` : ''}
                  </p>
                </div>
                <time className="shrink-0 text-muted-foreground">{formatDate(event.occurredAt)}</time>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
