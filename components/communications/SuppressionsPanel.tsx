'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { Plus, RotateCcw, Search, ShieldOff } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import {
  type MarketingSuppression,
  addMarketingSuppression,
  getMarketingSuppressions,
  liftMarketingSuppression,
} from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { SUPPRESSION_REASONS, groupSuppressions, suppressionReasonLabel, suppressionSourceLabel } from '@/lib/utils/communications';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { CommunicationsToolbar } from './CommunicationsToolbar';
import { useEmailAccess } from './useEmailAccess';

// Erasure entries come from a privacy request, never from this form.
const ADD_REASONS = SUPPRESSION_REASONS.filter((reason) => reason.value !== 'privacy_erasure').map(({ value, label }) => ({
  value,
  label,
}));

/**
 * Who marketing email must not reach, as the other tabs list things: a search
 * with the Reason select and the count, then one row per address, newest
 * first. Lifting asks first — it lets marketing reach that address again.
 *
 * `adding` is controlled by the page: the "Add email" button lives in the
 * masthead with every other tab's primary action.
 */
export function SuppressionsPanel({ adding, onAddingChange }: { adding: boolean; onAddingChange: (open: boolean) => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const { canSuppress } = useEmailAccess();
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState('');
  const [why, setWhy] = useState('all');
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
  // Reasons offered are the ones on the list, so the filter never returns nothing.
  const reasonOptions = useMemo(
    () => [
      { value: 'all', label: 'Any reason' },
      ...groupSuppressions(list, '').map((group) => ({ value: group.reason, label: `${group.label} · ${group.items.length}` })),
    ],
    [list],
  );
  const shown = useMemo(
    () =>
      groupSuppressions(list, search)
        .filter((group) => why === 'all' || group.reason === why)
        .flatMap((group) => group.items)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [list, search, why],
  );
  const filtersActive = Boolean(search.trim()) || why !== 'all';
  const clearFilters = () => {
    setSearch('');
    setWhy('all');
  };
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
          <FieldLabel as="span">Why</FieldLabel>
          <Select value={reason} onValueChange={setReason} options={ADD_REASONS} ariaLabel="Why" className="w-full" />
          <p className="text-xs text-muted-foreground">{SUPPRESSION_REASONS.find((item) => item.value === reason)?.detail}</p>
        </div>
      </div>
    </Modal>
  );

  if (suppressions.isPending)
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Bone className="h-9 min-w-56 flex-1" />
          <Bone className="h-9 w-40" />
        </div>
        <ListSkeleton rows={4} avatar label="Loading suppressions" />
      </div>
    );

  if (suppressions.isError)
    return <ErrorState className="flex-1" title="Suppressions couldn’t be loaded" onRetry={() => void suppressions.refetch()} />;

  return (
    <motion.div
      className="flex flex-1 flex-col gap-3"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      {list.length === 0 ? (
        <EmptyState
          icon={ShieldOff}
          title="No one has opted out"
          className="flex-1"
          description="Unsubscribes, bounces and addresses you add by hand appear here."
          action={canSuppress ? { label: 'Add email', onClick: () => onAddingChange(true), icon: Plus } : undefined}
        />
      ) : (
        <>
          <motion.div variants={SECTION_RISE}>
            <CommunicationsToolbar
              search={search}
              onSearch={setSearch}
              placeholder="Name, address or reason…"
              label="Find a suppressed address by name, address or reason"
              count={filtersActive ? `${shown.length} of ${list.length}` : `${list.length} ${list.length === 1 ? 'address' : 'addresses'}`}
              filters={<Select value={why} onValueChange={setWhy} options={reasonOptions} ariaLabel="Reason" className="w-40" />}
            />
          </motion.div>

          <motion.div variants={SECTION_RISE} className="flex flex-1 flex-col">
            {shown.length === 0 ? (
              <EmptyState
                className="flex-1"
                icon={Search}
                kind="search"
                title="No address matches"
                description="Try a different search or reason."
                action={{ label: 'Clear filters', onClick: clearFilters }}
              />
            ) : (
              <ListRowGroup aria-label="Suppressed addresses">
                {shown.map((item) => (
                  <SuppressionRow key={item.id} item={item} canLift={canSuppress} onLift={() => setLiftTarget(item)} />
                ))}
              </ListRowGroup>
            )}
          </motion.div>
        </>
      )}

      <motion.p variants={SECTION_RISE} className="px-1 text-xs leading-relaxed text-muted-foreground">
        These addresses won’t receive marketing emails. Receipts and order updates still go out.
      </motion.p>

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

/** One address: who (their initials when it's a customer), the masked address, why and how it was added, when, and Lift on hover. */
function SuppressionRow({ item, canLift, onLift }: { item: MarketingSuppression; canLift: boolean; onLift: () => void }) {
  const name = item.customer ? `${item.customer.firstName} ${item.customer.lastName}` : null;
  return (
    <ListRow
      icon={name ? undefined : ShieldOff}
      tone="muted"
      leading={name ? <Avatar name={name} /> : undefined}
      title={name ?? <span className="font-mono">{item.maskedValue}</span>}
      meta={
        <>
          {name && <span className="font-mono">{item.maskedValue} · </span>}
          {suppressionReasonLabel(item.reason)} · {suppressionSourceLabel(item.source)}
        </>
      }
      trailing={<RelativeTime iso={item.createdAt} className="text-xs tabular-nums text-muted-foreground" />}
      actions={
        canLift ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onLift}
            aria-label={`Lift suppression for ${name ?? item.maskedValue}`}
            title="Allow marketing email to this address again"
          >
            <RotateCcw />
          </Button>
        ) : undefined
      }
    />
  );
}
