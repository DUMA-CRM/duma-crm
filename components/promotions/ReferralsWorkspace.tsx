'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { InfoRow, InfoRows, PickerRow, RowTile, SectionInfo } from '@/components/cms/rows';
import { AlertTriangle, ArrowRight, Award, Gift, Hash, Plus, Repeat, TicketPercent, Users } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar, Switch } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
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
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import {
  REFERRAL_STATUS_BADGE,
  REFERRAL_STATUS_LABELS,
  type ReferralProgramDraft,
  draftFromProgram,
  draftToProgram,
  emptyReferralDraft,
  referralDraftProblems,
  rewardsCapLabel,
  sampleReferralCode,
} from '@/lib/utils/referrals';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { PromotionsTabs } from './PromotionsTabs';

type Filter = 'all' | ReferralStatus;
type Row = 'friend' | 'rewardKind' | 'rewardSource' | 'cap' | 'prefix';

/** The row that holds each field, so a failed save can open the first one with a problem. */
const ROW_OF: Partial<Record<keyof ReferralProgramDraft, Row>> = {
  friendPromotionId: 'friend',
  referrerPromotionId: 'rewardSource',
  referrerLoyaltyProgramId: 'rewardSource',
  maxRewardsPerReferrer: 'cap',
  codePrefix: 'prefix',
};

/**
 * Refer a friend, as a tab of Promotions, laid out like Booking rules: the
 * programme in the main column — what the friend gets, what the referrer
 * gets, the limits — each a row that opens its control, then who referred
 * whom; the totals and how it works beside it. Rewards are given by the order
 * itself when a friend's first order is completed.
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

  const shell = (body: React.ReactNode) => (
    <EditorShell
      eyebrow="Customer engagement"
      title="Promotions"
      icon={<TicketPercent size={20} aria-hidden="true" />}
      subheader={<PromotionsTabs value="referrals" />}
    >
      {body}
    </EditorShell>
  );

  if (program.isPending) return shell(<Bone className="h-96 w-full rounded-lg" />);
  if (program.isError) return shell(<ErrorState title="Refer a friend couldn’t be loaded" onRetry={() => void program.refetch()} />);

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
  shell: (body: React.ReactNode) => React.ReactElement;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const initial = useMemo(() => (program ? draftFromProgram(program) : emptyReferralDraft()), [program]);
  const [draft, setDraft] = useState<ReferralProgramDraft>(initial);
  const [showProblems, setShowProblems] = useState(false);
  // One rule open at a time; a tap on the open one closes it. Setting up starts on the friend's offer.
  const [open, setOpen] = useState<Row | null>(program ? null : 'friend');
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
  const rewardPromotion = current.find((promotion) => promotion.id === draft.referrerPromotionId);
  const rewardProgramme = rewardProgrammes.find((programme) => programme.id === draft.referrerLoyaltyProgramId);

  const save = useMutation({
    mutationFn: () => saveReferralProgram(draftToProgram(draft), tenantId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.referrals.all });
      toast('success', program ? 'Refer a friend saved.' : 'Refer a friend is set up — customers can get their codes now.');
    },
    onError: (error) => toast('error', error.message),
  });
  const attemptSave = () => {
    const fields = Object.keys(problems) as (keyof ReferralProgramDraft)[];
    if (fields.length) {
      setShowProblems(true);
      // Open the first row with a problem, so the fix is under the eye.
      setOpen(ROW_OF[fields[0]!] ?? null);
      toast('error', problems[fields[0]!]!);
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

  const toggle = (row: Row) => setOpen((value) => (value === row ? null : row));
  const rewardSourceProblem = problemOf('referrerPromotionId') ?? problemOf('referrerLoyaltyProgramId');
  const rewardSourceMissing = draft.referrerRewardKind === 'promo_code' ? !draft.referrerPromotionId : !draft.referrerLoyaltyProgramId;
  const status = !program ? 'Not set up' : program.status === 'active' ? 'Running' : 'Paused';

  return shell(
    <motion.div
      className="w-full"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
    >
      <SettingsTabBody narrowAside aside={<ReferralsAside program={program} />}>
        <SettingsSection
          title="Programme"
          description="Every customer can have their own code. A friend who uses it gets your offer; when the friend’s first order is completed, the customer is rewarded."
          actions={<Badge variant={program?.status === 'active' ? 'success' : 'muted'}>{status}</Badge>}
        >
          <fieldset disabled={!editable} className="min-w-0 space-y-3">
            <InfoRow icon={Gift} title="Give out codes" tone={draft.active ? 'success' : 'default'}>
              <Switch label="Give out codes" checked={draft.active} onChange={(active) => patch({ active })} />
            </InfoRow>
            <PickerRow
              icon={Users}
              title="The friend gets"
              value={friendOffer?.name ?? 'Not chosen'}
              muted={!friendOffer && !problemOf('friendPromotionId')}
              tone={problemOf('friendPromotionId') ? 'danger' : !draft.friendPromotionId ? 'warning' : undefined}
              open={open === 'friend'}
              onToggle={() => toggle('friend')}
            >
              <Select
                value={draft.friendPromotionId}
                onValueChange={(friendPromotionId) => patch({ friendPromotionId })}
                options={[{ value: '', label: 'Choose a promotion…' }, ...promotionOptions]}
                ariaLabel="The friend’s offer"
                className="w-full"
              />
              <Hint error={problemOf('friendPromotionId')}>
                Every customer’s code is a code of this promotion, so its rules apply to the friend.
              </Hint>
            </PickerRow>
            <PickerRow
              icon={Gift}
              title="The customer gets"
              value={draft.referrerRewardKind === 'promo_code' ? 'A promo code' : 'A loyalty reward'}
              open={open === 'rewardKind'}
              onToggle={() => toggle('rewardKind')}
            >
              <ChoiceCards<ReferralProgramDraft['referrerRewardKind']>
                value={draft.referrerRewardKind}
                onChange={(referrerRewardKind) => patch({ referrerRewardKind })}
                options={[
                  { value: 'promo_code', label: 'A promo code' },
                  { value: 'loyalty_reward', label: 'A loyalty reward' },
                ]}
                appearance="settings"
              />
              <Hint>Given when the friend’s first order is completed.</Hint>
            </PickerRow>
            <PickerRow
              icon={draft.referrerRewardKind === 'promo_code' ? TicketPercent : Award}
              title={draft.referrerRewardKind === 'promo_code' ? 'Reward code from' : 'Reward from'}
              value={(draft.referrerRewardKind === 'promo_code' ? rewardPromotion?.name : rewardProgramme?.name) ?? 'Not chosen'}
              muted={rewardSourceMissing && !rewardSourceProblem}
              tone={rewardSourceProblem ? 'danger' : rewardSourceMissing ? 'warning' : undefined}
              open={open === 'rewardSource'}
              onToggle={() => toggle('rewardSource')}
            >
              {draft.referrerRewardKind === 'promo_code' ? (
                <>
                  <Select
                    value={draft.referrerPromotionId}
                    onValueChange={(referrerPromotionId) => patch({ referrerPromotionId })}
                    options={[{ value: '', label: 'Choose a promotion…' }, ...promotionOptions]}
                    ariaLabel="The reward promotion"
                    className="w-full"
                  />
                  <Hint error={rewardSourceProblem}>A single-use code of this promotion, issued to them.</Hint>
                </>
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
                  <Hint error={rewardSourceProblem}>One reward from this programme, straight into their wallet.</Hint>
                </>
              )}
            </PickerRow>
            <PickerRow
              icon={Repeat}
              title="Rewards per customer"
              value={rewardsCapLabel(draft.maxRewardsPerReferrer)}
              muted={!draft.maxRewardsPerReferrer.trim()}
              tone={problemOf('maxRewardsPerReferrer') ? 'danger' : undefined}
              open={open === 'cap'}
              onToggle={() => toggle('cap')}
            >
              <Input
                aria-label="Rewards per customer"
                inputMode="numeric"
                value={draft.maxRewardsPerReferrer}
                onChange={(event) => patch({ maxRewardsPerReferrer: event.target.value.replace(/\D/g, '') })}
                placeholder="Unlimited"
                error={problemOf('maxRewardsPerReferrer')}
                hint="Referrals past the cap still count, but earn nothing. Leave empty for no limit."
                autoFocus
              />
            </PickerRow>
            <PickerRow
              icon={Hash}
              title="Codes look like"
              value={sampleReferralCode(draft.codePrefix)}
              tone={problemOf('codePrefix') ? 'danger' : undefined}
              open={open === 'prefix'}
              onToggle={() => toggle('prefix')}
            >
              <Input
                aria-label="Code starts with"
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
                hint="What every code starts with. Leave empty to use each customer’s first name."
                autoFocus
              />
            </PickerRow>
          </fieldset>
          {friendOffer && !friendOffer.firstOrderOnly && (
            <Warning>
              {friendOffer.name} isn’t first order only, so a friend could use the code more than once. Turn it on in{' '}
              <Link href={`/promotions?promotion=${friendOffer.id}`} className="underline underline-offset-2">
                the promotion
              </Link>
              .
            </Warning>
          )}
          {draft.referrerRewardKind === 'loyalty_reward' && loyalty.isSuccess && rewardProgrammes.length === 0 && (
            <Warning>
              No loyalty programme gives rewards yet, so there’s nothing to reward the customer with. Set one up in{' '}
              <Link href="/customers/loyalty" className="underline underline-offset-2">
                Customers → Loyalty
              </Link>
              .
            </Warning>
          )}
        </SettingsSection>

        {program && <ReferralsList />}

        {editable && (
          <SaveBar
            dirty={dirty || !program}
            saving={save.isPending}
            saveLabel={program ? 'Save changes' : 'Set up refer a friend'}
            message={`${program ? 'Unsaved changes' : 'Not set up yet'} · ${saveShortcut} ${program ? 'saves' : 'sets it up'}`}
            onSave={attemptSave}
            onDiscard={() => setDraft(initial)}
          />
        )}
      </SettingsTabBody>
    </motion.div>,
  );
}

/** The line under an open row: why it matters, or what's wrong with it. */
function Hint({ error, children }: { error?: string | undefined; children: React.ReactNode }) {
  return <p className={cn('mt-1.5 text-xs', error ? 'text-exception' : 'text-muted-foreground')}>{error ?? children}</p>;
}

/** Something that stops the programme working as meant, with where to fix it. */
function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
      <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
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
        <Bone className="h-40 w-full rounded-md" />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load the referrals" onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {filter === 'all' ? 'No referrals yet — they appear when a friend orders with someone’s code.' : 'None here.'}
        </p>
      ) : (
        <div className="space-y-3">
          <ul className="-mx-2 flex flex-col gap-0.5">
            {query.data.data.map((referral) => (
              <li key={referral.id} className="flex items-center gap-3 rounded-md px-2 py-1.5">
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
