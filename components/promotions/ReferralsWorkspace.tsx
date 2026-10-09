'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { FieldRow, InfoRow, InfoRows, RowTile, SectionInfo } from '@/components/cms/rows';
import { ArrowRight, Gift, Hash, Plus, TicketPercent, Users } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { LoadingState } from '@/components/shared/Skeleton';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { getLoyaltyPrograms } from '@/lib/api/loyalty.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { getPromotions } from '@/lib/modules/promotions/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type ReferralProgram,
  type ReferralStatus,
  getReferralProgram,
  getReferrals,
  saveReferralProgram,
} from '@/lib/modules/referrals/client';
import {
  REFERRAL_STATUS_BADGE,
  REFERRAL_STATUS_LABELS,
  type ReferralProgramDraft,
  draftFromProgram,
  draftToProgram,
  emptyReferralDraft,
  referralDraftProblems,
  sampleReferralCode,
} from '@/lib/utils/referrals';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { PromotionsTabs } from './PromotionsTabs';

/** Sections rise in one after another, as in the Content editors. */
const STAGGER = { shown: { transition: { staggerChildren: 0.06 } } };

type Filter = 'all' | ReferralStatus;

/**
 * Refer a friend, as a tab of Promotions: the programme in the main column —
 * what the friend gets, what the referrer gets, the limits — then who
 * referred whom; the totals and how it works beside it. Rewards are given by
 * the order itself when a friend's first order is completed.
 */
export function ReferralsWorkspace() {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const editable = hasCapability(
    useAuthStore((state) => state.capabilities),
    'referrals:write',
  );

  const program = useQuery({
    queryKey: moduleQueryKeys.referrals.key('program', tenantId),
    queryFn: () => getReferralProgram(tenantId),
    enabled: Boolean(tenantId),
  });

  const shell = (body: React.ReactNode, actions?: React.ReactNode) => (
    <EditorShell
      eyebrow="Customer engagement"
      title="Promotions"
      icon={<TicketPercent size={20} aria-hidden="true" />}
      subheader={<PromotionsTabs value="referrals" />}
      actions={actions}
    >
      {body}
    </EditorShell>
  );

  if (program.isPending) return shell(<LoadingState label="Loading refer a friend" />);
  if (program.isError)
    return shell(
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        <ErrorState title="Refer a friend couldn’t be loaded" onRetry={() => void program.refetch()} />
      </div>,
    );

  return (
    <ReferralsForm
      // A save replaces the programme; the key keeps the form in step with it.
      key={program.data?.updatedAt ?? 'new'}
      program={program.data}
      editable={editable}
      shell={shell}
    />
  );
}

function ReferralsForm({
  program,
  editable,
  shell,
}: {
  program: ReferralProgram | null;
  editable: boolean;
  shell: (body: React.ReactNode, actions?: React.ReactNode) => React.ReactElement;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const router = useRouter();
  const initial = useMemo(() => (program ? draftFromProgram(program) : emptyReferralDraft()), [program]);
  const [draft, setDraft] = useState<ReferralProgramDraft>(initial);
  const [showProblems, setShowProblems] = useState(false);
  const patch = (next: Partial<ReferralProgramDraft>) => setDraft((current) => ({ ...current, ...next }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const problems = referralDraftProblems(draft);
  const problemOf = (field: keyof ReferralProgramDraft) => (showProblems ? problems[field] : undefined);

  const promotions = useQuery({
    queryKey: moduleQueryKeys.promotions.key('list', tenantId),
    queryFn: () => getPromotions(tenantId),
    enabled: Boolean(tenantId),
  });
  const loyalty = useQuery({
    queryKey: moduleQueryKeys.customers.key('loyalty-programmes', tenantId),
    queryFn: () => getLoyaltyPrograms(tenantId),
    enabled: Boolean(tenantId),
  });
  const current = (promotions.data ?? []).filter((promotion) => promotion.status !== 'archived');
  const promotionOptions = current.map((promotion) => ({ value: promotion.id, label: `${promotion.name} — ${promotion.summary}` }));
  const rewardProgrammes = (loyalty.data?.data ?? []).filter(
    (programme) => programme.status === 'active' && (programme.earnRule.benefitMode ?? 'rewards') !== 'points',
  );
  const friendOffer = current.find((promotion) => promotion.id === draft.friendPromotionId);

  const save = useMutation({
    mutationFn: () => saveReferralProgram(draftToProgram(draft), tenantId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.referrals.all });
      toast('success', program ? 'Refer a friend saved.' : 'Refer a friend is set up — customers can get their codes now.');
    },
    onError: (error) => toast('error', error.message),
  });
  const attemptSave = () => {
    if (Object.keys(problems).length) {
      setShowProblems(true);
      toast('error', Object.values(problems)[0]!);
      return;
    }
    save.mutate();
  };

  // ⌘S / Ctrl+S saves, as in the Content editors.
  const saveShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘S' : 'Ctrl+S';
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (editable && (dirty || !program) && !save.isPending) attemptSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Nothing to offer yet: the friend's offer and the reward are promotions.
  if (promotions.isSuccess && current.length === 0)
    return shell(
      <EmptyState
        className="flex-1"
        icon={Gift}
        title="Create a promotion first"
        description="Refer a friend gives the friend a promotion — usually a first-order discount — through each customer’s own code. Create that offer in Promotions, then come back to set this up."
        action={{ label: 'New promotion', onClick: () => router.push('/promotions?promotion=new'), icon: Plus }}
      />,
    );

  const actions =
    editable && (dirty || !program) ? (
      <div className="flex items-center gap-2">
        {program && (
          <Button variant="ghost" className="h-9" disabled={save.isPending} onClick={() => setDraft(initial)}>
            Discard
          </Button>
        )}
        <Tooltip side="top" align="end" label={`${program ? 'Save' : 'Set up'} (${saveShortcut})`}>
          <Button className="h-9" disabled={save.isPending} onClick={attemptSave}>
            {save.isPending ? 'Saving…' : program ? 'Save' : 'Set up refer a friend'}
          </Button>
        </Tooltip>
      </div>
    ) : undefined;

  return shell(
    <motion.div initial="hidden" animate="shown" variants={STAGGER}>
      <SettingsTabBody narrowAside aside={<ReferralsAside program={program} />}>
        <fieldset disabled={!editable} className="flex min-w-0 flex-col gap-5">
          <SettingsSection
            title="Programme"
            description="Every customer can have their own code. A friend who uses it gets your offer; when the friend’s first order is completed, the customer is rewarded."
          >
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <RowTile icon={Gift} tone={draft.active ? 'success' : 'default'} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{draft.active ? 'Running' : 'Paused'}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      Paused: no new codes are given out, and completed referrals earn no reward.
                    </p>
                  </div>
                </div>
                <Switch label="Refer a friend running" checked={draft.active} onChange={(active) => patch({ active })} />
              </div>

              <FieldRow icon={Users} title="The friend gets" note="A promotion">
                <Select
                  value={draft.friendPromotionId}
                  onValueChange={(friendPromotionId) => patch({ friendPromotionId })}
                  options={[{ value: '', label: 'Choose a promotion…' }, ...promotionOptions]}
                  ariaLabel="The friend’s offer"
                  className="w-full"
                />
                {problemOf('friendPromotionId') && <p className="mt-1 text-xs text-destructive">{problemOf('friendPromotionId')}</p>}
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Every customer’s code is a code of this promotion, so its rules apply to the friend.
                  {friendOffer && !friendOffer.firstOrderOnly && (
                    <span className="font-medium text-measured">
                      {' '}
                      It isn’t first order only — a friend could use the code more than once.
                    </span>
                  )}
                </p>
              </FieldRow>

              <FieldRow icon={Gift} title="The customer gets">
                <SegmentedControl
                  options={[
                    { value: 'promo_code' as const, label: 'A promo code' },
                    { value: 'loyalty_reward' as const, label: 'A loyalty reward' },
                  ]}
                  value={draft.referrerRewardKind}
                  onChange={(referrerRewardKind) => patch({ referrerRewardKind })}
                  ariaLabel="The referrer’s reward"
                  className="w-full [&>button]:flex-1"
                />
                <div className="mt-2">
                  {draft.referrerRewardKind === 'promo_code' ? (
                    <>
                      <Select
                        value={draft.referrerPromotionId}
                        onValueChange={(referrerPromotionId) => patch({ referrerPromotionId })}
                        options={[{ value: '', label: 'Choose a promotion…' }, ...promotionOptions]}
                        ariaLabel="The reward promotion"
                        className="w-full"
                      />
                      <p className="mt-1.5 text-xs text-muted-foreground">A single-use code of this promotion, issued to them.</p>
                    </>
                  ) : rewardProgrammes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No loyalty programme gives rewards yet — set one up in Customers → Loyalty.
                    </p>
                  ) : (
                    <>
                      <Select
                        value={draft.referrerLoyaltyProgramId}
                        onValueChange={(referrerLoyaltyProgramId) => patch({ referrerLoyaltyProgramId })}
                        options={[
                          { value: '', label: 'Choose a loyalty programme…' },
                          ...rewardProgrammes.map((programme) => ({ value: programme.id, label: programme.name })),
                        ]}
                        ariaLabel="The reward’s loyalty programme"
                        className="w-full"
                      />
                      <p className="mt-1.5 text-xs text-muted-foreground">One reward from this programme, straight into their wallet.</p>
                    </>
                  )}
                  {(problemOf('referrerPromotionId') || problemOf('referrerLoyaltyProgramId')) && (
                    <p className="mt-1 text-xs text-destructive">
                      {problemOf('referrerPromotionId') ?? problemOf('referrerLoyaltyProgramId')}
                    </p>
                  )}
                </div>
              </FieldRow>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Rewards per customer"
                  inputMode="numeric"
                  value={draft.maxRewardsPerReferrer}
                  onChange={(event) => patch({ maxRewardsPerReferrer: event.target.value.replace(/\D/g, '') })}
                  placeholder="Unlimited"
                  error={problemOf('maxRewardsPerReferrer')}
                />
                <Input
                  label="Code starts with"
                  value={draft.codePrefix}
                  onChange={(event) =>
                    patch({
                      codePrefix: event.target.value
                        .replace(/[^A-Za-z0-9]/g, '')
                        .toUpperCase()
                        .slice(0, 12),
                    })
                  }
                  placeholder="Their first name"
                  className="font-mono uppercase"
                  error={problemOf('codePrefix')}
                  hint={`Codes look like ${sampleReferralCode(draft.codePrefix)}`}
                />
              </div>
            </div>
          </SettingsSection>
        </fieldset>

        {program && <ReferralsList />}
      </SettingsTabBody>
    </motion.div>,
    actions,
  );
}

function ReferralsAside({ program }: { program: ReferralProgram | null }) {
  const counts = program?.counts;
  const figure = (value: number | undefined) => <span className="text-sm tabular-nums text-muted-foreground">{value ?? '—'}</span>;
  return (
    <>
      <SettingsSection title="Overview">
        <InfoRows>
          <InfoRow icon={Hash} title="Codes given out">
            {figure(counts?.codesIssued)}
          </InfoRow>
          <InfoRow icon={Users} title="Waiting for an order">
            {figure(counts?.pending)}
          </InfoRow>
          <InfoRow icon={Gift} title="Rewarded">
            {figure(counts?.rewarded)}
          </InfoRow>
          <InfoRow icon={TicketPercent} title="No reward">
            <Tooltip
              side="top"
              align="end"
              wrap
              label="Completed, but nothing was due — the customer’s cap, or a paused programme. The reason is on each row."
            >
              {figure(counts?.declined)}
            </Tooltip>
          </InfoRow>
        </InfoRows>
      </SettingsSection>
      <SettingsSection
        title="How it works"
        actions={
          <SectionInfo label="A customer can’t use their own code, and a friend is referred once — again only if their first order was cancelled." />
        }
      >
        <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground">
          <li>A customer gets their code — on their record, at the till, or from your website.</li>
          <li>A friend uses it on their first order and gets your offer.</li>
          <li>When that order is completed, the customer gets their reward. Cancelled first: nothing.</li>
          <li>Communications can email them then — the “referral earns a reward” trigger.</li>
        </ol>
      </SettingsSection>
    </>
  );
}

/** Who referred whom, newest first. */
function ReferralsList() {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: moduleQueryKeys.referrals.key('list', filter, page, tenantId),
    queryFn: () => getReferrals(page, filter === 'all' ? undefined : filter, tenantId),
    placeholderData: (previous) => previous,
  });
  const total = query.data?.pagination.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (query.data?.pagination.limit ?? 50)));
  return (
    <SettingsSection
      title="Referrals"
      actions={
        <SegmentedControl<Filter>
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setPage(1);
          }}
          ariaLabel="Which referrals"
          options={[
            { value: 'all', label: 'All' },
            { value: 'pending', label: 'Waiting' },
            { value: 'rewarded', label: 'Rewarded' },
            { value: 'declined', label: 'No reward' },
          ]}
        />
      }
    >
      {query.isPending ? (
        <TilesSkeleton count={3} label="Loading referrals" />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load the referrals" onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {filter === 'all' ? 'No referrals yet — they appear when a friend orders with someone’s code.' : 'None here.'}
        </p>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-2">
            {query.data.data.map((referral) => (
              <li key={referral.id} className="flex items-center gap-3 rounded-lg border border-rule/50 bg-control px-3 py-2.5">
                <RowTile icon={Gift} tone={referral.status === 'rewarded' ? 'success' : 'default'} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                    <span className="truncate">{referral.referrerName || 'A customer'}</span>
                    <ArrowRight size={13} className="shrink-0 text-muted-foreground" aria-label="referred" />
                    <span className="truncate">{referral.referredName || 'a friend'}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{referral.code}</span> · <RelativeTime iso={referral.createdAt} />
                    {referral.rewardCode && (
                      <>
                        {' '}
                        · reward <span className="font-mono text-foreground">{referral.rewardCode}</span>
                      </>
                    )}
                    {referral.declinedReason && ` · ${referral.declinedReason}`}
                  </span>
                </span>
                <Badge variant={REFERRAL_STATUS_BADGE[referral.status]} className="shrink-0">
                  {REFERRAL_STATUS_LABELS[referral.status]}
                </Badge>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Newer
              </Button>
              <span className="tabular-nums">
                {page} of {pages}
              </span>
              <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
                Older
              </Button>
            </div>
          )}
        </div>
      )}
    </SettingsSection>
  );
}
