'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';

import { RotateCcw, Search, ShieldOff, X } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow } from '@/components/shared/ListRow';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone, RowSkeleton } from '@/components/shared/Skeleton';
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
      <div className="space-y-5" role="status" aria-busy="true" aria-label="Loading suppressions">
        <div className="space-y-1.5 px-1" aria-hidden="true">
          <Bone className="h-3.5 w-full max-w-xl" />
          <Bone className="h-3.5 w-2/3 max-w-md" />
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Bone className="h-9 min-w-56 flex-1 lg:max-w-sm" />
          <Bone className="ml-auto h-3 w-20" />
        </div>
        <div>
          <Bone className="mb-2 h-3 w-24" />
          <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {Array.from({ length: 4 }, (_, index) => (
              <RowSkeleton key={index} index={index} avatar />
            ))}
          </div>
        </div>
      </div>
    );

  if (suppressions.isError)
    return (
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        <ErrorState title="Suppressions couldn’t be loaded" onRetry={() => void suppressions.refetch()} />
      </div>
    );

  return (
    <motion.div className="flex flex-1 flex-col space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      <motion.p variants={SECTION_RISE} className="px-1 text-sm leading-relaxed text-muted-foreground">
        Marketing and lifecycle email never reaches these addresses. Receipts and “your order is ready” still go out — they aren’t
        marketing.
      </motion.p>

      {list.length === 0 ? (
        <EmptyState
          icon={ShieldOff}
          title="No one has opted out"
          className="flex-1"
          description="Unsubscribes, bounces and addresses you add by hand appear here."
        />
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
            <motion.div variants={SECTION_RISE}>
              <EmptyState
                icon={Search}
                kind="search"
                title="Nothing matches"
                description="Try another name, address or reason."
                action={{ label: 'Clear search', onClick: () => setSearch('') }}
              />
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

/** One address: who (their initials when it's a customer), the masked address and how it was added on one line, when, and Lift on hover. */
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
          {suppressionSourceLabel(item.source)}
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
