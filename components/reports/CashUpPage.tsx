'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { closeCashUp, getCashUps, openCashUp } from '@/lib/api/operations.service';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function CashUpPage() {
  const router = useRouter(),
    qc = useQueryClient();
  const { locationId } = useWorkspaceStore();
  const { data: rows = [] } = useQuery({
    queryKey: ['cashups', locationId],
    queryFn: () => getCashUps(locationId!),
    enabled: !!locationId,
  });
  const current = rows.find((row) => row.status === 'open');
  const [opening, setOpening] = useState('0');
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');
  const today = new Date();
  const tradingDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const start = useMutation({
    mutationFn: () => openCashUp({ locationId: locationId!, tradingDate, openingFloat: Number(opening) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cashups'] });
      toast('success', 'Trading day opened.');
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The trading day wasn’t opened. Try again.'),
  });
  const close = useMutation({
    mutationFn: () => closeCashUp(current!.id, { countedCash: Number(cash), terminalCardTotal: Number(card) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cashups'] });
      toast('success', 'Cash-up closed and variances recorded.');
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The cash-up wasn’t closed. Review the figures and try again.'),
  });
  return (
    <EditorShell eyebrow="Operations" title="Cash-up" onClose={() => router.push('/reports/library')}>
      <div className="space-y-5">
        <section className="rounded-sm border border-rule bg-card shadow-sm p-5">
          {!current ? (
            <div className="max-w-sm space-y-3">
              <Input label="Opening float" type="number" value={opening} onChange={(e) => setOpening(e.target.value)} />
              <Button onClick={() => start.mutate()} disabled={!locationId || start.isPending}>
                Open trading day
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Counted cash (including float)" type="number" value={cash} onChange={(e) => setCash(e.target.value)} />
              <Input label="Terminal card total" type="number" value={card} onChange={(e) => setCard(e.target.value)} />
              <Button onClick={() => close.mutate()} disabled={!cash || !card || close.isPending}>
                Close and reconcile
              </Button>
            </div>
          )}
        </section>
        <section className="overflow-hidden rounded-sm border border-rule bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left">Date</th>
                <th>Status</th>
                <th>Cash variance</th>
                <th>Card variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-3">{row.tradingDate}</td>
                  <td className="text-center">{row.status}</td>
                  <td className="text-center">{row.cashVariance ?? '—'}</td>
                  <td className="text-center">{row.cardVariance ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </EditorShell>
  );
}
