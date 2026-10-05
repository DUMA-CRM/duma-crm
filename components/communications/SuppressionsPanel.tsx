'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';

import { Search, ShieldOff, X } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type MarketingSuppression,
  addMarketingSuppression,
  getMarketingSuppressions,
  liftMarketingSuppression,
} from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { SUPPRESSION_REASONS, groupSuppressions, suppressionSourceLabel } from '@/lib/utils/communications';
import { formatDate } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { useEmailAccess } from './useEmailAccess';

// Erasure entries come from a privacy request, never from this form.
const ADD_REASONS = SUPPRESSION_REASONS.filter((reason) => reason.value !== 'privacy_erasure').map(({ value, label }) => ({
  value,
  label,
}));

/**
 * Who marketing email must not reach, as the other tabs list things: a search
 * row, then a heading per reason with a row per address. Lifting asks first —
 * it lets marketing reach that address again.
 *
 * `adding` is controlled by the page: the "Add email" button lives in the
 * masthead with every other tab's primary action.
 */
export function SuppressionsPanel({ adding, onAddingChange }: { adding: boolean; onAddingChange: (open: boolean) => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const { canSuppress } = useEmailAccess();
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('customer_request');
  const [liftTarget, setLiftTarget] = useState<MarketingSuppression | null>(null);

  const suppressions = useQuery({
    queryKey: moduleQueryKeys.communications.key('marketing-suppressions', tenantId),
    queryFn: () => getMarketingSuppressions(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('marketing-suppressions') });
  const add = useMutation({
    mutationFn: () => addMarketingSuppression({ tenantId: tenantId ?? undefined, email: email.trim(), reason, source: 'staff' }),
    onSuccess: () => {
      void refresh();
      onAddingChange(false);
      setEmail('');
      setReason('customer_request');
      toast('success', 'Marketing email to that address has stopped.');
    },
    onError: (error) => toast('error', error.message || 'The address wasn’t added. Check it and try again.'),
  });
  const lift = useMutation({
    mutationFn: (id: string) => liftMarketingSuppression(id, tenantId ?? undefined),
    onSuccess: () => {
      void refresh();
      setLiftTarget(null);
      toast('success', 'Lifted. Record their opt-in on the customer profile before marketing to them again.');
    },
    onError: (error) => toast('error', error.message || 'The suppression wasn’t lifted. Try again.'),
  });

  const list = useMemo(() => suppressions.data ?? [], [suppressions.data]);
  const groups = useMemo(() => groupSuppressions(list, search), [list, search]);
  const shown = groups.reduce((total, group) => total + group.items.length, 0);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const addModal = adding && (
    <Modal
      title="Stop marketing to an address"
      description="Marketing and lifecycle email to it stops straight away. Receipts and order updates still go out."
      onClose={() => onAddingChange(false)}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onAddingChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => add.mutate()} disabled={add.isPending || !validEmail}>
            {add.isPending ? 'Adding…' : 'Stop marketing'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Why</p>
          <Select value={reason} onValueChange={setReason} options={ADD_REASONS} ariaLabel="Why" className="w-full" />
          <p className="text-xs text-muted-foreground">{SUPPRESSION_REASONS.find((item) => item.value === reason)?.detail}</p>
        </div>
      </div>
    </Modal>
  );

  if (suppressions.isPending)
    return (
      <div className="space-y-2" aria-label="Loading suppressions">
        <div className="h-4 w-24 animate-pulse rounded-sm bg-band" />
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-15 animate-pulse rounded-lg bg-band/60" />
        ))}
      </div>
    );

  if (suppressions.isError)
    return (
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        <ErrorState title="Suppressions couldn’t be loaded" onRetry={() => void suppressions.refetch()} />
      </div>
    );

  return (
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      <motion.p variants={SECTION_RISE} className="px-1 text-sm leading-relaxed text-muted-foreground">
        Marketing and lifecycle email never reaches these addresses. Receipts and “your order is ready” still go out — they aren’t
        marketing.
      </motion.p>

      {list.length === 0 ? (
        <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
          <EmptyState
            icon={ShieldOff}
            title="No one has opted out"
            description="Unsubscribes, bounces and addresses you add by hand appear here."
          />
        </div>
      ) : (
        <>
          <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1 lg:max-w-sm">
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search suppressions"
                placeholder="Search name, address or reason…"
                leftIcon={<Search size={14} />}
                rightAction={
                  search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  ) : undefined
                }
              />
            </div>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {shown !== list.length && `${shown} of `}
              {list.length} {list.length === 1 ? 'address' : 'addresses'}
            </span>
          </motion.div>

          {groups.length === 0 ? (
            <motion.div variants={SECTION_RISE} className="overflow-hidden rounded-lg border border-rule/60 bg-card">
              <EmptyState icon={Search} title="Nothing matches" description="Try another name, address or reason." />
            </motion.div>
          ) : (
            groups.map((group) => (
              <motion.section key={group.reason} variants={SECTION_RISE} aria-label={group.label}>
                <h2 className="mb-2 flex items-center gap-2 text-label uppercase text-muted-foreground">
                  {group.label}
                  <span className="normal-case tabular-nums">{group.items.length}</span>
                </h2>
                <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                  {group.items.map((item) => (
                    <SuppressionRow key={item.id} item={item} canLift={canSuppress} onLift={() => setLiftTarget(item)} />
                  ))}
                </ul>
              </motion.section>
            ))
          )}
        </>
      )}

      {addModal}

      {liftTarget && (
        <ConfirmModal
          title="Allow marketing to this address again?"
          message={
            <>
              {liftTarget.customer ? `${liftTarget.customer.firstName} ${liftTarget.customer.lastName}` : liftTarget.maskedValue} could get
              marketing email again. Lifting doesn’t give consent — record their opt-in on the customer profile first.
            </>
          }
          confirmLabel="Lift suppression"
          pendingLabel="Lifting…"
          isPending={lift.isPending}
          onConfirm={() => lift.mutate(liftTarget.id)}
          onClose={() => setLiftTarget(null)}
        />
      )}
    </motion.div>
  );
}

/** One address in the audit log's shape: glyph, who, how it was added, when, and Lift. */
function SuppressionRow({ item, canLift, onLift }: { item: MarketingSuppression; canLift: boolean; onLift: () => void }) {
  const name = item.customer ? `${item.customer.firstName} ${item.customer.lastName}` : null;
  return (
    <li className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground" aria-hidden="true">
        <ShieldOff size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {name ?? <span className="font-mono">{item.maskedValue}</span>}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {name && <span className="font-mono">{item.maskedValue} · </span>}
          {suppressionSourceLabel(item.source)}
        </span>
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDate(item.createdAt)}</span>
      {canLift && (
        <Button variant="outline" size="sm" onClick={onLift} className="shrink-0" title="Allow marketing email to this address again">
          Lift
        </Button>
      )}
    </li>
  );
}
