'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { RowWarning } from '@/components/shared/rows';
import { ArrowRight, Award, Clock, Gift, Hash, Plus, Repeat, TicketPercent, Users, XCircle } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { ChangeRow, Fact, SaveBar, Switch, ValueAside, ValueMissing } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards, Hint } from '@/components/shared/FormParts';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import { SettingRowsSectionSkeleton } from '@/components/shared/TileSkeleton';
import type { Tone } from '@/components/shared/tone';
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

/** The fields each row edits — what its Cancel puts back. */
const FIELDS_OF: Record<Row, (keyof ReferralProgramDraft)[]> = {
  friend: ['friendPromotionId'],
  rewardKind: ['referrerRewardKind'],
  rewardSource: ['referrerPromotionId', 'referrerLoyaltyProgramId'],
  cap: ['maxRewardsPerReferrer'],
  prefix: ['codePrefix'],
};

const FILTER_LABELS: Record<Exclude<Filter, 'cancelled'>, string> = {
  all: 'All',
  pending: 'Waiting',
  rewarded: 'Rewarded',
  declined: 'No reward',
};

const STATUS_TONE: Record<ReferralStatus, Tone> = {
  pending: 'info',
  rewarded: 'success',
  declined: 'warning',
  cancelled: 'muted',
};

/**
 * Refer a friend, as a tab of Promotions, in the Settings → Account layout:
 * the counts as figures (three filter the list), Rewards | Programme as two
 * sections of rows whose Change opens the control in place, then who referred
 * whom. Rewards are given by the order itself when a friend's first order is
 * completed.
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

  if (program.isPending) return shell(<ReferralsSkeleton />);
  if (program.isError)
    return shell(<ErrorState className="flex-1" title="Refer a friend couldn’t be loaded" onRetry={() => void program.refetch()} />);

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
  // One row open at a time. Setting up starts on the friend's offer.
  const [open, setOpen] = useState<Row | null>(program ? null : 'friend');
  // The draft as it was when the open row opened, so its Cancel can put that row back.
  const [before, setBefore] = useState<ReferralProgramDraft>(initial);
  // Which referrals the list shows; the figures set it too.
  const [list, setList] = useState<{ filter: Filter; page: number }>({ filter: 'all', page: 1 });
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
  const openRow = (row: Row | null) => {
    setBefore(draft);
    setOpen(row);
  };
  const attemptSave = () => {
    const fields = Object.keys(problems) as (keyof ReferralProgramDraft)[];
    if (fields.length) {
      setShowProblems(true);
      // Open the first row with a problem, so the fix is under the eye.
      openRow(ROW_OF[fields[0]!] ?? null);
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

  /** Change opens a row; Cancel closes it and puts its fields back as they were when it opened. */
  const toggle = (row: Row) => {
    if (open === row) {
      patch(Object.fromEntries(FIELDS_OF[row].map((field) => [field, before[field]])) as Partial<ReferralProgramDraft>);
      setOpen(null);
      return;
    }
    openRow(row);
  };
  const onToggle = (row: Row) => (editable ? () => toggle(row) : undefined);
  const rewardSourceProblem = problemOf('referrerPromotionId') ?? problemOf('referrerLoyaltyProgramId');
  const rewardSourceMissing = draft.referrerRewardKind === 'promo_code' ? !draft.referrerPromotionId : !draft.referrerLoyaltyProgramId;
  const rewardSourceName = draft.referrerRewardKind === 'promo_code' ? rewardPromotion?.name : rewardProgramme?.name;
  const pick = (filter: Filter) => setList((now) => ({ filter: now.filter === filter ? 'all' : filter, page: 1 }));
  const counts = program?.counts;

  const rewards = (
    <RecordGroup
      card
      id="referrals-rewards"
      title="Rewards"
      footnote="The customer is rewarded when the friend’s first order is completed. Communications can email them then, with the “referral earns a reward” trigger."
    >
      <fieldset disabled={!editable} className="min-w-0">
        <ChangeRow
          icon={Users}
          label="The friend gets"
          value={
            friendOffer ? (
              <>
                <span className="truncate">{friendOffer.name}</span>
                <ValueAside>· {friendOffer.summary}</ValueAside>
              </>
            ) : (
              <ValueMissing>Not chosen</ValueMissing>
            )
          }
          tone={problemOf('friendPromotionId') ? 'danger' : !draft.friendPromotionId ? 'warning' : undefined}
          open={open === 'friend'}
          onToggle={onToggle('friend')}
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
        </ChangeRow>
        <ChangeRow
          icon={Gift}
          label="The customer gets"
          value={draft.referrerRewardKind === 'promo_code' ? 'A promo code' : 'A loyalty reward'}
          open={open === 'rewardKind'}
          onToggle={onToggle('rewardKind')}
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
        </ChangeRow>
        <ChangeRow
          icon={draft.referrerRewardKind === 'promo_code' ? TicketPercent : Award}
          label={draft.referrerRewardKind === 'promo_code' ? 'Reward code from' : 'Reward from'}
          value={rewardSourceName ? <span className="truncate">{rewardSourceName}</span> : <ValueMissing>Not chosen</ValueMissing>}
          tone={rewardSourceProblem ? 'danger' : rewardSourceMissing ? 'warning' : undefined}
          open={open === 'rewardSource'}
          onToggle={onToggle('rewardSource')}
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
        </ChangeRow>
      </fieldset>
      {friendOffer && !friendOffer.firstOrderOnly && (
        <RowWarning className="mt-3">
          {friendOffer.name} isn’t first order only, so a friend could use the code more than once. Turn it on in{' '}
          <Link href={`/promotions?promotion=${friendOffer.id}`} className="underline underline-offset-2">
            the promotion
          </Link>
          .
        </RowWarning>
      )}
      {draft.referrerRewardKind === 'loyalty_reward' && loyalty.isSuccess && rewardProgrammes.length === 0 && (
        <RowWarning className="mt-3">
          No loyalty programme gives rewards yet, so there’s nothing to reward the customer with. Set one up in{' '}
          <Link href="/customers/loyalty" className="underline underline-offset-2">
            Customers → Loyalty
          </Link>
          .
        </RowWarning>
      )}
    </RecordGroup>
  );

  const programme = (
    <RecordGroup
      card
      id="referrals-programme"
      title="Programme"
      footnote="Customers get their code on their record, at the till or from your website. No one can use their own, and a friend is referred once — again only if their first order was cancelled."
    >
      <fieldset disabled={!editable} className="min-w-0">
        <ChangeRow
          icon={Gift}
          label="Give out codes"
          value={
            <>
              {draft.active ? 'Running' : <ValueMissing>Paused</ValueMissing>}
              {!program && <ValueAside>· not set up yet</ValueAside>}
            </>
          }
          trailing={<Switch label="Give out codes" checked={draft.active} onChange={(active) => patch({ active })} />}
        />
        <ChangeRow
          icon={Hash}
          label="Codes look like"
          value={<span className="truncate font-mono">{sampleReferralCode(draft.codePrefix)}</span>}
          tone={problemOf('codePrefix') ? 'danger' : undefined}
          open={open === 'prefix'}
          onToggle={onToggle('prefix')}
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
        </ChangeRow>
        <ChangeRow
          icon={Repeat}
          label="Rewards per customer"
          value={
            draft.maxRewardsPerReferrer.trim() ? (
              rewardsCapLabel(draft.maxRewardsPerReferrer)
            ) : (
              <ValueMissing>{rewardsCapLabel(draft.maxRewardsPerReferrer)}</ValueMissing>
            )
          }
          tone={problemOf('maxRewardsPerReferrer') ? 'danger' : undefined}
          open={open === 'cap'}
          onToggle={onToggle('cap')}
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
        </ChangeRow>
      </fieldset>
    </RecordGroup>
  );

  return shell(
    <motion.div
      className="flex w-full flex-col gap-5"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      {program && (
        <motion.dl variants={SECTION_RISE} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact surface="page" icon={Hash} label="Codes given out" value={counts?.codesIssued ?? '—'} />
          <Fact
            surface="page"
            icon={Clock}
            label="Waiting for an order"
            value={counts?.pending ?? '—'}
            selected={list.filter === 'pending'}
            onSelect={() => pick('pending')}
          />
          <Fact
            surface="page"
            icon={Gift}
            label="Rewarded"
            value={counts?.rewarded ?? '—'}
            selected={list.filter === 'rewarded'}
            onSelect={() => pick('rewarded')}
          />
          <Fact
            surface="page"
            icon={XCircle}
            label="No reward"
            value={counts?.declined ?? '—'}
            hint="Over the cap, or while paused"
            selected={list.filter === 'declined'}
            onSelect={() => pick('declined')}
          />
        </motion.dl>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {rewards}
        {programme}
      </div>

      {program && (
        <ReferralsList
          filter={list.filter}
          page={list.page}
          onFilter={(filter) => setList({ filter, page: 1 })}
          onPage={(page) => setList((now) => ({ ...now, page }))}
        />
      )}

      {editable && (
        <SaveBar
          dirty={dirty || !program}
          saving={save.isPending}
          saveLabel={program ? 'Save changes' : 'Set up refer a friend'}
          message={`${program ? 'Unsaved changes' : 'Not set up yet'} · ${saveShortcut} ${program ? 'saves' : 'sets it up'}`}
          onSave={attemptSave}
          onDiscard={() => {
            setDraft(initial);
            setOpen(null);
          }}
        />
      )}
    </motion.div>,
  );
}

/** The line under an open row's control: why it matters, or what's wrong with it. */
/** The page without its words: the figures, then the two sections of rows. */
function ReferralsSkeleton() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Loading refer a friend">
      <FactsSkeleton count={4} label="Loading referral figures" className="gap-3 sm:grid-cols-2 xl:grid-cols-4" />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SettingRowsSectionSkeleton rows={3} />
        <SettingRowsSectionSkeleton rows={3} />
      </div>
    </div>
  );
}

/** Who referred whom, newest first. */
function ReferralsList({
  filter,
  page,
  onFilter,
  onPage,
}: {
  filter: Filter;
  page: number;
  onFilter: (filter: Filter) => void;
  onPage: (page: number) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const query = useQuery({
    queryKey: moduleQueryKeys.referrals.key('list', filter, page, tenantId),
    queryFn: () => getReferrals(page, filter === 'all' ? undefined : filter, tenantId),
    placeholderData: (previous) => previous,
  });
  const total = query.data?.pagination.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (query.data?.pagination.limit ?? 50)));
  const listed = query.isSuccess && query.data.data.length > 0;
  return (
    <RecordGroup
      id="referrals-list"
      title="Referrals"
      card={!query.isPending && !listed}
      actions={
        <div className="flex items-center gap-3">
          {query.isSuccess && (
            <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {total} {total === 1 ? 'referral' : 'referrals'}
            </span>
          )}
          <Select
            value={filter}
            onValueChange={(next) => onFilter(next as Filter)}
            options={(Object.keys(FILTER_LABELS) as (keyof typeof FILTER_LABELS)[]).map((value) => ({
              value,
              label: FILTER_LABELS[value],
            }))}
            ariaLabel="Which referrals"
            className="w-40"
          />
        </div>
      }
    >
      {query.isPending ? (
        <ListSkeleton rows={4} label="Loading referrals" />
      ) : query.isError ? (
        <ErrorState className="py-6" title="Couldn’t load the referrals" onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        filter === 'all' ? (
          <EmptyState compact icon={Gift} title="No referrals yet" description="They appear when a friend orders with someone’s code." />
        ) : (
          <EmptyState
            compact
            icon={Gift}
            kind="search"
            title="None here"
            action={{ label: 'Show all referrals', onClick: () => onFilter('all') }}
          />
        )
      ) : (
        <>
          <ListRowGroup aria-label="Referrals">
            {query.data.data.map((referral) => (
              <ListRow
                key={referral.id}
                icon={Gift}
                tone={STATUS_TONE[referral.status]}
                title={
                  <>
                    {referral.referrerName || 'A customer'}{' '}
                    <ArrowRight size={13} className="inline align-[-2px] text-muted-foreground" aria-label="referred" />{' '}
                    {referral.referredName || 'a friend'}
                  </>
                }
                meta={
                  <>
                    <span className="font-mono">{referral.code}</span> · <RelativeTime iso={referral.createdAt} />
                    {referral.rewardCode && (
                      <>
                        {' '}
                        · reward <span className="font-mono text-foreground">{referral.rewardCode}</span>
                      </>
                    )}
                    {referral.declinedReason && ` · ${referral.declinedReason}`}
                  </>
                }
                trailing={
                  <Badge variant={REFERRAL_STATUS_BADGE[referral.status]} className="shrink-0">
                    {REFERRAL_STATUS_LABELS[referral.status]}
                  </Badge>
                }
              />
            ))}
          </ListRowGroup>
          {pages > 1 && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                Newer
              </Button>
              <span className="tabular-nums">
                {page} of {pages}
              </span>
              <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
                Older
              </Button>
            </div>
          )}
        </>
      )}
    </RecordGroup>
  );
}
